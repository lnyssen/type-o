// The operator engine: determinism, validity, and the invariants that keep an
// export sane. Pure geometry, so no font toolchain is needed.

import test from 'node:test';
import assert from 'node:assert/strict';

import { OPERATORS, OPERATOR_BY_ID, defaultParams, normalizeStep } from '../shared/ops/operators.js';
import { runGlyph, rollChain, rollLegibleChain, legibility, parseChain, addStep } from '../shared/ops/chain.js';
import { rect, circle, bbox, area, union, difference, offset } from '../shared/ops/clip.js';
import { simplifyContour } from '../shared/ops/simplify.js';
import { buildJob, countPoints } from '../shared/ops/build.js';
import { layout } from '../shared/ops/render.js';

// An 'O': a square with a real (reverse-wound) hole, plus a detached dot —
// enough shape for every operator to bite on. The hole has to run the other
// way round, exactly as it does in a font, or it is not a hole at all.
const hole = (x0, y0, x1, y1) => [x0, y0, x0, y1, x1, y1, x1, y0];
const makeGlyph = (upm = 1000) => {
  const k = upm / 1000;
  return {
    advance: 600 * k,
    contours: [rect(80 * k, 0, 520 * k, 700 * k), hole(200 * k, 180 * k, 400 * k, 520 * k), circle(300 * k, 820 * k, 60 * k)],
  };
};
const METRICS = { ascender: 800, descender: -200, capHeight: 700, xHeight: 500 };
const ctxFor = (upm) => ({ seed: 7, char: 'O', metrics: METRICS, upm });

const finite = (contours) => contours.every((c) => c.length >= 6 && c.length % 2 === 0 && c.every(Number.isFinite));

test('every operator returns usable outlines at its default and at its extremes', () => {
  for (const op of OPERATORS) {
    for (const where of ['default', 'min', 'max']) {
      const params = defaultParams(op.id);
      for (const spec of op.params) {
        if (spec.type === 'pick') params[spec.key] = spec.options[where === 'min' ? 0 : spec.options.length - 1];
        else if (where !== 'default') params[spec.key] = spec[where];
      }
      const out = runGlyph(makeGlyph(), [{ op: op.id, on: true, params }], ctxFor(1000));
      assert.ok(finite(out.contours), `${op.id} @${where} produced broken contours`);
      assert.ok(Number.isFinite(out.advance) && out.advance >= 0, `${op.id} @${where} broke the advance`);
    }
  }
});

test('a muted step changes nothing, and an unknown step is dropped', () => {
  const glyph = makeGlyph();
  const base = runGlyph(glyph, [], ctxFor(1000));
  const muted = runGlyph(glyph, [{ op: 'melt', on: false, params: defaultParams('melt') }], ctxFor(1000));
  assert.deepEqual(muted.contours, base.contours);
  assert.equal(normalizeStep({ op: 'nope' }), null);
  assert.equal(parseChain([{ op: 'swell' }, { op: 'nope' }, 42]).length, 1);
  assert.equal(parseChain('not a chain').length, 0);
});

test('the same seed always gives the same letter, a different one does not', () => {
  const chain = rollChain(123);
  const a = runGlyph(makeGlyph(), chain, { ...ctxFor(1000), seed: 5 });
  const b = runGlyph(makeGlyph(), chain, { ...ctxFor(1000), seed: 5 });
  const c = runGlyph(makeGlyph(), chain, { ...ctxFor(1000), seed: 6 });
  assert.deepEqual(a.contours, b.contours, 'same seed must be reproducible');
  const jittery = [{ op: 'jitter', on: true, params: { amount: 60, scale: 150 } }];
  const j5 = runGlyph(makeGlyph(), jittery, { ...ctxFor(1000), seed: 5 });
  const j6 = runGlyph(makeGlyph(), jittery, { ...ctxFor(1000), seed: 6 });
  assert.notDeepEqual(j5.contours, j6.contours, 'a new seed must give new accidents');
  assert.ok(c);
});

test('settings are per-mille of the em, so a 2000-upm master looks the same', () => {
  const chain = [
    { op: 'swell', on: true, params: { amount: 40, join: 'round' } },
    { op: 'fracture', on: true, params: { bands: 5, shift: 100, angle: 0, drift: 0 } },
  ];
  const small = runGlyph(makeGlyph(1000), chain, ctxFor(1000));
  const large = runGlyph(makeGlyph(2000), chain, ctxFor(2000));
  const a = bbox(small.contours), b = bbox(large.contours);
  // The big one should be twice the small one, within a unit of rounding.
  assert.ok(Math.abs(b.w / a.w - 2) < 0.02, `width ratio ${b.w / a.w}`);
  assert.ok(Math.abs(b.h / a.h - 2) < 0.02, `height ratio ${b.h / a.h}`);
});

