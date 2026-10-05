// TYPE-O server: the built interface, the variable masters (light preview
// copies for the browser) and the export API that instantiates them.

import express from 'express';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';
import { FAMILIES, FAMILY_BY_ID, LOOKS, GENRES, nameProblem } from '../shared/catalog.js';
import { parseProject, exportRequest, FORMATS, CONTENT_TYPES } from '../shared/project.js';
import { runPython, pythonStatus } from './compile.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(here, '..');
const MASTERS = path.join(here, 'masters');
const PORT = Number(process.env.TYPEO_PORT || 5188);

const app = express();
app.use(express.json({ limit: '12mb' }));  // an operator font ships its geometry
app.disable('x-powered-by');

const masterFile = (id, file) => {
  if (!FAMILY_BY_ID.has(id) || !/^(roman|italic|preview-roman|preview-italic)\.(ttf|woff2)$|^(OFL\.txt|charset\.json)$/.test(file)) return null;
  const p = path.join(MASTERS, id, file);
  return fs.existsSync(p) ? p : null;
};

app.get('/api/health', async (_req, res) => {
  const missing = FAMILIES.filter((f) => !fs.existsSync(path.join(MASTERS, f.id, 'roman.ttf'))).map((f) => f.id);
  res.json({ ok: true, python: await pythonStatus(), formats: FORMATS, missingMasters: missing });
});

app.get('/api/families', (_req, res) => {
  res.json({ genres: GENRES, families: FAMILIES, looks: LOOKS });
});

// Real outlines of a master, instantiated and flattened. The operator chain
// runs in the browser on exactly these polygons.
const outlineCache = new Map();
app.post('/api/outlines', async (req, res) => {
  const { family, axes, italic, chars, tolerance } = req.body || {};
  const master = masterFile(String(family), italic ? 'italic.ttf' : 'roman.ttf');
  if (!master) return res.status(404).json({ error: 'Unknown family' });
  const text = String(chars || '').slice(0, 400);
  const key = JSON.stringify([family, axes, Boolean(italic), text, tolerance]);
  try {
    if (!outlineCache.has(key)) {
      const job = JSON.stringify({ master, axes: axes || {}, chars: text, tolerance: tolerance || 1.2 });
      outlineCache.set(key, runPython(path.join(here, 'python', 'outline_font.py'), [], job, { timeout: 90000 })
        .then(({ data }) => JSON.parse(data.toString('utf8'))));
      if (outlineCache.size > 40) outlineCache.delete(outlineCache.keys().next().value);
    }
    res.json(await outlineCache.get(key));
  } catch (e) {
    outlineCache.delete(key);
    res.status(500).json({ error: String(e.message || e) });
  }
});

app.get('/masters/:id/:file', (req, res) => {
  const file = masterFile(req.params.id, req.params.file);
  if (!file) return res.status(404).end();
  res.setHeader('Cache-Control', 'public, max-age=86400');
  if (file.endsWith('.woff2')) res.type('font/woff2');
  else if (file.endsWith('.ttf')) res.type('font/ttf');
  else if (file.endsWith('.json')) res.type('application/json');
  else res.type('text/plain; charset=utf-8');
  res.sendFile(file);
});

// The first line of a master's OFL.txt is its copyright statement.
function licenceOf(id) {
  const file = masterFile(id, 'OFL.txt');
  const copyright = file ? (fs.readFileSync(file, 'utf8').split('\n')[0] || '').trim() : '';
  return {
    copyright,
    license: 'This Font Software is licensed under the SIL Open Font License, Version 1.1. '
      + 'This license is available with a FAQ at https://openfontlicense.org',
  };
}

// Build a font out of the polygons the browser produced. The operator chain
// ran there, so the geometry arrives finished; this only packs and licenses it.
app.post('/api/build-font', async (req, res) => {
  const body = req.body || {};
  const format = String(body.format || 'ttf').toLowerCase();
  if (!FORMATS.includes(format)) return res.status(400).json({ error: `Format must be one of ${FORMATS.join(', ')}` });
  const fam = FAMILY_BY_ID.get(String(body.family));
  if (!fam) return res.status(400).json({ error: 'Unknown family' });
  const problem = nameProblem(fam, body.familyName);
  if (problem) return res.status(400).json({ error: problem });
  const glyphs = body.glyphs && typeof body.glyphs === 'object' ? body.glyphs : null;
  if (!glyphs || !Object.keys(glyphs).length) return res.status(400).json({ error: 'There are no glyphs to build' });

  const job = {
    ...body,
    format,
    ...licenceOf(fam.id),
    note: `${body.familyName} is a Modified Version of ${fam.name} (© ${fam.credit}), reshaped with TYPE-O. `
      + 'Licensed under the SIL Open Font License 1.1.',
  };
  try {
    const { data, info } = await runPython(path.join(here, 'python', 'build_font.py'), [], JSON.stringify(job), { timeout: 120000 });
    const clean = String(body.familyName).replace(/\s+/g, '');
    const style = String(body.styleName || 'Regular').replace(/\s+/g, '');
    res.setHeader('Content-Type', CONTENT_TYPES[format]);
    res.setHeader('Content-Disposition', `attachment; filename="${clean}-${style}.${format}"`);
    res.setHeader('X-TypeO-Glyphs', String(info.glyphs ?? ''));
    res.setHeader('X-TypeO-Kern', String(info.kernPairs ?? ''));
    res.send(data);
  } catch (e) {
    res.status(500).json({ error: String(e.message || e) });
  }
});

app.post('/api/export-font', async (req, res) => {
  const format = String(req.body?.format || 'ttf').toLowerCase();
  if (!FORMATS.includes(format)) return res.status(400).json({ error: `Format must be one of ${FORMATS.join(', ')}` });
  let job;
  try {
    const { project } = parseProject({ format: 'typeo', fileVersion: 2, ...(req.body?.project || {}) });
    job = exportRequest(project, format);
  } catch (e) {
    return res.status(400).json({ error: String(e.message || e) });
  }
  const master = masterFile(job.family, job.italic ? 'italic.ttf' : 'roman.ttf');
  if (!master) return res.status(500).json({ error: 'This master is not installed on the server (npm run setup:masters).' });
  try {
    const { data, info } = await runPython(path.join(here, 'python', 'instance_font.py'), [], JSON.stringify({ ...job.payload, master }));
    res.setHeader('Content-Type', CONTENT_TYPES[format]);
    res.setHeader('Content-Disposition', `attachment; filename="${job.fileName}"`);
    res.setHeader('X-TypeO-Seconds', String(info.seconds ?? ''));
    res.send(data);
  } catch (e) {
    res.status(500).json({ error: String(e.message || e) });
  }
});

const dist = path.join(root, 'dist');
if (fs.existsSync(dist)) {
  app.use(express.static(dist, { maxAge: '1h', index: 'index.html' }));
  app.use((req, res, next) => (req.method === 'GET' && !req.path.startsWith('/api') && !req.path.startsWith('/masters') ? res.sendFile(path.join(dist, 'index.html')) : next()));
} else {
  app.get('/', (_req, res) => res.type('html').send('<h1>TYPE-O API</h1><p>Run <code>npm run dev</code>, or <code>npm run build</code> then <code>npm start</code>.</p>'));
}

app.listen(PORT, () => console.log(`TYPE-O API on http://localhost:${PORT}`));
