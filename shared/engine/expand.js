// Stroke expansion: skeleton centerlines → closed outline contours.
//
// Each stroke is split into "runs" of tangent-continuous segments. A run
// becomes a ribbon (left offset forward, right offset back) with terminals at
// free ends; corners between runs get a miter patch. Every contour is emitted
// counter-clockwise (holes clockwise), so a nonzero fill paints their union —
// the browser preview relies on that, and the exporter removes the overlaps.

import { add, sub, mul, dot, cross, perpLeft, angleOf, polyArea, lineIntersect, bezPoint, bezTangent, bezLength, dist } from './geom.js';

// Returns sampled centerline runs for a stroke already converted to cubics.
// A sample is { x, y, t: unit tangent, s: arc length from stroke start }.
export function sampleRuns({ cubics, corners }, closed, step) {
  const runs = [];
  let cur = [];
  let s = 0;
  cubics.forEach((bz, k) => {
    const L = bezLength(bz);
    const n = Math.max(2, Math.ceil(L / step));
    for (let i = cur.length ? 1 : 0; i <= n; i++) {
      const t = i / n;
      const p = bezPoint(bz, t);
      cur.push({ x: p.x, y: p.y, t: bezTangent(bz, t), s: s + L * t });
    }
    s += L;
    const isLast = k === cubics.length - 1;
    if (!isLast && corners[k]) {
      runs.push(cur);
      const last = cur[cur.length - 1];
      cur = [{ ...last, t: bezTangent(cubics[k + 1], 0) }];
    }
  });
  runs.push(cur);
  const anyCorner = corners.some(Boolean);
  const closingCorner = closed && corners[cubics.length - 1];
  // A closed stroke whose seam is smooth but that has other corners: stitch the
  // last run onto the first so the seam isn't treated as a corner.
  if (closed && !closingCorner && runs.length > 1) {
    const first = runs.shift();
    runs[runs.length - 1] = runs[runs.length - 1].concat(first.slice(1));
  }
  return { runs, totalLength: s, closed, loop: closed && !anyCorner };
}

function segIntersect(p1, p2, p3, p4) {
  const d1x = p2.x - p1.x, d1y = p2.y - p1.y, d2x = p4.x - p3.x, d2y = p4.y - p3.y;
  const den = d1x * d2y - d1y * d2x;
  if (Math.abs(den) < 1e-12) return null;
  const ex = p3.x - p1.x, ey = p3.y - p1.y;
  const t = (ex * d2y - ey * d2x) / den, u = (ex * d1y - ey * d1x) / den;
  if (t <= 0 || t >= 1 || u <= 0 || u >= 1) return null;
  return { x: p1.x + d1x * t, y: p1.y + d1y * t };
}

// Cut out the little loops an offset curve makes where the stroke is wider
// than the curve is tight (swallowtails on the inside of bends). Only short
// loops go: a stroke that genuinely crosses itself (&, @) keeps its shape.
function removeLoops(pts, maxLoop, reach = 80) {
  const out = pts.slice();
  for (let i = 0; i < out.length - 3; i++) {
    const lim = Math.min(out.length - 1, i + reach);
    for (let j = lim - 1; j >= i + 2; j--) {
      const x = segIntersect(out[i], out[i + 1], out[j], out[j + 1]);
      if (!x) continue;
      let loop = 0;
      for (let k = i + 1; k <= j && loop <= maxLoop; k++) loop += dist(out[k], out[k + 1]);
      if (loop > maxLoop) continue;
      out.splice(i + 1, j - i, x);
      break;
    }
  }
  return out;
}

function ccw(pts) {
  return polyArea(pts) < 0 ? pts.slice().reverse() : pts;
}
function cw(pts) {
  return polyArea(pts) > 0 ? pts.slice().reverse() : pts;
}

// Flat cut of one ribbon side against a zone line (baseline, x-height...).
function clipToZone(side, dir, zoneY, outward) {
  const out = side.slice();
  while (out.length > 2 && (out[out.length - 1].y - zoneY) * outward > 0) out.pop();
  const q = out[out.length - 1];
  if (Math.abs(dir.y) < 1e-3) return out;
  const k = (zoneY - q.y) / dir.y;
  out.push(add(q, mul(dir, k)));
  return out;
}

function arc(c, r, a0, sweep, n) {
  const pts = [];
  for (let i = 1; i < n; i++) {
    const a = a0 + (sweep * i) / n;
    pts.push({ x: c.x + r * Math.cos(a), y: c.y + r * Math.sin(a) });
  }
  return pts;
}

// Bracketed serif sitting on a zone line. `sign` = +1 when the glyph interior
// is above the zone (baseline), -1 when below (x-height, cap height).
export function serifContour(xl, xr, zoneY, sign, g, headOnly) {
  const { h, len, br, arcSteps } = g;
  const P = (u, v) => ({ x: u, y: zoneY + sign * v });
  const fillet = (cx, cy, from, sweep) => arc({ x: cx, y: cy }, br, from, sweep, arcSteps).map((p) => P(p.x, p.y));
  const pts = [P(xl - len, 0)];
  if (headOnly) {
    pts.push(P(xr, 0), P(xr, h + br), P(xl, h + br));
  } else {
    pts.push(P(xr + len, 0), P(xr + len, h), P(xr + br, h));
    pts.push(...fillet(xr + br, h + br, -Math.PI / 2, -Math.PI / 2));
    pts.push(P(xr, h + br), P(xl, h + br));
  }
  pts.push(...fillet(xl - br, h + br, 0, -Math.PI / 2));
  pts.push(P(xl - br, h), P(xl - len, h));
  return ccw(pts);
}

