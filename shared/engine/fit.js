// Polyline → cubic Bézier fitting (Philip Schneider, Graphics Gems 1990),
// used at export so fonts carry a handful of clean curves instead of hundreds
// of line segments. Corners are kept sharp; straight runs become lines.

import { sub, add, mul, dot, unit, dist, bezPoint, bezDeriv } from './geom.js';

function chordParams(pts) {
  const u = [0];
  for (let i = 1; i < pts.length; i++) u.push(u[i - 1] + dist(pts[i], pts[i - 1]));
  const L = u[u.length - 1] || 1;
  return u.map((v) => v / L);
}

function generateBezier(pts, u, t1, t2) {
  const first = pts[0], last = pts[pts.length - 1];
  let c00 = 0, c01 = 0, c11 = 0, x0 = 0, x1 = 0;
  for (let i = 0; i < pts.length; i++) {
    const t = u[i], mt = 1 - t;
    const b0 = mt * mt * mt, b1 = 3 * mt * mt * t, b2 = 3 * mt * t * t, b3 = t * t * t;
    const a1 = mul(t1, b1), a2 = mul(t2, b2);
    c00 += dot(a1, a1); c01 += dot(a1, a2); c11 += dot(a2, a2);
    const tmp = sub(pts[i], add(mul(first, b0 + b1), mul(last, b2 + b3)));
    x0 += dot(a1, tmp); x1 += dot(a2, tmp);
  }
  const det = c00 * c11 - c01 * c01;
  let alpha1 = det === 0 ? 0 : (x0 * c11 - x1 * c01) / det;
  let alpha2 = det === 0 ? 0 : (c00 * x1 - c01 * x0) / det;
  const segLen = dist(first, last);
  const eps = 1e-6 * segLen;
  if (alpha1 < eps || alpha2 < eps) alpha1 = alpha2 = segLen / 3;
  return [first, add(first, mul(t1, alpha1)), add(last, mul(t2, alpha2)), last];
}

function maxError(bz, pts, u) {
  let max = 0, at = Math.floor(pts.length / 2);
  for (let i = 1; i < pts.length - 1; i++) {
    const d = dist(bezPoint(bz, u[i]), pts[i]);
    if (d > max) { max = d; at = i; }
  }
  return { max, at };
}

function reparameterize(bz, pts, u) {
  return u.map((t, i) => {
    const p = bezPoint(bz, t), d1 = bezDeriv(bz, t);
    const d2 = {
      x: 6 * (1 - t) * (bz[2].x - 2 * bz[1].x + bz[0].x) + 6 * t * (bz[3].x - 2 * bz[2].x + bz[1].x),
      y: 6 * (1 - t) * (bz[2].y - 2 * bz[1].y + bz[0].y) + 6 * t * (bz[3].y - 2 * bz[2].y + bz[1].y),
    };
    const diff = sub(p, pts[i]);
    const num = dot(diff, d1), den = dot(d1, d1) + dot(diff, d2);
    if (Math.abs(den) < 1e-12) return t;
    return Math.min(1, Math.max(0, t - num / den));
  });
}

function isStraight(pts, tol) {
  const a = pts[0], b = pts[pts.length - 1];
  const d = unit(sub(b, a)), L = dist(a, b);
  if (L < 1e-6) return true;
  return pts.every((p) => {
    const v = sub(p, a);
    const along = dot(v, d);
    return Math.abs(v.x * d.y - v.y * d.x) <= tol && along >= -tol && along <= L + tol;
  });
}

function fitSpan(pts, t1, t2, err, out, depth = 0) {
  if (pts.length === 2 || isStraight(pts, err * 0.5)) { out.push({ type: 'L', to: pts[pts.length - 1] }); return; }
  let u = chordParams(pts);
  let bz = generateBezier(pts, u, t1, t2);
  let { max, at } = maxError(bz, pts, u);
  if (max <= err) { out.push({ type: 'C', c1: bz[1], c2: bz[2], to: bz[3] }); return; }
  if (max <= err * 4) {
    for (let k = 0; k < 6; k++) {
      u = reparameterize(bz, pts, u);
      bz = generateBezier(pts, u, t1, t2);
      ({ max, at } = maxError(bz, pts, u));
      if (max <= err) { out.push({ type: 'C', c1: bz[1], c2: bz[2], to: bz[3] }); return; }
    }
  }
  if (depth > 12 || pts.length < 4) { out.push({ type: 'C', c1: bz[1], c2: bz[2], to: bz[3] }); return; }
  at = Math.min(Math.max(at, 1), pts.length - 2);
  const center = unit(sub(pts[at - 1], pts[at + 1]));
  fitSpan(pts.slice(0, at + 1), t1, center, err, out, depth + 1);
  fitSpan(pts.slice(at), mul(center, -1), t2, err, out, depth + 1);
}

