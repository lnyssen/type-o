// Outlines → operators → font file, through the real toolchain. Skipped when
// Python or the masters are missing.

import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { rollLegibleChain, runGlyph, legibility } from '../shared/ops/chain.js';
import { buildJob } from '../shared/ops/build.js';
import { pythonBin, pythonStatus } from '../server/compile.js';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const master = path.join(root, 'server/masters/inter/roman.ttf');
const status = await pythonStatus();
const skip = !status.ok ? `Python toolchain unavailable (${status.error || 'not installed'})`
  : !existsSync(master) ? 'Masters not installed (npm run setup:masters)' : false;

function py(script, input) {
  const r = spawnSync(pythonBin(), [path.join(root, 'server/python', script)], { input, maxBuffer: 256 << 20 });
  if (r.status !== 0) throw new Error(r.stderr.toString('utf8').trim());
  return r;
}

const outlines = skip ? null : JSON.parse(py('outline_font.py', JSON.stringify({
  master, axes: { wght: 700, opsz: 20 }, chars: 'AVOgé&1', tolerance: 1.2,
})).stdout.toString('utf8'));

test('a master arrives as real outlines, metrics and kerning', { skip }, () => {
  assert.equal(outlines.upm, 2048);
  assert.ok(outlines.metrics.capHeight > 0 && outlines.metrics.descender < 0);
  assert.equal(Object.keys(outlines.glyphs).length, 7);
  assert.ok(outlines.glyphs.O.contours.length >= 2, 'an O must have a counter');
  assert.ok(outlines.glyphs.A.advance > 0);
  assert.ok(outlines.kerning.AV < 0, 'AV must kern tighter');
  for (const g of Object.values(outlines.glyphs)) {
    assert.ok(g.contours.every((c) => c.length >= 6 && c.every(Number.isFinite)));
  }
});

test('every format builds into a loadable, kerned font', { skip }, () => {
  const chain = rollLegibleChain(31, { glyph: outlines.glyphs.O, char: 'O', metrics: outlines.metrics, upm: outlines.upm });
  const signatures = { ttf: '\0\u0001\0\0', otf: 'OTTO', woff: 'wOFF', woff2: 'wOF2' };
  for (const [format, signature] of Object.entries(signatures)) {
    const job = buildJob(outlines, chain, { seed: 31, familyName: 'Lab Test', styleName: 'Bold', format });
    const out = py('build_font.py', JSON.stringify(job));
    const info = JSON.parse(out.stderr.toString('utf8').trim().split('\n').pop());
    assert.equal(out.stdout.subarray(0, 4).toString('binary'), signature, `${format} signature`);
    assert.equal(info.glyphs, 8, `${format} glyph count (7 + .notdef)`);
    assert.ok(info.kerned, `${format} lost its kerning${info.kernError ? `: ${info.kernError}` : ''}`);
    assert.equal(info.kernError, null);
  }
});

test('the exported geometry is the geometry that was on screen', { skip }, () => {
  const chain = rollLegibleChain(8, { glyph: outlines.glyphs.O, char: 'O', metrics: outlines.metrics, upm: outlines.upm });
  const job = buildJob(outlines, chain, { seed: 8, familyName: 'Lab Test', styleName: 'Bold', format: 'ttf' });
  for (const ch of Object.keys(outlines.glyphs)) {
    const onScreen = runGlyph(outlines.glyphs[ch], chain, { seed: 8, char: ch, metrics: outlines.metrics, upm: outlines.upm });
    const exported = { contours: job.glyphs[ch].contours };
    // Simplification is the only difference, and it must be imperceptible.
    assert.ok(legibility(onScreen, exported) > 0.98, `${ch} drifted on the way out`);
  }
});

test('the builder refuses what it cannot turn into a font', { skip }, () => {
  assert.throws(() => py('build_font.py', JSON.stringify({ upm: 1000, glyphs: {} })), /no glyphs/i);
  assert.throws(() => py('build_font.py', JSON.stringify({ upm: 2, glyphs: { A: { advance: 1, contours: [] } } })), /unit size/i);
});
