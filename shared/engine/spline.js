// Turns skeleton strokes (through-points + connection types) into cubic
// Bézier segments. Tangents are inferred locally and handle lengths come from
// John Hobby's METAFONT velocity function, scaled by the global tension.

import { sub, unit, dot, add, mul, reflect, angleOf, normAngle, fromAngle } from './geom.js';

const SQRT2 = Math.SQRT2;
const HOBBY_C = (3 - Math.sqrt(5)) / 2;

function hobbyControls(p0, p1, t0, t1, tension) {
  const d = sub(p1, p0);
  const L = Math.hypot(d.x, d.y);
  if (L < 1e-6) return [p0, p0, p1, p1];
  const chord = angleOf(d);
  const theta = normAngle(angleOf(t0) - chord);
  const phi = normAngle(chord - angleOf(t1));
  const st = Math.sin(theta), ct = Math.cos(theta), sp = Math.sin(phi), cp = Math.cos(phi);
  const alpha = SQRT2 * (st - sp / 16) * (sp - st / 16) * (ct - cp);
  let rho = (2 + alpha) / (1 + (1 - HOBBY_C) * ct + HOBBY_C * cp);
  let sigma = (2 - alpha) / (1 + (1 - HOBBY_C) * cp + HOBBY_C * ct);
  rho = Math.min(Math.max(rho, 0), 4);
  sigma = Math.min(Math.max(sigma, 0), 4);
  return [p0, add(p0, mul(t0, (rho * L) / (3 * tension))), sub(p1, mul(t1, (sigma * L) / (3 * tension))), p1];
}

function solve(A, b) {
  // Dense Gaussian elimination with partial pivoting (systems are tiny).
  const n = b.length;
  for (let c = 0; c < n; c++) {
    let p = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(A[r][c]) > Math.abs(A[p][c])) p = r;
    [A[c], A[p]] = [A[p], A[c]];
    [b[c], b[p]] = [b[p], b[c]];
    const piv = A[c][c] || 1e-12;
    for (let r = c + 1; r < n; r++) {
      const f = A[r][c] / piv;
      if (!f) continue;
      for (let k = c; k < n; k++) A[r][k] -= f * A[c][k];
      b[r] -= f * b[c];
    }
  }
  const x = new Array(n).fill(0);
  for (let r = n - 1; r >= 0; r--) {
    let acc = b[r];
    for (let k = r + 1; k < n; k++) acc -= A[r][k] * x[k];
    x[r] = acc / (A[r][r] || 1e-12);
  }
  return x;
}

const rotate = (v, a) => ({ x: v.x * Math.cos(a) - v.y * Math.sin(a), y: v.x * Math.sin(a) + v.y * Math.cos(a) });

// Hobby's mock-curvature continuity for one run of curved segments through
// points pts[0..m] (cyclic when closed). startTan/endTan are unit vectors
// when the direction is imposed, null for a free ("curl") end. Returns the
// outgoing angle θ of every segment relative to its chord.
function hobbyRun(pts, startTan, endTan, cyclic) {
  const m = pts.length - 1;
  const chord = [], d = [];
  for (let k = 0; k < m; k++) {
    const c = sub(pts[k + 1], pts[k]);
    chord.push(angleOf(c));
    d.push(Math.max(Math.hypot(c.x, c.y), 1e-6));
  }
  const psi = (k) => normAngle(chord[((k % m) + m) % m] - chord[(((k - 1) % m) + m) % m]);
  const A = Array.from({ length: m }, () => new Array(m).fill(0));
  const rhs = new Array(m).fill(0);
  if (cyclic) {
    for (let k = 0; k < m; k++) {
      const km = (k - 1 + m) % m, kp = (k + 1) % m;
      A[k][km] += 1 / d[km];
      A[k][k] += -2 / d[km] - 2 / d[k];
      A[k][kp] += 1 / d[k];
      rhs[k] = (2 * psi(k)) / d[km] - psi(k + 1) / d[k];
    }
    return { theta: solve(A, rhs), chord };
  }
  const endPhi = endTan ? normAngle(chord[m - 1] - angleOf(endTan)) : null;
  // start condition
  if (startTan) { A[0][0] = 1; rhs[0] = normAngle(angleOf(startTan) - chord[0]); }
  else if (m === 1) { A[0][0] = 1; rhs[0] = endPhi ?? 0; } // curl: mirror the far end
  else { A[0][0] = 1; A[0][1] = 1; rhs[0] = -psi(1); }
  // interior nodes
  for (let k = 1; k < m; k++) {
    A[k][k - 1] += 1 / d[k - 1];
    A[k][k] += -2 / d[k - 1] - 2 / d[k];
    rhs[k] = (2 * psi(k)) / d[k - 1];
    if (k + 1 < m) { A[k][k + 1] += 1 / d[k]; rhs[k] -= psi(k + 1) / d[k]; }
    else if (endPhi !== null) rhs[k] += endPhi / d[k];
    else A[k][k] -= 1 / d[k];
  }
  return { theta: solve(A, rhs), chord, endPhi };
}

