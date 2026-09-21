// Builds the compiler payload: export-quality outlines fitted to Béziers,
// vertical metrics, class kerning and ligatures. The Python side
// (server/python/build_font.py) only removes overlaps and writes the binary.

import { generateFont, LIGATURES, GLYPHS } from './font.js';
import { fitContour } from './fit.js';
import { styleFor, UPM } from './params.js';

export const FORMATS = ['ttf', 'otf', 'woff', 'woff2'];

const r2 = (v) => Math.round(v * 100) / 100;

export function sanitizeFamilyName(name) {
  const clean = String(name || '').replace(/[^\p{L}\p{N} \-]/gu, '').replace(/\s+/g, ' ').trim().slice(0, 48);
  return clean || 'Untitled';
}

function contourToPayload(poly) {
  const fitted = fitContour(poly);
  if (!fitted) return null;
  return {
    start: [r2(fitted.start.x), r2(fitted.start.y)],
    segs: fitted.segs.map((s) =>
      s.type === 'L' ? ['L', r2(s.to.x), r2(s.to.y)] : ['C', r2(s.c1.x), r2(s.c1.y), r2(s.c2.x), r2(s.c2.y), r2(s.to.x), r2(s.to.y)],
    ),
  };
}

export function buildExportPayload(project, format) {
  if (!FORMATS.includes(format)) throw new Error(`Unsupported format "${format}"`);
  const font = generateFont(project, { quality: 'export' });
  const { D } = font;
  const family = sanitizeFamilyName(project.name);
  const { styleName, weightClass } = styleFor(project.params);

  const glyphs = font.order.map((name) => {
    const g = font.glyphs.get(name);
    return {
      name,
      unicodes: g.unicodes,
      advance: Math.max(0, Math.round(g.advance)),
      contours: g.contours.map(contourToPayload).filter(Boolean),
    };
  });

  // Class kerning: every glyph kerns like its group representative.
  const members = new Map();
  for (const name of font.order) {
    const g = font.glyphs.get(name);
    const rep = g.kernGroup || name;
    if (!members.has(rep)) members.set(rep, []);
    members.get(rep).push(name);
  }
  const used = new Set();
  const pairs = [];
  for (const [key, value] of Object.entries(font.kerning)) {
    const [a, b] = key.split('|');
    if (!members.has(a) || !members.has(b) || !value) continue;
    used.add(a).add(b);
    pairs.push([a, b, Math.round(value)]);
  }
  const classes = {};
  for (const rep of used) classes[rep] = members.get(rep);

  const names = new Set(font.order);
  const ligatures = LIGATURES.filter(([lig, parts]) => names.has(lig) && parts.every((p) => names.has(p)));

  return {
    format,
    upm: UPM,
    familyName: family,
    styleName,
    weightClass,
    widthClass: { condensed: 3, normal: 5, expanded: 7 }[D.p.width],
    version: project.version || '1.0',
    ascender: D.m.ascender,
    descender: D.m.descender,
    xHeight: D.m.xHeight,
    capHeight: D.m.capHeight,
    overshoot: D.overshoot,
    stem: Math.round(D.stem),
    italicAngle: 0,
    glyphs,
    kerning: { classes, pairs },
    ligatures,
  };
}

export const GLYPH_COUNT = GLYPHS.length;
