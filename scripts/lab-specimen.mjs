#!/usr/bin/env node
// Rolls a few chains and renders them to one SVG sheet, so the operators can
// be judged by eye instead of by description.
//
//   node scripts/lab-specimen.mjs [word] [out.svg] [count]

import { spawnSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { rollLegibleChain, runGlyph, legibility } from '../shared/ops/chain.js';
import { lineSvg } from '../shared/ops/render.js';
import { pythonBin } from '../server/compile.js';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const word = process.argv[2] || 'Rafale';
const out = process.argv[3] || 'client/public/lab.svg';  // served at /lab.html by `npm run dev`
const count = Number(process.argv[4] || 8);
const family = process.env.LAB_FAMILY || 'inter';

const job = JSON.stringify({
  master: path.join(root, 'server/masters', family, 'roman.ttf'),
  axes: { wght: 700, opsz: 32 },
  chars: word,
  tolerance: 1.2,
});
const res = spawnSync(pythonBin(), [path.join(root, 'server/python/outline_font.py')], { input: job, encoding: 'utf8', maxBuffer: 64 << 20 });
if (res.status !== 0) { console.error(res.stderr); process.exit(1); }
const data = JSON.parse(res.stdout);
const scale = 1000 / data.upm;

const rows = [];
for (let i = 0; i < count; i++) {
  const seed = 1000 + i * 137;
  const probe = { glyph: data.glyphs[[...word][0]], char: [...word][0], metrics: data.metrics, upm: data.upm };
  const chain = rollLegibleChain(seed, probe);
  const glyphs = {};
  let ms = -performance.now();
  for (const [ch, glyph] of Object.entries(data.glyphs)) {
    glyphs[ch] = runGlyph(glyph, chain, { seed, char: ch, metrics: data.metrics, upm: data.upm });
  }
  ms += performance.now();
  const { body, box } = lineSvg(word, glyphs, { kerning: data.kerning });
  const score = legibility(probe.glyph, glyphs[probe.char]);
  rows.push({ body, box, chain, ms, score });
  console.log(`${String(i).padStart(2)} ${Math.round(ms).toString().padStart(4)}ms  score ${score.toFixed(2).padStart(6)}  ${chain.map((s) => s.op).join(' \u2192 ')}`);
}

// One <svg> per row, each with a viewBox tight to its own ink: the browser
// does the scaling, so no row can ever collide with another.
const M = 0.04;
const cards = rows.map((row) => {
  const b = row.box;
  const mx = Math.max(1, b.w) * M, my = Math.max(1, b.h) * M;
  const vb = `${(b.x0 - mx).toFixed(1)} ${(-b.y1 - my).toFixed(1)} ${(b.w + mx * 2).toFixed(1)} ${(b.h + my * 2).toFixed(1)}`;
  return `<figure><svg viewBox="${vb}" preserveAspectRatio="xMidYMid meet">` +
    `<g transform="scale(1 -1)" fill="#f4f2ed">${row.body}</g></svg>` +
    `<figcaption>${row.chain.map((s) => s.op).join(' \u2192 ')} <i>${Math.round(row.ms)} ms \u00b7 score ${row.score.toFixed(2)}</i></figcaption></figure>`;
}).join('\n');

writeFileSync(out.replace(/\.svg$/, '.html'), `<!doctype html><meta charset=utf-8><title>lab</title>
<style>
  :root { color-scheme: dark }
  body { margin:0; background:#1e1e1e; color:#f4f2ed; font:13px ui-monospace,monospace }
  figure { margin:0; border-bottom:1px solid rgba(244,242,237,.12); padding:26px 40px 10px }
  svg { display:block; width:100%; max-height:30vh }
  figcaption { color:#b08cff; padding-top:10px; letter-spacing:.08em }
  i { color:#6f6c67; font-style:normal }
</style>
${cards}`);
console.log(`\n\u2192 ${out.replace(/\.svg$/, '.html')}`);
