// Ramer–Douglas–Peucker on closed contours.
//
// The operators work on polylines fine enough to look like curves, which makes
// a lot of points. Decimating by distance would flatten the curves; this keeps
// every vertex that carries the shape and drops the ones that lie on a line.

function rdp(points, first, last, tol2, keep) {
  let worst = 0, index = -1;
  const [ax, ay] = points[first], [bx, by] = points[last];
  const dx = bx - ax, dy = by - ay;
  const span = dx * dx + dy * dy;
  for (let i = first + 1; i < last; i++) {
    const [px, py] = points[i];
    let d;
    if (span === 0) {
      d = (px - ax) ** 2 + (py - ay) ** 2;
    } else {
      const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / span));
      d = (px - ax - t * dx) ** 2 + (py - ay - t * dy) ** 2;
    }
    if (d > worst) { worst = d; index = i; }
  }
  if (worst <= tol2 || index < 0) return;
  rdp(points, first, index, tol2, keep);
  keep[index] = true;
  rdp(points, index, last, tol2, keep);
}

export function simplifyContour(flat, tolerance) {
  const n = flat.length / 2;
  if (n < 5) return flat;
  const points = new Array(n);
  for (let i = 0; i < n; i++) points[i] = [flat[i * 2], flat[i * 2 + 1]];

  // Split the ring at its two most distant points so neither seam gets a kink.
  let far = 0, best = -1;
  for (let i = 1; i < n; i++) {
    const d = (points[i][0] - points[0][0]) ** 2 + (points[i][1] - points[0][1]) ** 2;
    if (d > best) { best = d; far = i; }
  }
  const keep = new Array(n).fill(false);
  keep[0] = true; keep[far] = true;
  const tol2 = tolerance * tolerance;
  rdp(points, 0, far, tol2, keep);
  const tail = [...points.slice(far), points[0]];
  const tailKeep = new Array(tail.length).fill(false);
  rdp(tail, 0, tail.length - 1, tol2, tailKeep);
  for (let i = 1; i < tail.length - 1; i++) if (tailKeep[i]) keep[far + i] = true;

  const out = [];
  for (let i = 0; i < n; i++) if (keep[i]) out.push(points[i][0], points[i][1]);
  return out.length >= 6 ? out : flat;
}

export const simplify = (contours, tolerance) =>
  contours.map((c) => simplifyContour(c, tolerance)).filter((c) => c.length >= 6);
