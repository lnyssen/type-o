// GenType server: static hosting for the built client + the font compilation
// API. Outline generation happens in the shared engine; only the binary
// assembly needs Python (fontTools + skia-pathops).

import express from 'express';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';
import { generateFont, GLYPH_BY_NAME, editableGlyphs, skeletonFor } from '../shared/engine/font.js';
import { buildExportPayload, FORMATS, sanitizeFamilyName } from '../shared/engine/export.js';
import { parseProject } from '../shared/engine/project.js';
import { derive, PARAM_SPEC, METRIC_SPEC } from '../shared/engine/params.js';
import { serializeSkeleton } from '../shared/engine/skeleton.js';
import { compileFont, pythonStatus } from './compile.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(here, '..');
const PORT = Number(process.env.GENTYPE_PORT || 5188);

const app = express();
app.use(express.json({ limit: '8mb' }));
app.disable('x-powered-by');

// A project posted by the client, normalised through the same loader used for
// .gentype files so the API can never be fed something the engine chokes on.
function readProject(body) {
  const { project, warnings } = parseProject({ format: 'gentype', ...(body?.project || {}) });
  return { project, warnings };
}

app.get('/api/health', async (_req, res) => {
  res.json({ ok: true, python: await pythonStatus(), formats: FORMATS });
});

app.get('/api/glyphs', (_req, res) => {
  res.json({
    glyphs: editableGlyphs(),
    params: PARAM_SPEC,
    metrics: METRIC_SPEC,
  });
});

// One glyph, as an SVG path plus its metrics. Handy for scripting and for
// checking the browser preview against the server.
app.post('/api/generate-glyph', (req, res) => {
  try {
    const { project } = readProject(req.body);
    const name = String(req.body?.glyph || 'A');
    if (!GLYPH_BY_NAME.has(name)) return res.status(404).json({ error: `Unknown glyph "${name}"` });
    const font = generateFont(project, { quality: req.body?.quality === 'export' ? 'export' : 'preview', kerning: false });
    const g = font.glyphs.get(name);
    const d = g.contours.map((c) => `M${c.map((p) => `${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join('L')}Z`).join('');
    const { m } = font.D;
    res.json({
      name,
      char: g.char,
      advance: g.advance,
      lsb: Math.round(g.lsb),
      bbox: g.bbox,
      path: d,
      skeleton: serializeSkeleton(skeletonFor(name, project.skeletons, project.params.construction)),
      svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${g.advance} ${m.ascender - m.descender}"><path transform="translate(0 ${m.ascender}) scale(1 -1)" d="${d}"/></svg>`,
    });
  } catch (e) {
    res.status(400).json({ error: String(e.message || e) });
  }
});

// Advance widths + auto kerning for the whole set.
app.post('/api/calculate-metrics', (req, res) => {
  try {
    const { project } = readProject(req.body);
    const font = generateFont(project, { quality: 'preview' });
    const D = derive(project.params, project.metrics);
    const advanceWidths = {};
    for (const g of font.glyphs.values()) if (g.char) advanceWidths[g.char] = g.advance;
    const kerning = {};
    for (const [pair, v] of Object.entries(font.kerning)) {
      const [a, b] = pair.split('|');
      const ca = GLYPH_BY_NAME.get(a)?.char, cb = GLYPH_BY_NAME.get(b)?.char;
      if (ca && cb) kerning[ca + cb] = v;
    }
    res.json({
      advanceWidths,
      kerning,
      zones: { xHeight: D.m.xHeight, capHeight: D.m.capHeight, ascender: D.m.ascender, descender: D.m.descender },
      stem: Math.round(D.stem),
    });
  } catch (e) {
    res.status(400).json({ error: String(e.message || e) });
  }
});

app.post('/api/export-font', async (req, res) => {
  const format = String(req.body?.format || 'ttf').toLowerCase();
  if (!FORMATS.includes(format)) return res.status(400).json({ error: `Format must be one of ${FORMATS.join(', ')}` });
  let payload;
  try {
    const { project, warnings } = readProject(req.body);
    payload = buildExportPayload(project, format);
    if (warnings.length) res.setHeader('X-GenType-Warnings', warnings.slice(0, 5).join(' | '));
  } catch (e) {
    return res.status(400).json({ error: `Could not build the outlines: ${String(e.message || e)}` });
  }
  try {
    const { data, info } = await compileFont(payload);
    const file = `${sanitizeFamilyName(payload.familyName).replace(/\s+/g, '')}-${payload.styleName}.${format}`;
    res.setHeader('Content-Type', {
      ttf: 'font/ttf', otf: 'font/otf', woff: 'font/woff', woff2: 'font/woff2',
    }[format]);
    res.setHeader('Content-Disposition', `attachment; filename="${file}"`);
    res.setHeader('X-GenType-Glyphs', String(payload.glyphs.length));
    res.setHeader('X-GenType-Seconds', String(info.seconds ?? ''));
    res.send(data);
  } catch (e) {
    res.status(500).json({ error: String(e.message || e) });
  }
});

// Static client: the Vite build in production, a pointer to `npm run dev` otherwise.
const dist = path.join(root, 'dist');
if (fs.existsSync(dist)) {
  app.use(express.static(dist, { maxAge: '1h', index: 'index.html' }));
  app.use((req, res, next) => (req.method === 'GET' && !req.path.startsWith('/api') ? res.sendFile(path.join(dist, 'index.html')) : next()));
} else {
  app.get('/', (_req, res) =>
    res.status(200).type('html').send('<h1>GenType API</h1><p>The interface is not built. Run <code>npm run dev</code> for development, or <code>npm run build</code> then <code>npm start</code>.</p>'),
  );
}

app.listen(PORT, () => {
  console.log(`GenType API on http://localhost:${PORT}`);
});
