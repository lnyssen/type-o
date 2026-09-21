// Small 2D geometry toolkit shared by the browser and the server.
// Points are plain {x, y} objects; y points up (font space).

export const vec = (x, y) => ({ x, y });
export const add = (a, b) => ({ x: a.x + b.x, y: a.y + b.y });
export const sub = (a, b) => ({ x: a.x - b.x, y: a.y - b.y });
export const mul = (a, s) => ({ x: a.x * s, y: a.y * s });
export const dot = (a, b) => a.x * b.x + a.y * b.y;
export const cross = (a, b) => a.x * b.y - a.y * b.x;
export const len = (a) => Math.hypot(a.x, a.y);
export const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
export const lerp = (a, b, t) => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
export const angleOf = (a) => Math.atan2(a.y, a.x);
export const fromAngle = (rad) => ({ x: Math.cos(rad), y: Math.sin(rad) });
export const perpLeft = (a) => ({ x: -a.y, y: a.x });

export function unit(a) {
  const l = Math.hypot(a.x, a.y);
  return l > 1e-9 ? { x: a.x / l, y: a.y / l } : { x: 1, y: 0 };
}

export function normAngle(a) {
  while (a > Math.PI) a -= 2 * Math.PI;
  while (a < -Math.PI) a += 2 * Math.PI;
  return a;
}

// Reflect vector v across the line spanned by unit vector axis.
export function reflect(v, axis) {
  const d = 2 * dot(v, axis);
  return { x: d * axis.x - v.x, y: d * axis.y - v.y };
}

// ---- Cubic Bézier helpers. A cubic is [p0, p1, p2, p3]. ----

export function bezPoint([p0, p1, p2, p3], t) {
  const mt = 1 - t;
  const a = mt * mt * mt, b = 3 * mt * mt * t, c = 3 * mt * t * t, d = t * t * t;
  return {
    x: a * p0.x + b * p1.x + c * p2.x + d * p3.x,
    y: a * p0.y + b * p1.y + c * p2.y + d * p3.y,
  };
}

export function bezDeriv([p0, p1, p2, p3], t) {
  const mt = 1 - t;
  const a = 3 * mt * mt, b = 6 * mt * t, c = 3 * t * t;
  return {
    x: a * (p1.x - p0.x) + b * (p2.x - p1.x) + c * (p3.x - p2.x),
    y: a * (p1.y - p0.y) + b * (p2.y - p1.y) + c * (p3.y - p2.y),
  };
}

// Tangent that survives degenerate handles (handle == anchor).
export function bezTangent(bz, t) {
  let d = bezDeriv(bz, t);
  if (len(d) < 1e-6) {
    const e = t < 0.5 ? 1e-3 : -1e-3;
    const p = bezPoint(bz, t), q = bezPoint(bz, t + e);
    d = e > 0 ? sub(q, p) : sub(p, q);
  }
  return unit(d);
}

export function bezLength(bz, steps = 16) {
  let l = 0, prev = bz[0];
  for (let i = 1; i <= steps; i++) {
    const p = bezPoint(bz, i / steps);
    l += dist(prev, p);
    prev = p;
  }
  return l;
}

// Signed area of a closed polyline (positive = counter-clockwise, y up).
export function polyArea(pts) {
  let a = 0;
  for (let i = 0, n = pts.length; i < n; i++) {
    const p = pts[i], q = pts[(i + 1) % n];
    a += p.x * q.y - q.x * p.y;
  }
  return a / 2;
}

export function bbox(points) {
  let xMin = Infinity, yMin = Infinity, xMax = -Infinity, yMax = -Infinity;
  for (const p of points) {
    if (p.x < xMin) xMin = p.x;
    if (p.x > xMax) xMax = p.x;
    if (p.y < yMin) yMin = p.y;
    if (p.y > yMax) yMax = p.y;
  }
  return { xMin, yMin, xMax, yMax };
}

// Intersection of two infinite lines p + s*r and q + u*v; null when parallel.
export function lineIntersect(p, r, q, v) {
  const den = cross(r, v);
  if (Math.abs(den) < 1e-9) return null;
  const s = cross(sub(q, p), v) / den;
  return add(p, mul(r, s));
}