// ctx: { widthAt(sample, endInfo) -> width, terminal, arcSteps,
//        ends: [startInfo, endInfo] with { zone, free, serif } }
export function outlineStroke(sampled, ctx) {
  const contours = [];
  const serifs = [];
  const { runs, loop } = sampled;
  const widthsOf = (run) => run.map((p) => ctx.widthAt(p));

  const sides = (run, widths) => {
    const L = [], R = [];
    const maxLoop = Math.max(...widths) * 3;
    run.forEach((p, i) => {
      const n = perpLeft(p.t);
      const hw = widths[i] / 2;
      L.push({ x: p.x + n.x * hw, y: p.y + n.y * hw });
      R.push({ x: p.x - n.x * hw, y: p.y - n.y * hw });
    });
    return { L: removeLoops(L, maxLoop), R: removeLoops(R, maxLoop) };
  };

  if (loop) {
    const run = runs[0];
    const w = widthsOf(run);
    const { L, R } = sides(run.slice(0, -1), w.slice(0, -1));
    const [outer, inner] = Math.abs(polyArea(L)) >= Math.abs(polyArea(R)) ? [L, R] : [R, L];
    contours.push(ccw(outer), cw(inner));
    return { contours, serifs };
  }

  const runWidths = runs.map(widthsOf);
  runs.forEach((run, ri) => {
    const w = runWidths[ri];
    let { L, R } = sides(run, w);
    const startCap = [], endCap = [];
    const startInfo = ri === 0 ? ctx.ends[0] : null;
    const endInfo = ri === runs.length - 1 ? ctx.ends[1] : null;

    const finish = (info, p, width, dirOut, isStart) => {
      // dirOut: direction pointing out of the stroke at this end.
      if (!info) return;
      if (info.zone && Math.abs(dirOut.y) > 0.3 && (ctx.terminal !== 'rounded' || info.serif)) {
        const outward = info.zone.side === 'bottom' ? -1 : 1;
        if (isStart) {
          L = clipToZone(L.slice().reverse(), dirOut, info.zone.y, outward).reverse();
          R = clipToZone(R.slice().reverse(), dirOut, info.zone.y, outward).reverse();
        } else {
          L = clipToZone(L, dirOut, info.zone.y, outward);
          R = clipToZone(R, dirOut, info.zone.y, outward);
        }
        if (info.serif) {
          const a = isStart ? L[0] : L[L.length - 1];
          const b = isStart ? R[0] : R[R.length - 1];
          serifs.push(serifContour(Math.min(a.x, b.x), Math.max(a.x, b.x), info.zone.y, info.zone.side === 'bottom' ? 1 : -1, ctx.serif, info.serif === 'head'));
        }
      } else if (ctx.terminal === 'rounded') {
        const cap = arc(p, width / 2, angleOf(perpLeft(dirOut)), -Math.PI, ctx.arcSteps * 2);
        (isStart ? startCap : endCap).push(...cap);
      }
    };
    const last = run.length - 1;
    finish(endInfo, run[last], w[last], run[last].t, false);
    finish(startInfo, run[0], w[0], mul(run[0].t, -1), true);
    const contour = [...L, ...endCap, ...R.slice().reverse(), ...startCap];
    if (contour.length >= 3) contours.push(ccw(contour));
  });

  // Miter patches between consecutive runs (and across the seam of a closed stroke).
  const joinCount = sampled.closed ? runs.length : runs.length - 1;
  for (let k = 0; k < joinCount; k++) {
    const a = runs[k], b = runs[(k + 1) % runs.length];
    const pa = a[a.length - 1], pb = b[0];
    const P = pa;
    const t1 = pa.t, t2 = pb.t;
    const turn = cross(t1, t2);
    if (Math.abs(turn) < 1e-3 && dot(t1, t2) > 0) continue;
    const w1 = runWidths[k][a.length - 1], w2 = runWidths[(k + 1) % runs.length][0];
    const side = turn > 0 ? -1 : 1;
    const A1 = add(P, mul(perpLeft(t1), (side * w1) / 2));
    const A2 = add(P, mul(perpLeft(t2), (side * w2) / 2));
    const M = lineIntersect(A1, t1, A2, t2);
    const limit = 1.6 * Math.max(w1, w2); // sharper corners get bevelled, not spiked
    const poly = M && dist(M, P) < limit && dot(sub(M, A1), t1) > -1e-6 ? [P, A1, M, A2] : [P, A1, A2];
    if (Math.abs(polyArea(poly)) > 1e-3) contours.push(ccw(poly));
  }
  return { contours, serifs };
}

export function dotContour(c, size, square, steps) {
  const r = size / 2;
  if (square) return ccw([{ x: c.x - r, y: c.y - r }, { x: c.x + r, y: c.y - r }, { x: c.x + r, y: c.y + r }, { x: c.x - r, y: c.y + r }]);
  const n = Math.max(12, steps * 4);
  const pts = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    pts.push({ x: c.x + r * Math.cos(a), y: c.y + r * Math.sin(a) });
  }
  return pts;
}

