// The operator library. Each one takes a glyph — {advance, contours} in font
// units — and returns a new one. They are pure, seeded and order-dependent:
// stacking them is where the typefaces nobody has come from.
//
// `stage` orders a random chain: cut the shape, then work its surface, then
// finish. `ctx` carries the metrics so an operator can reason about the
// baseline and the cap height instead of raw numbers.

import { union, difference, intersect, offset, clean, rect, circle, bbox, area, warp, translate, rotate } from './clip.js';
import { noise2D, hashString, rng } from './noise.js';

// `em: true` means the value is in thousandths of an em, so the same setting
// looks identical on a 1000-upm master and on a 2048-upm one. runChain scales
// them before an operator ever sees them.
// `off` is the value at which the parameter does nothing: the animation ramps
// from there to the setting, so a chain can be played from an intact letter.
const num = (key, label, min, max, def, { step = 1, hint = '', em = false, roll, off } = {}) =>
  ({ key, label, min, max, default: def, step, hint, em, roll, off });
const pick = (key, label, options, def, hint = '') => ({ key, label, options, default: def, hint, type: 'pick' });

// A rectangle big enough to cover the glyph whatever we rotate it by.
const canvas = (box, pad = 0) => {
  const r = Math.hypot(box.w, box.h) / 2 + pad;
  const cx = (box.x0 + box.x1) / 2, cy = (box.y0 + box.y1) / 2;
  return { cx, cy, r };
};

