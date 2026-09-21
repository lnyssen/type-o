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

// Returns { tin, tout } unit tangents per node (null where undefined).
export function nodeTangents(stroke) {
  const { nodes, joins, closed } = stroke;
  const n = nodes.length;
  const segCount = closed ? n : n - 1;
  const tin = new Array(n).fill(null);
  const tout = new Array(n).fill(null);

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
      continue;
    }
    if (node.corner) continue;
    if (prevJ === 'curve' && nextJ === 'curve') {
      const prev = nodes[(i - 1 + n) % n], next = nodes[(i + 1) % n];
      const a = unit(sub(node, prev)), b = unit(sub(next, node));
      const d = unit(add(a, b));
      tin[i] = d;
      tout[i] = d;
    } else if (prevJ === 'curve' && nextJ === 'line') {
      tin[i] = tout[i];
    } else if (prevJ === 'line' && nextJ === 'curve') {
      tout[i] = tin[i];
    }
  }

  // Free curve ends ("curl"): mirror the known tangent across the chord, which
  // yields a circular arc; with nothing known at either end, go straight.
  for (let i = 0; i < segCount; i++) {
    const j = (i + 1) % n;
    if (joins[i] !== 'curve') continue;
    const chord = unit(sub(nodes[j], nodes[i]));
    if (!tout[i] && !tin[j]) { tout[i] = chord; tin[j] = chord; }
    else if (!tout[i]) tout[i] = reflect(tin[j], chord);
    else if (!tin[j]) tin[j] = reflect(tout[i], chord);
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
  return { cubics, corners };
}
