// GenType server: the built interface, the variable masters (light preview
// copies for the browser) and the export API that instantiates them.

import express from 'express';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';
import { FAMILIES, FAMILY_BY_ID, LOOKS, GENRES } from '../shared/catalog.js';
import { parseProject, exportRequest, FORMATS, CONTENT_TYPES } from '../shared/project.js';
import { runPython, pythonStatus } from './compile.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(here, '..');
const MASTERS = path.join(here, 'masters');
const PORT = Number(process.env.GENTYPE_PORT || 5188);

const app = express();
app.use(express.json({ limit: '1mb' }));
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

app.post('/api/export-font', async (req, res) => {
  const format = String(req.body?.format || 'ttf').toLowerCase();
  if (!FORMATS.includes(format)) return res.status(400).json({ error: `Format must be one of ${FORMATS.join(', ')}` });
  let job;
  try {
    const { project } = parseProject({ format: 'gentype', fileVersion: 2, ...(req.body?.project || {}) });
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
    res.setHeader('X-GenType-Seconds', String(info.seconds ?? ''));
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
  app.get('/', (_req, res) => res.type('html').send('<h1>GenType API</h1><p>Run <code>npm run dev</code>, or <code>npm run build</code> then <code>npm start</code>.</p>'));
}

app.listen(PORT, () => console.log(`GenType API on http://localhost:${PORT}`));
