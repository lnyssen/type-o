// Intelligent auto-metrics: side profiles, optical spacing and kerning.
//
// Spacing follows the HT Letterspacer idea: every side should enclose the same
// amount of white (depth-limited) as a straight stem with the base
// sidebearing. Kerning compares, for a pair, how close the two shapes get
// (a softened minimum of the gap across the shared height band) with how
// close two straight stems would get, and closes the difference.

export const PROFILE_STEP = 10;

// Horizontal extremes of the ink at each height bin (NaN where no ink).
export function computeProfile(contours, bb) {
  const y0 = Math.floor(bb.yMin / PROFILE_STEP) * PROFILE_STEP;
  const n = Math.max(1, Math.ceil((bb.yMax - y0) / PROFILE_STEP));
  const L = new Float64Array(n).fill(NaN);
  const R = new Float64Array(n).fill(NaN);
  for (const c of contours) {
    for (let i = 0, len = c.length; i < len; i++) {
      const p = c[i], q = c[(i + 1) % len];
      if (p.y === q.y) continue;
      const lo = Math.min(p.y, q.y), hi = Math.max(p.y, q.y);
      const k0 = Math.max(0, Math.ceil((lo - y0) / PROFILE_STEP - 0.5));
      const k1 = Math.min(n - 1, Math.floor((hi - y0) / PROFILE_STEP - 0.5));
      for (let k = k0; k <= k1; k++) {
        const y = y0 + (k + 0.5) * PROFILE_STEP;
        const x = p.x + ((y - p.y) * (q.x - p.x)) / (q.y - p.y);
        if (Number.isNaN(L[k]) || x < L[k]) L[k] = x;
        if (Number.isNaN(R[k]) || x > R[k]) R[k] = x;
      }
    }
  }
  return { y0, L, R };
}

// Height band a glyph is spaced (and kerned) within.
export function spacingBand(kind, bb, m) {
  const caseTop = kind === 'lower' || kind === 'punct' ? m.xHeight : m.capHeight;
  const lo = Math.max(0, bb.yMin), hi = Math.min(caseTop, bb.yMax);
  if (hi - lo >= caseTop * 0.4) return [0, caseTop];
  return [bb.yMin, bb.yMax];
}

function eachBin(profile, band, fn) {
  const { y0, L } = profile;
  for (let k = 0; k < L.length; k++) {
    const y = y0 + (k + 0.5) * PROFILE_STEP;
    if (y >= band[0] && y <= band[1]) fn(k, y);
  }
}

export function baseSpacing(kind, D) {
  const lower = D.spacing * (0.42 * D.stem + 0.07 * D.m.xHeight) * Math.sqrt(D.widthFactor);
  if (kind === 'upper') return lower * 1.22;
  if (kind === 'figure') return lower * 1.12;
  if (kind === 'symbol' || kind === 'punct') return lower * 0.95;
  return lower;
}

// Horizontal extent of the ink inside the spacing band. Parts outside it
// (the hook of j, the flag of f, the tail of y) are allowed to overhang the
// sidebearings, as they do in real type.
export function bandExtent(profile, band) {
  let left = Infinity, right = -Infinity;
  eachBin(profile, band, (k) => {
    if (Number.isNaN(profile.L[k])) return;
    left = Math.min(left, profile.L[k]);
    right = Math.max(right, profile.R[k]);
  });
  return left === Infinity ? null : { left, right };
}

// Sidebearings measured from the band extent (see bandExtent).
export function autoSidebearings(profile, bb, band, base, depth) {
  const ext = bandExtent(profile, band) || { left: bb.xMin, right: bb.xMax };
  let wl = 0, wr = 0, n = 0;
  eachBin(profile, band, (k) => {
    n++;
    const l = profile.L[k], r = profile.R[k];
    wl += Number.isNaN(l) ? depth : Math.min(l - ext.left, depth);
    wr += Number.isNaN(r) ? depth : Math.min(ext.right - r, depth);
  });
  if (!n) return { lsb: base, rsb: base, ...ext };
  const floor = base * 0.2;
  return { lsb: Math.max(floor, base - wl / n), rsb: Math.max(floor, base - wr / n), ...ext };
}

// Distances from the advance box edges to the ink, per bin, in a shared
// global y grid so any two glyphs can be compared bin by bin.
export function sideDistances(g, grid) {
  const right = new Float64Array(grid.n).fill(NaN);
  const left = new Float64Array(grid.n).fill(NaN);
  const { y0, L, R } = g.profile;
  const dx = g.dx ?? 0; // profiles are stored unshifted
  for (let k = 0; k < L.length; k++) {
    const gk = Math.round((y0 - grid.y0) / PROFILE_STEP) + k;
    if (gk < 0 || gk >= grid.n || Number.isNaN(L[k])) continue;
    left[gk] = L[k] + dx;
    right[gk] = g.advance - (R[k] + dx);
  }
  return { left, right };
}

// Kerning value for one pair of spaced glyphs (null when not worth kerning).
export function pairKerning(a, b, grid, ctx) {
  const lo = Math.max(a.band[0], b.band[0]);
  const hi = Math.min(a.band[1], b.band[1]);
  const cap = ctx.cap;
  const gaps = [];
  let rawMin = Infinity;
  for (let k = 0; k < grid.n; k++) {
    const y = grid.y0 + (k + 0.5) * PROFILE_STEP;
    const ra = a.sides.right[k], lb = b.sides.left[k];
    if (!Number.isNaN(ra) && !Number.isNaN(lb)) rawMin = Math.min(rawMin, ra + lb);
    if (y < lo || y > hi) continue;
    const ga = Number.isNaN(ra) ? cap : Math.min(ra, cap);
    const gb = Number.isNaN(lb) ? cap : Math.min(lb, cap);
    gaps.push(ga + gb);
  }
  const bandHeight = hi - lo;
  if (gaps.length < 3 || bandHeight < ctx.xHeight * 0.18) return null;
  gaps.sort((x, y) => x - y);
  const take = Math.max(2, Math.round(gaps.length * 0.2));
  let soft = 0;
  for (let i = 0; i < take; i++) soft += gaps[i];
  soft /= take;
  const ref = a.baseSpacing + b.baseSpacing;
  // Pairs that only share a sliver of height (punctuation against capitals)
  // get a proportionally smaller correction, and no pair moves more than
  // about half a sidebearing pair.
  const share = Math.min(1, bandHeight / (0.6 * ctx.xHeight));
  let kern = Math.max(-(soft - ref) * 0.55 * share, -0.45 * ref);
  // Never let a kern make the shapes (nearly) collide.
  const minGap = ref * 0.3;
  if (Number.isFinite(rawMin) && rawMin + kern < minGap) kern = Math.min(0, minGap - rawMin);
  kern = Math.round(kern / 5) * 5;
  return kern <= -10 ? kern : null;
}

// Which pairs get auto-kerned: the usual suspects on the left, everything
// letter-like on the right.
export const KERN_LEFT = 'ABCDEFGKLOPQRSTUVWXYZabcefkoprstvwxyz.,-’”\'"«»/(7'.split('');
export const KERN_RIGHT = 'ABCDGJOQSTUVWXYZacdegjmnopqrsuvwxyz.,-’‘“”\'"«»)/47'.split('');
