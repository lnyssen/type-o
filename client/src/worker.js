// Generation worker: keeps the full 330-glyph rebuild off the UI thread.

import { generateFont } from '../../shared/engine/font.js';

const r = (v) => Math.round(v * 10) / 10;

self.onmessage = ({ data }) => {
  const { id, project } = data;
  const started = performance.now();
  try {
    const font = generateFont(project, { quality: 'preview' });
    const glyphs = [];
    for (const name of font.order) {
      const g = font.glyphs.get(name);
      glyphs.push({
        name: g.name,
        char: g.char,
        kind: g.kind,
        type: g.type,
        group: g.group,
        base: g.base || null,
        kernGroup: g.kernGroup || g.name,
        advance: g.advance,
        lsb: Math.round(g.lsb),
        bbox: g.bbox,
        path: g.contours.map((c) => `M${c.map((p) => `${r(p.x)} ${r(p.y)}`).join('L')}Z`).join(''),
      });
    }
    self.postMessage({
      id,
      ok: true,
      ms: Math.round(performance.now() - started),
      glyphs,
      kerning: font.kerning,
      autoKerning: font.autoKerning,
      zones: {
        xHeight: font.D.m.xHeight,
        capHeight: font.D.m.capHeight,
        ascender: font.D.m.ascender,
        descender: font.D.m.descender,
        stem: Math.round(font.D.stem),
      },
    });
  } catch (error) {
    self.postMessage({ id, ok: false, error: String(error?.message || error) });
  }
};