export const OPERATORS = [
  {
    id: 'fracture',
    name: 'Fracture',
    stage: 'cut',
    blurb: 'Slices the letter into bands and slides each one sideways.',
    params: [
      num('bands', 'Bands', 2, 24, 7, { roll: [3, 14] }),
      num('shift', 'Shift', 0, 400, 120, { em: true, hint: 'How far a band can slide', roll: [40, 300] , off: 0 }),
      num('angle', 'Angle', -75, 75, 0, { hint: 'Direction of the cuts' }),
      num('drift', 'Drift', 0, 200, 0, { em: true, hint: 'Pull every band the same way', roll: [0, 120] , off: 0 }),
    ],
    apply(glyph, p, ctx) {
      if (p.bands < 2 || (!p.shift && !p.drift)) return glyph;
      const rad = (p.angle * Math.PI) / 180;
      const box = bbox(glyph.contours);
      const { cx, cy, r } = canvas(box);
      const upright = rotate(glyph.contours, -rad, cx, cy);
      const span = bbox(upright);
      const random = ctx.random('fracture');
      const out = [];
      for (let i = 0; i < p.bands; i++) {
        const y0 = span.y0 + (span.h * i) / p.bands;
        const y1 = span.y0 + (span.h * (i + 1)) / p.bands;
        const band = intersect(upright, [rect(cx - r, y0, cx + r, y1 + 0.5)]);
        if (!band.length) continue;
        const dx = (random() * 2 - 1) * p.shift + ((i / Math.max(1, p.bands - 1)) * 2 - 1) * p.drift;
        out.push(...translate(band, dx, 0));
      }
      return { ...glyph, contours: rotate(union(out), rad, cx, cy) };
    },
  },
  {
    id: 'shatter',
    name: 'Shatter',
    stage: 'cut',
    blurb: 'Breaks the letter on a grid and nudges every shard off its place.',
    params: [
      num('cells', 'Grid', 2, 14, 5, { roll: [3, 8] }),
      num('shift', 'Shift', 0, 200, 50, { em: true, roll: [20, 120] , off: 0 }),
      num('turn', 'Turn', 0, 40, 10, { hint: 'Degrees each shard may rotate', roll: [2, 25] , off: 0 }),
      num('spread', 'Spread', 0, 200, 0, { em: true, hint: 'Push shards away from the centre', roll: [0, 90] , off: 0 }),
    ],
    apply(glyph, p, ctx) {
      const box = bbox(glyph.contours);
      if (!box.w || p.cells < 2) return glyph;
      const random = ctx.random('shatter');
      const cx = (box.x0 + box.x1) / 2, cy = (box.y0 + box.y1) / 2;
      const out = [];
      for (let i = 0; i < p.cells; i++) {
        for (let j = 0; j < p.cells; j++) {
          const x0 = box.x0 + (box.w * i) / p.cells, x1 = box.x0 + (box.w * (i + 1)) / p.cells;
          const y0 = box.y0 + (box.h * j) / p.cells, y1 = box.y0 + (box.h * (j + 1)) / p.cells;
          const cell = intersect(glyph.contours, [rect(x0 - 0.5, y0 - 0.5, x1 + 0.5, y1 + 0.5)]);
          if (!cell.length) continue;
          const mx = (x0 + x1) / 2, my = (y0 + y1) / 2;
          const away = Math.hypot(mx - cx, my - cy) || 1;
          const push = p.spread / 100;
          let shard = translate(cell,
            (random() * 2 - 1) * p.shift + ((mx - cx) / away) * p.spread,
            (random() * 2 - 1) * p.shift + ((my - cy) / away) * p.spread * 0.6);
          if (p.turn) shard = rotate(shard, (((random() * 2 - 1) * p.turn) * Math.PI) / 180, mx + push, my);
          out.push(...shard);
        }
      }
      return { ...glyph, contours: union(out) };
    },
  },
  {
    id: 'stencil',
    name: 'Stencil',
    stage: 'cut',
    blurb: 'Cuts stripes out of the letter. Wide gaps break it into fragments.',
    params: [
      num('width', 'Bar', 4, 300, 40, { em: true, hint: 'What stays', roll: [15, 120] }),
      num('gap', 'Cut', 4, 300, 30, { em: true, hint: 'What is removed', roll: [15, 120] , off: 4 }),
      num('angle', 'Angle', -90, 90, 0),
      num('phase', 'Offset', 0, 100, 0),
    ],
    apply(glyph, p) {
      const box = bbox(glyph.contours);
      if (!box.w || !p.gap) return glyph;
      const rad = (p.angle * Math.PI) / 180;
      const { cx, cy, r } = canvas(box, 20);
      const pitch = p.width + p.gap;
      const bars = [];
      const start = cy - r + ((p.phase / 100) * pitch);
      for (let y = start; y < cy + r; y += pitch) bars.push(rect(cx - r, y, cx + r, y + p.gap));
      return { ...glyph, contours: difference(glyph.contours, rotate(bars, rad, cx, cy)) };
    },
  },
  {
    id: 'invert',
    name: 'Invert',
    stage: 'cut',
    blurb: 'Knocks the letter out of a solid block instead of drawing it.',
    params: [
      num('padding', 'Padding', -40, 400, 60, { em: true, roll: [20, 200] }),
      num('round', 'Rounding', 0, 300, 0, { em: true, roll: [0, 120] }),
    ],
    apply(glyph, p, ctx) {
      const box = bbox(glyph.contours);
      if (!box.w) return glyph;
      const x0 = -p.padding * 0.4, x1 = glyph.advance + p.padding * 0.4;
      const y0 = ctx.metrics.descender - p.padding * 0.2, y1 = ctx.metrics.capHeight + p.padding * 0.4;
      let block = [rect(x0, y0, x1, y1)];
      if (p.round) block = offset(offset(block, -p.round), p.round);
      return { ...glyph, contours: difference(block, glyph.contours) };
    },
  },
  {
    id: 'swell',
    name: 'Swell',
    stage: 'mass',
    blurb: 'Inflates the letter until counters close, or starves it to a thread.',
    params: [
      num('amount', 'Amount', -120, 200, 25, { em: true, hint: 'Negative starves the strokes', roll: [-60, 90] , off: 0 }),
      pick('join', 'Corners', ['round', 'sharp'], 'round'),
    ],
    apply(glyph, p) {
      const grown = offset(glyph.contours, p.amount, { round: p.join === 'round' });
      return { ...glyph, contours: clean(grown) };
    },
  },
  {
    id: 'ring',
    name: 'Ring',
    stage: 'surface',
    blurb: 'Keeps only the rim: an outline or an inline face.',
    params: [
      num('weight', 'Weight', 2, 160, 24, { em: true, roll: [8, 60] }),
      num('position', 'Position', -100, 100, 0, { hint: 'Inside the stroke, on it, or around it' }),
    ],
    apply(glyph, p) {
      const centre = (p.position / 100) * p.weight;
      const outer = offset(glyph.contours, centre + p.weight / 2);
      const inner = offset(glyph.contours, centre - p.weight / 2);
      return { ...glyph, contours: clean(difference(outer, inner)) };
    },
  },
  {
    id: 'echo',
    name: 'Echo',
    stage: 'surface',
    blurb: 'Repeats the letter in one direction — extrusion, shadow or smear.',
    params: [
      num('count', 'Copies', 1, 16, 5, { roll: [2, 9] , off: 1 }),
      num('dx', 'Step X', -200, 200, 26, { em: true, roll: [-90, 90] }),
      num('dy', 'Step Y', -200, 200, -26, { em: true, roll: [-90, 90] }),
      num('shrink', 'Shrink', -60, 60, 0, { em: true, hint: 'Each copy thinner or fatter', roll: [-20, 20] }),
      pick('merge', 'Merge', ['solid', 'separate'], 'solid'),
    ],
    apply(glyph, p) {
      const parts = [];
      for (let i = p.count; i >= 1; i--) {
        const step = offset(glyph.contours, (p.shrink * i) / 2);
        if (step.length) parts.push(...translate(step, p.dx * i, p.dy * i));
      }
      parts.push(...glyph.contours);
      let contours = p.merge === 'solid' ? union(parts) : parts;
      // Copies must stay inside the glyph's own cell, or they trample the
      // letter next door: reserve the room they need on both sides.
      const left = Math.max(0, -p.dx * p.count);
      if (left) contours = translate(contours, left, 0);
      const reach = Math.max(0, p.dx * p.count);
      return { ...glyph, contours, advance: glyph.advance + reach + left };
    },
  },
  {
    id: 'halftone',
    name: 'Halftone',
    stage: 'surface',
    blurb: 'Rebuilds the letter out of a grid of dots or squares.',
    params: [
      num('cell', 'Cell', 12, 300, 70, { em: true, roll: [25, 130] }),
      num('threshold', 'Threshold', 5, 95, 40, { hint: 'How much ink a cell needs to survive', roll: [20, 60] }),
      pick('shape', 'Shape', ['circle', 'square', 'diamond'], 'circle'),
      num('grow', 'Size', 20, 180, 100, { hint: 'Dot size against its cell', roll: [70, 150] }),
      pick('mode', 'Size by', ['coverage', 'fixed'], 'coverage'),
    ],
    apply(glyph, p, ctx) {
      const box = bbox(glyph.contours);
      if (!box.w || !box.h) return glyph;
      const cell = Math.max(8, p.cell);
      const cols = Math.ceil(box.w / cell) + 1, rows = Math.ceil(box.h / cell) + 1;
      if (cols * rows > 6000) return glyph; // a cell that fine is a rasteriser, not a typeface
      const cellArea = cell * cell;
      const min = (p.threshold / 100) * cellArea;
      const out = [];
      for (let j = 0; j < rows; j++) {
        const y0 = box.y0 + j * cell;
        // Clip one row first: every cell in it then intersects a much simpler shape.
        const row = intersect(glyph.contours, [rect(box.x0 - cell, y0, box.x1 + cell, y0 + cell)]);
        if (!row.length) continue;
        for (let i = 0; i < cols; i++) {
          const x0 = box.x0 + i * cell;
          const ink = area(intersect(row, [rect(x0, y0, x0 + cell, y0 + cell)]));
          if (ink < min) continue;
          const cover = p.mode === 'coverage' ? Math.min(1, ink / cellArea) : 1;
          const r = (cell / 2) * (p.grow / 100) * Math.sqrt(cover);
          const cx = x0 + cell / 2, cy = y0 + cell / 2;
          if (p.shape === 'circle') out.push(circle(cx, cy, r, 20));
          else if (p.shape === 'diamond') out.push([cx, cy - r, cx + r, cy, cx, cy + r, cx - r, cy]);
          else out.push(rect(cx - r, cy - r, cx + r, cy + r));
        }
      }
      return { ...glyph, contours: union(out) };
    },
  },
  {
    id: 'jitter',
    name: 'Jitter',
    stage: 'finish',
    blurb: 'Pushes every point through a noise field. Low frequency warps, high frequency frays.',
    params: [
      num('amount', 'Amount', 0, 200, 40, { em: true, roll: [15, 110] , off: 0 }),
      num('scale', 'Scale', 20, 800, 200, { em: true, hint: 'Size of the ripples', roll: [40, 400] }),
    ],
    apply(glyph, p, ctx) {
      if (!p.amount) return glyph;
      const nx = noise2D(ctx.seedFor('jitter-x'), p.scale);
      const ny = noise2D(ctx.seedFor('jitter-y'), p.scale);
      return { ...glyph, contours: warp(glyph.contours, (x, y) => [x + nx(x, y) * p.amount, y + ny(x, y) * p.amount]) };
    },
  },
  {
    id: 'melt',
    name: 'Melt',
    stage: 'finish',
    blurb: 'Lets the letter sag: the closer to the baseline, the further it drips.',
    params: [
      num('amount', 'Amount', 0, 400, 90, { em: true, roll: [60, 260] , off: 0 }),
      num('width', 'Width', 20, 500, 120, { em: true, hint: 'Width of a drip', roll: [50, 300] }),
      num('anchor', 'Anchor', 0, 100, 70, { hint: 'How much of the top stays put' }),
    ],
    apply(glyph, p, ctx) {
      if (!p.amount) return glyph;
      const n = noise2D(ctx.seedFor('melt'), p.width);
      const top = ctx.metrics.capHeight || 700;
      const anchor = p.anchor / 100;
      return {
        ...glyph,
        contours: warp(glyph.contours, (x, y) => {
          const t = Math.max(0, Math.min(1, 1 - y / (top * (0.2 + anchor))));
          return [x, y - (0.35 + 0.65 * n(x, y * 0.25)) * p.amount * t * t];
        }),
      };
    },
  },
];

export const OPERATOR_BY_ID = new Map(OPERATORS.map((o) => [o.id, o]));
export const STAGES = ['mass', 'cut', 'surface', 'finish'];

export function defaultParams(id) {
  const op = OPERATOR_BY_ID.get(id);
  return Object.fromEntries(op.params.map((p) => [p.key, p.default]));
}

// Distance parameters arrive in per-mille of the em; give the operator real units.
export function scaleParams(id, params, unit) {
  const op = OPERATOR_BY_ID.get(id);
  if (!op || unit === 1) return params;
  const out = { ...params };
  for (const spec of op.params) if (spec.em) out[spec.key] = params[spec.key] * unit;
  return out;
}

export function normalizeStep(step) {
  const op = OPERATOR_BY_ID.get(step?.op);
  if (!op) return null;
  const params = defaultParams(op.id);
  for (const spec of op.params) {
    const v = step.params?.[spec.key];
    if (spec.type === 'pick') { if (spec.options.includes(v)) params[spec.key] = v; }
    else if (Number.isFinite(Number(v))) params[spec.key] = Math.min(spec.max, Math.max(spec.min, Number(v)));
  }
  return { op: op.id, on: step.on !== false, params };
}
