// One glyph: design skeleton → font-unit outline contours.
//
// Pipeline: seeded wobble (modulation) → zone mapping (design grid → project
// metrics) → zone compensation (strokes sit *on* baseline/x-height instead of
// straddling them, curves overshoot) → Hobby splines → stroke expansion with
// contrast, terminals and serifs.

import { cloneSkeleton } from './skeleton.js';
import { strokeToCubics, nodeTangents } from './spline.js';
import { sampleRuns, outlineStroke, dotContour } from './expand.js';
import { rng, hashString, noise1D } from './random.js';
import { angleOf, dist } from './geom.js';

// Design-grid zones per case. `side` tells which way a stroke sitting on the
// line must be pulled so its edge (not its centerline) lands on the line.
const DESIGN_ZONES = {
  lower: [[-220, 'bottom'], [0, 'bottom'], [500, 'top'], [750, 'top']],
  upper: [[0, 'bottom'], [700, 'top']],
  mark: [],
};
const zonesFor = (kind) => (kind === 'lower' || kind === 'punct' ? DESIGN_ZONES.lower : kind === 'mark' ? DESIGN_ZONES.mark : DESIGN_ZONES.upper);

function piecewise(y, pts) {
  // pts: sorted [[designY, metricY], ...]; linear inside, extrapolated outside.
  let i = 0;
  while (i < pts.length - 2 && y > pts[i + 1][0]) i++;
  const [x0, y0] = pts[i], [x1, y1] = pts[i + 1];
  return y0 + ((y - x0) * (y1 - y0)) / (x1 - x0);
}

export function yMapper(kind, m) {
  if (kind === 'lower' || kind === 'punct')
    return (y) => piecewise(y, [[-220, m.descender], [0, 0], [500, m.xHeight], [750, m.ascender]]);
  if (kind === 'mark-lower') return (y) => (y * m.xHeight) / 500;
  if (kind === 'mark-upper') return (y) => (y * 0.75 * m.capHeight) / 700;
  return (y) => piecewise(y, [[-220, m.descender], [0, 0], [700, m.capHeight], [800, m.capHeight + (100 * m.capHeight) / 700]]);
}

export function stemFor(kind, D) {
  if (kind === 'upper') return D.stem * 1.07;
  if (kind === 'figure') return D.stem * 1.04;
  if (kind.startsWith('mark')) return D.stem * 0.92;
  return D.stem;
}

// Broad-nib contrast: width depends on stroke direction.
function contrastFactor(t, D) {
  if (D.contrast <= 0) return 1;
  const g = Math.min(1.1, Math.abs(Math.sin(angleOf(t) - D.penAngle)) / Math.cos(D.penAngle));
  return D.thinRatio + (1 - D.thinRatio) * g * g;
}

function quality(q) {
  return q === 'export' ? { step: 4, arcSteps: 8 } : { step: 11, arcSteps: 4 };
}

