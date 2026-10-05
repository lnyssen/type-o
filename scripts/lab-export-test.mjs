#!/usr/bin/env node
// Outlines → operator chain → real font file, straight through, so the export
// path can be checked without a browser.
import { spawnSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { rollLegibleChain } from '../shared/ops/chain.js';
import { buildJob, countPoints } from '../shared/ops/build.js';
import { pythonBin } from '../server/compile.js';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const py = (script, input) => {
  const r = spawnSync(pythonBin(), [path.join(root, 'server/python', script)], { input, maxBuffer: 256 << 20 });
  if (r.status !== 0) { console.error(r.stderr.toString()); process.exit(1); }
  return r;
};

const CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789 .,:;!?&@€-–—«»ÀÉÈÇÔàéèçôüñ';
const res = py('outline_font.py', JSON.stringify({
  master: path.join(root, 'server/masters/inter/roman.ttf'),
  axes: { wght: 700, opsz: 32 }, chars: CHARS, tolerance: 1.2,
}));
const data = JSON.parse(res.stdout.toString('utf8'));

const seed = Number(process.argv[2] || 4242);
const chain = rollLegibleChain(seed, { glyph: data.glyphs.R, char: 'R', metrics: data.metrics, upm: data.upm });
console.log('chain:', chain.map((s) => s.op).join(' → '));

for (const format of ['ttf', 'otf', 'woff2']) {
  const job = buildJob(data, chain, { seed, familyName: 'Rafale Lab', styleName: 'Bold', format, note: 'Built by TYPE-O from Inter (OFL 1.1).' });
  if (format === 'ttf') console.log('geometry:', countPoints(job));
  const out = py('build_font.py', JSON.stringify(job));
  const info = JSON.parse(out.stderr.toString('utf8').trim().split('\n').pop());
  const file = path.join(root, 'client/public', `rafale-lab.${format}`);
  writeFileSync(file, out.stdout);
  console.log(`${format}: ${(out.stdout.length / 1024).toFixed(0)} KB · ${info.glyphs} glyphs · ${info.kernPairs} kern pairs · ${info.seconds}s`);
}
