#!/usr/bin/env node
// Renders a specimen sheet straight from the engine — handy for the README,
// for eyeballing a parameter change, or for diffing two settings.
//
//   node scripts/specimen.mjs [out.svg] ['{"weight":70,"contrast":60}']

import { writeFileSync } from 'node:fs';
import { generateFont, GLYPH_BY_CHAR } from '../shared/engine/font.js';

const out = process.argv[2] || 'specimen.svg';
const params = JSON.parse(process.argv[3] || '{}');

const ROWS = [
  { text: 'GenType', size: 150, params: { ...params } },
  { text: 'Hamburgefonts 0123', size: 74, params: { ...params, weight: 20 } },
  { text: 'Hamburgefonts 0123', size: 74, params: { ...params, weight: 55, serifMode: true, contrast: 55 } },
  { text: 'Hamburgefonts 0123', size: 74, params: { ...params, weight: 92, terminals: 'rounded', contrast: 0 } },
  { text: 'Voix ambiguë d’un cœur qui au zéphyr préfère les jattes de kiwis.', size: 34, params },
  { text: 'Příliš žluťoučký kůň — ĄĆĘŁŃÓŚŹŻ ąćęłńóśźż — AVATAR Toy office waffle', size: 34, params },
];

const em = 1000;
let body = '';
let y = 30;
let width = 0;

for (const row of ROWS) {
  const font = generateFont({ params: row.params, metrics: {}, skeletons: {} });
  const scale = row.size / em;
  let x = 0;
  let prev = null;
  let line = '';
  for (const ch of row.text) {
    const meta = GLYPH_BY_CHAR.get(ch);
    const g = meta && font.glyphs.get(meta.name);
    if (!g) continue;
    if (prev) x += font.kerning[`${prev.kernGroup || prev.name}|${g.kernGroup || g.name}`] || 0;
    if (g.contours.length) {
      const d = g.contours.map((c) => `M${c.map((p) => `${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join('L')}Z`).join('');
      line += `<path transform="translate(${x.toFixed(1)} 0)" d="${d}"/>`;
    }
    x += g.advance;
    prev = g;
  }
  y += row.size;
  // Font units, y up: flip the whole row into page space at its baseline.
  body += `<g transform="translate(30 ${y.toFixed(1)}) scale(${scale} ${-scale})" fill="#f4f2ed" fill-rule="nonzero">${line}</g>`;
  y += row.size * 0.45;
  width = Math.max(width, x * scale + 60);
}

writeFileSync(out, `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${Math.round(width)} ${Math.round(y + 20)}" width="${Math.round(width)}" height="${Math.round(y + 20)}"><rect width="100%" height="100%" fill="#1e1e1e"/>${body}</svg>`);
console.log(`${out} — ${Math.round(width)}×${Math.round(y + 20)}`);