// kind: upper | lower | figure | symbol | punct | mark-lower | mark-upper
export function buildGlyph(name, skeleton, kind, D, opts = {}) {
  const Q = quality(opts.quality);
  const stem = stemFor(kind, D);
  const m = D.m;
  const mapY = yMapper(kind, m);
  const zones = zonesFor(kind.startsWith('mark') ? 'mark' : kind);
  const rand = rng(hashString(name, D.p.seed));
  const wobble = D.modulation * 16;
  const dotSize = (w) => Math.max(stem * 1.25 * w, stem * 1.05);

  // 1–2. wobble + map to font units, remembering which nodes sit on zones.
  const sk = cloneSkeleton(skeleton);
  for (const s of sk.strokes) {
    for (const n of s.nodes) {
      const onZone = zones.find(([zy]) => Math.abs(n.y - zy) < 0.5);
      const jx = wobble ? (rand() * 2 - 1) * wobble : 0;
      const jy = wobble && !onZone ? (rand() * 2 - 1) * wobble : 0;
      n.designY = n.y;
      n.x = (n.x + jx) * D.xScale;
      n.y = mapY(n.y + jy);
      if (onZone && !s.attach) n.zone = { y: n.y, side: onZone[1] };
    }
  }

  const strokeW = (s) => stem * (s.w ?? 1);

  // 3. zone compensation.
  const dotShift = [];
  for (const s of sk.strokes) {
    if (s.attach) continue;
    if (s.nodes.length === 1) {
      const n = s.nodes[0];
      if (n.zone) {
        const d = (dotSize(s.w ?? 1) / 2) * (n.zone.side === 'bottom' ? 1 : -1);
        dotShift.push({ from: { x: n.x, y: n.y }, dy: d });
        n.y += d;
      }
      continue;
    }
    const { tin, tout } = nodeTangents(s);
    const last = s.nodes.length - 1;
    s.nodes.forEach((n, i) => {
      if (!n.zone) return;
      const sign = n.zone.side === 'bottom' ? 1 : -1;
      const tans = [tin[i], tout[i]].filter(Boolean);
      const flat = tans.find((t) => Math.abs(t.y) < 0.35);
      const isEnd = !s.closed && (i === 0 || i === last);
      if (flat) {
        const before = n.y;
        const curvy = (i > 0 || s.closed ? s.joins[(i - 1 + s.nodes.length) % s.nodes.length] === 'curve' : false) ||
          (i < last || s.closed ? s.joins[i] === 'curve' : false);
        const w = strokeW(s) * contrastFactor(flat, D);
        n.y += sign * (w / 2 - (curvy ? D.overshoot : 0));
        n.zone.flat = true;
        n.zone.delta = n.y - before;
      } else if (isEnd && D.p.terminals === 'rounded' && !D.p.serifMode) {
        n.y += (sign * strokeW(s)) / 2;
      }
    });
  }
  // Terminals just off a zone (t, y, j hooks) follow the curve they end.
  const REACH = 80;
  for (const s of sk.strokes) {
    s.nodes.forEach((n, i) => {
      if (n.zone) return;
      for (const j of [i - 1, i + 1]) {
        const nb = s.nodes[j];
        if (!nb?.zone?.delta) continue;
        const dy = Math.abs(n.designY - nb.designY);
        if (dy < REACH) { n.y += nb.zone.delta * (1 - dy / REACH); break; }
      }
    });
  }
  // Attached strokes (comma tails) follow their dot.
  for (const s of sk.strokes) {
    if (!s.attach) continue;
    const first = s.nodes[0];
    const host = dotShift.find((d) => dist(d.from, first) < 1);
    if (host) for (const n of s.nodes) n.y += host.dy;
  }

  // 4. splines + centerline samples for every stroke.
  const prepared = sk.strokes.map((s, idx) => {
    if (s.nodes.length === 1) return { s, idx, dot: s.nodes[0] };
    const cub = strokeToCubics(s, D.tension);
    return { s, idx, cub, sampled: sampleRuns(cub, s.closed, Q.step) };
  });

  const nearOther = (p, idx, tol) =>
    prepared.some((o) => {
      if (o.idx === idx) return false;
      if (o.dot) return dist(o.dot, p) < tol;
      return o.sampled.runs.some((run) => run.some((q) => dist(q, p) < tol));
    });

  // 5. outline. Serifs are kept apart so spacing can be measured on the
  // letter's body: serif tips reach into the sidebearings, as in real type.
  const contours = [];
  const serifs = [];
  const noiseSeed = hashString(name + '#w', D.p.seed);
  for (const pr of prepared) {
    const { s } = pr;
    const wMul = s.w ?? 1;
    if (pr.dot) {
      contours.push(dotContour(pr.dot, dotSize(wMul), D.p.terminals === 'sharp', Q.arcSteps));
      continue;
    }
    const { sampled } = pr;
    const firstRun = sampled.runs[0], lastRun = sampled.runs[sampled.runs.length - 1];
    const endSample = [firstRun[0], lastRun[lastRun.length - 1]];
    const endNode = [s.nodes[0], s.nodes[s.nodes.length - 1]];
    const tol = strokeW(s) * 0.3;
    const ends = s.closed
      ? [null, null]
      : [0, 1].map((k) => {
          const node = endNode[k];
          const t = endSample[k].t;
          const junction = nearOther(endSample[k], pr.idx, tol);
          const zone = node.zone && !node.zone.flat ? node.zone : null;
          let serif = false;
          if (zone && D.p.serifMode && !s.noserif && !junction && Math.abs(t.y) > 0.5 && !kind.startsWith('mark'))
            serif = (kind === 'lower' || kind === 'punct') && zone.side === 'top' && Math.abs(t.x) < 0.25 ? 'head' : 'full';
          return { zone, serif, free: !zone && !junction };
        });

    const total = sampled.totalLength;
    const flareLen = Math.min(total * 0.3, stem * 1.3);
    const flare = D.p.terminals === 'serif';
    const wn = D.modulation ? noise1D(noiseSeed + pr.idx, 140) : null;
    const widthAt = (smp) => {
      let w = stem * wMul * contrastFactor(smp.t, D);
      if (wn) w *= 1 + 0.22 * D.modulation * wn(smp.s);
      if (flare) {
        const ramp = (d) => (d < flareLen ? 1 - d / flareLen : 0);
        const f = Math.max(ends[0]?.free ? ramp(smp.s) : 0, ends[1]?.free ? ramp(total - smp.s) : 0);
        w *= 1 + 0.45 * f * f;
      }
      return Math.max(w, 2);
    };

    // Serif proportions follow the contrast: slab-like (thick, no bracket)
    // when monoline, hairline with a generous bracket when high-contrast.
    const serifLen = stem * 0.34 + 6;
    const serifGeom = {
      h: stem * Math.max(0.12, 0.5 * D.thinRatio),
      len: serifLen,
      br: Math.min(serifLen * 0.8, stem * 0.28 * D.contrast),
      arcSteps: Q.arcSteps,
    };
    const out = outlineStroke(sampled, { widthAt, terminal: D.p.terminals, arcSteps: Q.arcSteps, ends, serif: serifGeom });
    contours.push(...out.contours);
    serifs.push(...out.serifs);
  }
  return { name, kind, contours: [...contours, ...serifs], body: contours, serifCount: serifs.length };
}

export function contoursBounds(contours) {
  let xMin = Infinity, yMin = Infinity, xMax = -Infinity, yMax = -Infinity;
  for (const c of contours)
    for (const p of c) {
      if (p.x < xMin) xMin = p.x;
      if (p.x > xMax) xMax = p.x;
      if (p.y < yMin) yMin = p.y;
      if (p.y > yMax) yMax = p.y;
    }
  if (xMin === Infinity) return null;
  return { xMin, yMin, xMax, yMax };
}

export function translateContours(contours, dx, dy) {
  return contours.map((c) => c.map((p) => ({ x: p.x + dx, y: p.y + dy })));
}