// Closed polyline → { start, segs: [{type:'L'|'C', ...}] }.
export function fitContour(raw, err = 0.6, cornerDeg = 32) {
  const pts = [];
  for (const p of raw) if (!pts.length || dist(p, pts[pts.length - 1]) > 0.05) pts.push(p);
  while (pts.length > 2 && dist(pts[0], pts[pts.length - 1]) <= 0.05) pts.pop();
  const n = pts.length;
  if (n < 3) return null;
  const cosT = Math.cos((cornerDeg * Math.PI) / 180);
  const isCorner = (i) => {
    const a = unit(sub(pts[i], pts[(i - 1 + n) % n])), b = unit(sub(pts[(i + 1) % n], pts[i]));
    return dot(a, b) < cosT;
  };
  // Break at corners, and at the horizontal/vertical extremes of the shape so
  // the exported outline carries on-curve points where type designers (and
  // hinting engines) expect them. Extremes are detected over a window, which
  // keeps sampling jitter on straight runs from splitting the curve.
  const WINDOW = 5;
  const MIN_SWING = 0.15;
  const extremeOn = (i, axis) => {
    let lo = Infinity, hi = -Infinity;
    for (let k = -WINDOW; k <= WINDOW; k++) {
      const v = pts[(i + k + n * 2) % n][axis];
      lo = Math.min(lo, v); hi = Math.max(hi, v);
    }
    if (hi - lo < MIN_SWING) return 0;
    const v = pts[i][axis];
    if (v <= lo) return -1;
    if (v >= hi) return 1;
    return 0;
  };
  const corner = new Set();
  const breakSet = new Set();
  const extreme = new Map();
  for (let i = 0; i < n; i++) {
    if (isCorner(i)) { corner.add(i); breakSet.add(i); continue; }
    const ex = extremeOn(i, 'x');
    const ey = extremeOn(i, 'y');
    if (!ex && !ey) continue;
    breakSet.add(i);
    const next = pts[(i + 1) % n], cur = pts[i];
    // Tangent at an extreme is axis-aligned: vertical at a left/right extreme.
    extreme.set(i, ex ? { x: 0, y: Math.sign(next.y - cur.y) || 1 } : { x: Math.sign(next.x - cur.x) || 1, y: 0 });
  }
  let breaks = [...breakSet];
  if (breaks.length === 0) breaks = [0, Math.floor(n / 2)];
  else if (breaks.length === 1) breaks.push((breaks[0] + Math.floor(n / 2)) % n);
  breaks.sort((a, b) => a - b);

  const tangentOut = (i) => extreme.get(i) ?? (corner.has(i) ? unit(sub(pts[(i + 1) % n], pts[i])) : unit(sub(pts[(i + 1) % n], pts[(i - 1 + n) % n])));
  const tangentIn = (i) => {
    const e = extreme.get(i);
    if (e) return { x: -e.x, y: -e.y };
    return corner.has(i) ? unit(sub(pts[(i - 1 + n) % n], pts[i])) : unit(sub(pts[(i - 1 + n) % n], pts[(i + 1) % n]));
  };

  const segs = [];
  for (let b = 0; b < breaks.length; b++) {
    const i = breaks[b], j = breaks[(b + 1) % breaks.length];
    const span = [];
    for (let k = i; ; k = (k + 1) % n) {
      span.push(pts[k]);
      if (k === j && span.length > 1) break;
    }
    fitSpan(span, tangentOut(i), tangentIn(j), err, segs);
  }
  return { start: pts[breaks[0]], segs };
}