// Returns { tin, tout } unit tangents per node (null where undefined).
// Lines impose their direction on neighbouring curves, {dir} pins a node,
// corners and stroke ends are free; everything else is solved globally so
// curvature flows through nodes instead of kinking at them.
export function nodeTangents(stroke) {
  const { nodes, joins, closed } = stroke;
  const n = nodes.length;
  const segCount = closed ? n : n - 1;
  const tin = new Array(n).fill(null);
  const tout = new Array(n).fill(null);
  const isCurve = (k) => joins[((k % n) + n) % n] === 'curve';

  for (let i = 0; i < segCount; i++) {
    const j = (i + 1) % n;
    if (joins[i] === 'line') {
      const d = unit(sub(nodes[j], nodes[i]));
      tout[i] = d;
      tin[j] = d;
    }
  }
  for (let i = 0; i < n; i++) {
    const node = nodes[i];
    const prevJ = closed || i > 0 ? joins[(i - 1 + n) % n] : null;
    const nextJ = closed || i < n - 1 ? joins[i] : null;
    if (node.dir != null) {
      const d = fromAngle((node.dir * Math.PI) / 180);
      if (prevJ === 'curve') tin[i] = d;
      if (nextJ === 'curve') tout[i] = d;
    } else if (!node.corner && prevJ === 'curve' && nextJ === 'line') tin[i] = tout[i];
    else if (!node.corner && prevJ === 'line' && nextJ === 'curve') tout[i] = tin[i];
  }

  // A node splits curve runs when its direction is known or it is a corner.
  const breaks = (i) => nodes[i].corner || nodes[i].dir != null || !(closed || (i > 0 && i < n - 1)) ||
    !isCurve(i - 1) || !isCurve(i);

  const segs = [];
  for (let k = 0; k < segCount; k++) if (joins[k] === 'curve') segs.push(k);
  if (!segs.length) return { tin, tout };

  const runs = [];
  if (closed && segs.length === segCount && ![...Array(n).keys()].some(breaks)) {
    runs.push({ start: 0, m: n, cyclic: true });
  } else {
    const done = new Set();
    for (const k of segs) {
      if (done.has(k)) continue;
      // walk back to the run start
      let s0 = k, guard = 0;
      while (!breaks(s0) && isCurve(s0 - 1) && guard++ < n) s0 = (s0 - 1 + n) % n;
      let m = 0, cur = s0;
      do { done.add(cur); m++; cur = (cur + 1) % n; } while (m < segCount && isCurve(cur) && !breaks(cur) && (closed || cur < n - 1));
      runs.push({ start: s0, m, cyclic: false });
    }
  }

  for (const run of runs) {
    const pts = [];
    for (let i = 0; i <= run.m; i++) pts.push(nodes[(run.start + i) % n]);
    const first = run.start, last = (run.start + run.m) % n;
    const { theta, chord } = hobbyRun(pts, run.cyclic ? null : tout[first], run.cyclic ? null : tin[last], run.cyclic);
    for (let i = 0; i < run.m; i++) {
      const a = (run.start + i) % n, b = (run.start + i + 1) % n;
      const c = fromAngle(chord[i]);
      const out = rotate(c, theta[i]);
      if (!tout[a] || run.cyclic || i > 0) tout[a] = out;
      // incoming at b: continue smoothly into the next segment's outgoing angle
      const next = i + 1 < run.m || run.cyclic ? rotate(fromAngle(chord[(i + 1) % run.m]), theta[(i + 1) % run.m]) : null;
      if (next && (!tin[b] || run.cyclic || i + 1 < run.m)) tin[b] = next;
    }
    // Free far end: curl — mirror the last outgoing tangent across its chord.
    if (!run.cyclic && !tin[last]) {
      const c = fromAngle(chord[run.m - 1]);
      tin[last] = reflect(tout[(run.start + run.m - 1) % n], c);
    }
  }
  return { tin, tout };
}

// Returns an array of cubics plus, for each junction between consecutive
// segments, whether it is a visible corner.
export function strokeToCubics(stroke, tension = 1) {
  const { nodes, joins, closed } = stroke;
  const n = nodes.length;
  if (n === 1) return { cubics: [], corners: [], dot: nodes[0] };
  const { tin, tout } = nodeTangents(stroke);
  const segCount = closed ? n : n - 1;
  const cubics = [];
  for (let i = 0; i < segCount; i++) {
    const j = (i + 1) % n;
    const p0 = nodes[i], p1 = nodes[j];
    if (joins[i] === 'line') cubics.push([p0, sub(p0, mul(sub(p0, p1), 1 / 3)), sub(p1, mul(sub(p1, p0), 1 / 3)), p1]);
    else cubics.push(hobbyControls(p0, p1, tout[i], tin[j], tension));
  }
  // corners[k]: junction at the end of segment k (node k+1).
  const corners = [];
  const jCount = closed ? segCount : segCount - 1;
  for (let k = 0; k < jCount; k++) {
    const idx = (k + 1) % n;
    const a = tin[idx], b = tout[idx];
    corners.push(!a || !b || dot(a, b) < Math.cos((4 * Math.PI) / 180));
  }
  const lines = cubics.map((_, i) => joins[i] === 'line');
  return { cubics, corners, lines };
}
