#!/usr/bin/env node
// The mark is made by the tool: a real letter from a real master, run through
// an operator chain, drawn into a rounded square.
//
//   node scripts/make-icon.mjs C casse
//
// Writes an SVG sized for a favicon and a wordmark alike.

import { spawnSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { runGlyph } from '../shared/ops/chain.js';
import { pathData } from '../shared/ops/render.js';
import { bbox } from '../shared/ops/clip.js';
import { pythonBin } from '../server/compile.js';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const letter = (process.argv[2] || 'C')[0];
const slug = process.argv[3] || 'mark';
const family = process.env.ICON_FAMILY || 'archivo';

const res = spawnSync(pythonBin(), [path.join(root, 'server/python/outline_font.py')], {
  input: JSON.stringify({
    master: path.join(root, 'server/masters', family, 'roman.ttf'),
    axes: { wght: 800, wdth: 100 },
    chars: letter,
    tolerance: 0.8,
  }),
  encoding: 'utf8', maxBuffer: 64 << 20,
});
if (res.status !== 0) { console.error(res.stderr); process.exit(1); }
const data = JSON.parse(res.stdout);

// One slice, offset: the smallest gesture that says "this letter was cut".
const CHAIN = [
  { op: 'fracture', on: true, params: { bands: 2, shift: 0, angle: 0, drift: 110 } },
];

const out = runGlyph(data.glyphs[letter], CHAIN, {
  seed: 1, char: letter, metrics: data.metrics, upm: data.upm,
});

// Fit the letter into a 32-unit square with an optical margin.
const S = 32, M = 6.5;
const b = bbox(out.contours);
const k = Math.min((S - M * 2) / b.w, (S - M * 2) / b.h);
const tx = (S - b.w * k) / 2 - b.x0 * k;
const ty = (S + b.h * k) / 2 + b.y0 * k;

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${S} ${S}">
  <rect width="${S}" height="${S}" rx="7" fill="#7d39eb"/>
  <g transform="translate(${tx.toFixed(2)} ${ty.toFixed(2)}) scale(${k.toFixed(4)} ${(-k).toFixed(4)})" fill="#f4f2ed">
    <path d="${pathData(out.contours)}"/>
  </g>
</svg>`;

const file = path.join(root, 'client/public', `icon-${slug}.svg`);
writeFileSync(file, svg);
console.log(`${slug.padEnd(10)} “${letter}”  ${out.contours.length} contours  →  ${path.relative(root, file)}`);