test('echo keeps its copies inside the glyph cell', () => {
  const glyph = makeGlyph();
  for (const dx of [-80, 80]) {
    const out = runGlyph(glyph, [{ op: 'echo', on: true, params: { count: 6, dx, dy: 0, shrink: 0, merge: 'solid' } }], ctxFor(1000));
    const box = bbox(out.contours);
    assert.ok(box.x0 >= -1, `copies spilled left of the origin (${box.x0})`);
    assert.ok(box.x1 <= out.advance + 1, `copies spilled past the advance (${box.x1} > ${out.advance})`);
  }
});

test('a rolled chain stays readable, and reports when it cannot', () => {
  const probe = { glyph: makeGlyph(), char: 'O', metrics: METRICS, upm: 1000 };
  for (let seed = 0; seed < 25; seed++) {
    const chain = rollLegibleChain(seed, probe, { min: 0.28 });
    assert.ok(chain.length >= 2, 'a roll should stack at least two operators');
    const score = legibility(probe.glyph, runGlyph(probe.glyph, chain, { ...ctxFor(1000), seed }));
    assert.ok(score >= 0.28, `seed ${seed} rolled an unreadable chain (${score.toFixed(2)}): ${chain.map((s) => s.op).join(' → ')}`);
  }
});

test('legibility is 1 for an untouched letter and low for a scattered one', () => {
  const glyph = makeGlyph();
  assert.ok(legibility(glyph, glyph) > 0.99);
  const scattered = runGlyph(glyph, [{ op: 'shatter', on: true, params: { cells: 6, shift: 180, turn: 35, spread: 160 } }], ctxFor(1000));
  assert.ok(legibility(glyph, scattered) < 0.4);
});

test('simplify keeps the shape it is given', () => {
  const c = circle(0, 0, 300, 200);
  const simple = simplifyContour(c, 1);
  assert.ok(simple.length < c.length, 'nothing was removed');
  const before = area([c]), after = area([simple]);
  assert.ok(Math.abs(after / before - 1) < 0.01, `area drifted by ${(after / before - 1) * 100}%`);
});

test('polygon algebra does what the operators assume', () => {
  const square = [rect(0, 0, 100, 100)];
  assert.equal(Math.round(area(union(square, [rect(50, 0, 150, 100)]))), 15000);
  assert.equal(Math.round(area(difference(square, [rect(0, 0, 50, 100)]))), 5000);
  assert.ok(bbox(offset(square, 10)).w > 119 && bbox(offset(square, -10)).w < 81);
  assert.deepEqual(bbox([]), { x0: 0, y0: 0, x1: 0, y1: 0, w: 0, h: 0 });
});

test('a build job is integers, with advances and kerning intact', () => {
  const data = { upm: 2048, metrics: METRICS, glyphs: { O: makeGlyph(2048), A: makeGlyph(2048) }, kerning: { OA: -80 } };
  const chain = [{ op: 'swell', on: true, params: { amount: 30, join: 'round' } }];
  const job = buildJob(data, chain, { seed: 3, tracking: 50, familyName: 'Test', styleName: 'Bold', format: 'ttf' });
  assert.equal(job.upm, 2048);
  assert.deepEqual(job.kerning, { OA: -80 });
  for (const [ch, g] of Object.entries(job.glyphs)) {
    assert.ok(Number.isInteger(g.advance) && g.advance > 0, `${ch} advance`);
    assert.ok(g.contours.every((c) => c.every(Number.isInteger)), `${ch} must be integer units`);
    assert.ok(finite(g.contours), `${ch} contours`);
  }
  // tracking is per-mille of the em too
  assert.equal(job.glyphs.O.advance, Math.round(makeGlyph(2048).advance + 50 * 2.048));
  assert.ok(countPoints(job).points > 10);
});

test('layout applies kerning and tracking between the right pairs', () => {
  const glyphs = { A: { advance: 500, contours: [] }, V: { advance: 500, contours: [] } };
  const { items, width } = layout('AVA', glyphs, { kerning: { AV: -100 }, tracking: 10 });
  assert.deepEqual(items.map((i) => i.x), [0, 410, 920]);
  assert.equal(width, 1420);  // the last advance counts, the trailing tracking does not
});

test('adding a step gives it its defaults', () => {
  const chain = addStep(addStep([], 'swell'), 'melt');
  assert.deepEqual(chain.map((s) => s.op), ['swell', 'melt']);
  assert.deepEqual(chain[0].params, defaultParams('swell'));
  assert.ok(OPERATOR_BY_ID.get('melt').params.every((p) => p.key in chain[1].params));
});
