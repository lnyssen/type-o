// Polygon algebra for the operators. Every operator ends up here: Clipper does
// the unions, the differences and the offsets, on integer coordinates.
//
// Contours are flat arrays — [x0, y0, x1, y1, …] — because that is what the
// outline server sends, what the renderer draws and what the exporter packs.

import ClipperLib from 'clipper-lib';

const SCALE = 32; // 1/32 of a font unit: finer than any rasteriser will show
const NONZERO = ClipperLib.PolyFillType.pftNonZero;

export const toPaths = (contours) =>
  contours.map((c) => {
    const path = new Array(c.length / 2);
    for (let i = 0, j = 0; i < c.length; i += 2, j++) path[j] = { X: Math.round(c[i] * SCALE), Y: Math.round(c[i + 1] * SCALE) };
    return path;
  });

export const fromPaths = (paths) =>
  paths.filter((p) => p.length > 2).map((p) => {
    const c = new Array(p.length * 2);
    for (let i = 0, j = 0; i < p.length; i++, j += 2) { c[j] = p[i].X / SCALE; c[j + 1] = p[i].Y / SCALE; }
    return c;
  });

function execute(subject, clip, type) {
  const c = new ClipperLib.Clipper();
  c.AddPaths(subject, ClipperLib.PolyType.ptSubject, true);
  if (clip && clip.length) c.AddPaths(clip, ClipperLib.PolyType.ptClip, true);
  const out = [];
  c.Execute(type, out, NONZERO, NONZERO);
  return out;
}

const op = (type) => (a, b) => fromPaths(execute(toPaths(a), toPaths(b), type));

export const union = (a, b = []) => fromPaths(execute(toPaths(a).concat(toPaths(b)), null, ClipperLib.ClipType.ctUnion));
export const difference = op(ClipperLib.ClipType.ctDifference);
export const intersect = op(ClipperLib.ClipType.ctIntersection);

// Grow (delta > 0) or shrink (delta < 0) the shape. Round joins keep the
// swollen letters organic; miter would spike every corner.
export function offset(contours, delta, { round = true } = {}) {
  if (!delta) return contours;
  const co = new ClipperLib.ClipperOffset(2.5, 0.25 * SCALE);
  co.AddPaths(toPaths(contours),
    round ? ClipperLib.JoinType.jtRound : ClipperLib.JoinType.jtMiter,
    ClipperLib.EndType.etClosedPolygon);
  const out = [];
  co.Execute(out, delta * SCALE);
  return fromPaths(out);
}

// Drop collinear noise and anything too small to see; keeps exports sane.
export function clean(contours, tolerance = 0.4, minArea = 4) {
  const cleaned = ClipperLib.Clipper.CleanPolygons(toPaths(contours), tolerance * SCALE);
  const kept = cleaned.filter((p) => p.length > 2 && Math.abs(ClipperLib.Clipper.Area(p)) > minArea * SCALE * SCALE);
  return fromPaths(kept);
}

export function area(contours) {
  let total = 0;
  for (const c of contours) {
    let a = 0;
    for (let i = 0, n = c.length; i < n; i += 2) {
      const j = (i + 2) % n;
      a += c[i] * c[j + 1] - c[j] * c[i + 1];
    }
    total += a / 2;
  }
  return Math.abs(total);
}

export function rect(x0, y0, x1, y1) {
  return [x0, y0, x1, y0, x1, y1, x0, y1];
}

export function circle(cx, cy, r, steps = 24) {
  const c = new Array(steps * 2);
  for (let i = 0; i < steps; i++) {
    const a = (i / steps) * Math.PI * 2;
    c[i * 2] = cx + Math.cos(a) * r;
    c[i * 2 + 1] = cy + Math.sin(a) * r;
  }
  return c;
}

export function bbox(contours) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const c of contours) {
    for (let i = 0; i < c.length; i += 2) {
      if (c[i] < x0) x0 = c[i];
      if (c[i] > x1) x1 = c[i];
      if (c[i + 1] < y0) y0 = c[i + 1];
      if (c[i + 1] > y1) y1 = c[i + 1];
    }
  }
  return x0 === Infinity ? { x0: 0, y0: 0, x1: 0, y1: 0, w: 0, h: 0 } : { x0, y0, x1, y1, w: x1 - x0, h: y1 - y0 };
}

// Move every point through `fn(x, y) -> [x, y]`.
export function warp(contours, fn) {
  return contours.map((c) => {
    const out = new Array(c.length);
    for (let i = 0; i < c.length; i += 2) {
      const [x, y] = fn(c[i], c[i + 1]);
      out[i] = x; out[i + 1] = y;
    }
    return out;
  });
}

export const translate = (contours, dx, dy) => warp(contours, (x, y) => [x + dx, y + dy]);

export function rotate(contours, rad, cx, cy) {
  const s = Math.sin(rad), c = Math.cos(rad);
  return warp(contours, (x, y) => {
    const dx = x - cx, dy = y - cy;
    return [cx + dx * c - dy * s, cy + dx * s + dy * c];
  });
}
