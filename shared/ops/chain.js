// Running a chain, and rolling a new one.
//
// A chain is an ordered list of steps; order is the whole point, since Ring
// after Halftone draws hollow dots and Halftone after Ring samples a rim.
// Everything is a pure function of (outlines, chain, seed), so the same roll
// always gives back the same typeface.

import { OPERATORS, OPERATOR_BY_ID, STAGES, defaultParams, normalizeStep, scaleParams } from './operators.js';
import { clean, bbox, area, intersect, difference } from './clip.js';
import { hashString, rng } from './noise.js';

export function makeContext({ seed, char, metrics, upm }) {
  const base = hashString(char, seed >>> 0);
  return {
    seed, char, metrics, upm,
    unit: (upm || 1000) / 1000,
    seedFor: (tag) => hashString(tag, base),
    random: (tag) => rng(hashString(tag, base)),
  };
}

export function runChain(glyph, chain, ctx) {
  let out = glyph;
  for (const step of chain) {
    if (!step?.on) continue;
    const op = OPERATOR_BY_ID.get(step.op);
    if (!op) continue;
    try {
      const next = op.apply(out, scaleParams(op.id, step.params, ctx.unit), ctx);
      // An operator that erases the letter has gone too far: keep what worked.
      if (next?.contours?.length) out = next;
    } catch { /* one bad step never breaks the specimen */ }
  }
  return out;
}

export function runGlyph(glyph, chain, { seed, char, metrics, upm, tidy = true }) {
  const ctx = makeContext({ seed, char, metrics, upm });
  const out = runChain(glyph, chain, ctx);
  return tidy ? { ...out, contours: clean(out.contours, 0.5, 6) } : out;
}

export const emptyChain = () => [];

export function addStep(chain, id) {
  return [...chain, { op: id, on: true, params: defaultParams(id) }];
}

export function parseChain(input) {
  return (Array.isArray(input) ? input : []).map(normalizeStep).filter(Boolean).slice(0, 8);
}

// --- legibility ----------------------------------------------------------

// How much of the letter is still where the eye expects it. `keep` is the
// original ink the chain left in place; `spill` is ink it put everywhere else,
// which is what turns an echo or an explosion into a texture.
export function legibility(original, result) {
  const base = area(original.contours);
  if (!base) return 1;
  const keep = area(intersect(result.contours, original.contours)) / base;
  const spill = area(difference(result.contours, original.contours)) / base;
  return keep - 0.35 * spill;
}

// --- rolling -------------------------------------------------------------

// Triangular around the default: exploratory, but rarely absurd.
function rollValue(spec, rand) {
  if (spec.type === 'pick') return spec.options[Math.floor(rand() * spec.options.length)];
  // `roll` is the range where an operator actually says something; outside it
  // the setting is either invisible or pure mush.
  const [lo, hi] = spec.roll || [spec.min, spec.max];
  const value = lo + (hi - lo) * (0.5 * (rand() + rand()));  // soft centre, real extremes
  return spec.step >= 1 ? Math.round(value) : Math.round(value * 100) / 100;
}

// Two of these in one chain is mush, so a roll never takes both.
const HEAVY = new Set(['halftone', 'invert', 'shatter']);

// A roll that keeps the word readable: chains are drawn until one survives the
// legibility test on a probe glyph, so "Roll" never hands back a texture.
export function rollLegibleChain(seed, probe, { min = 0.28, tries = 20, length } = {}) {
  let best = null;
  for (let i = 0; i < tries; i++) {
    const chain = rollChain(seed + i * 7919, { length });
    if (!probe?.glyph) return chain;
    const out = runGlyph(probe.glyph, chain, { seed, char: probe.char || 'R', metrics: probe.metrics, upm: probe.upm });
    const score = legibility(probe.glyph, out);
    if (score >= min) return chain;
    if (!best || score > best.score) best = { chain, score };
  }
  return best.chain;
}

export function rollChain(seed, { length } = {}) {
  const rand = rng(hashString('chain', seed >>> 0));
  const pool = OPERATORS.map((o) => o.id);
  const count = length ?? 2 + Math.floor(rand() * 2.6);
  const chosen = [];
  while (chosen.length < count && pool.length) {
    const id = pool.splice(Math.floor(rand() * pool.length), 1)[0];
    if (HEAVY.has(id) && chosen.some((c) => HEAVY.has(c))) continue;
    chosen.push(id);
  }
  return chosen
    .sort((a, b) => STAGES.indexOf(OPERATOR_BY_ID.get(a).stage) - STAGES.indexOf(OPERATOR_BY_ID.get(b).stage))
    .map((id) => {
      const op = OPERATOR_BY_ID.get(id);
      const stepRand = rng(hashString(id, seed >>> 0));
      return { op: id, on: true, params: Object.fromEntries(op.params.map((p) => [p.key, rollValue(p, stepRand)])) };
    });
}

export { bbox };
