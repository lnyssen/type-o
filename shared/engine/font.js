// Whole-font generation: skeletons + parameters + metrics → spaced, kerned
// glyph outlines. Used by the browser worker (live preview) and by the server
// (export), so both always agree.

import { BASE, MARKS, COMPOSITES, ALIASES, compositeName } from '../glyphs/latin.js';
import { parseSkeleton, rotate180, translateSkeleton, skeletonBounds } from './skeleton.js';
import { derive } from './params.js';
import { buildGlyph, contoursBounds, translateContours } from './glyph.js';
import { computeProfile, spacingBand, baseSpacing, autoSidebearings, bandExtent, sideDistances, pairKerning, PROFILE_STEP, KERN_LEFT, KERN_RIGHT } from './metrics.js';

// ---------------------------------------------------------------------------
// Glyph catalogue

const defaultCache = new Map();

function baseSkeleton(name) {
  if (!defaultCache.has(name)) {
    const [, , src, derived] = BASE[name];
    let sk;
    if (derived?.rotate) {
      const from = baseSkeleton(derived.rotate);
      const b = skeletonBounds(from);
      sk = rotate180(from, (b.xMin + b.xMax) / 2, (b.yMin + b.yMax) / 2);
      if (derived.dy) sk = translateSkeleton(sk, 0, derived.dy);
    } else sk = parseSkeleton(src || '');
    defaultCache.set(name, sk);
  }
  return defaultCache.get(name);
}

function markSkeleton(name) {
  const key = `mark:${name}`;
  if (!defaultCache.has(key)) {
    const [src, , derived] = MARKS[name];
    let sk;
    if (derived?.rotate) {
      const from = markSkeleton(derived.rotate);
      const b = skeletonBounds(from);
      sk = rotate180(from, (b.xMin + b.xMax) / 2, (b.yMin + b.yMax) / 2);
    } else sk = parseSkeleton(src);
    defaultCache.set(key, sk);
  }
  return defaultCache.get(key);
}

const KIND_LABEL = { upper: 'Uppercase', lower: 'Lowercase', figure: 'Figures', symbol: 'Symbols', punct: 'Punctuation', space: 'Punctuation' };

// Ordered list of every glyph in the font.
export const GLYPHS = (() => {
  const list = [];
  for (const [name, [char, kind]] of Object.entries(BASE)) {
    const isLig = char === null;
    list.push({
      name, char, kind, type: isLig ? 'ligature' : 'base',
      unicodes: char ? [char.codePointAt(0), ...(ALIASES[name] || [])] : [],
      group: isLig ? 'Ligatures' : KIND_LABEL[kind],
    });
  }
  for (const { char, base, mark } of COMPOSITES) {
    const baseKind = BASE[base][1];
    list.push({
      name: compositeName(base, mark), char, kind: baseKind === 'space' ? 'symbol' : baseKind,
      type: 'composite', base, mark, unicodes: [char.codePointAt(0)],
      group: baseKind === 'space' ? 'Symbols' : 'Accented',
    });
  }
  return list;
})();

export const GLYPH_BY_NAME = new Map(GLYPHS.map((g) => [g.name, g]));
export const GLYPH_BY_CHAR = new Map(GLYPHS.filter((g) => g.char).map((g) => [g.char, g]));
export const MARK_NAMES = Object.keys(MARKS);

// Glyphs whose skeleton can be edited: every base glyph plus the accents.
export function editableGlyphs() {
  return [
    ...GLYPHS.filter((g) => g.type !== 'composite' && g.name !== 'space').map((g) => ({ id: g.name, label: g.char ?? g.name.replace(/_/g, ''), kind: g.kind, group: g.group })),
    ...MARK_NAMES.map((m) => ({ id: `mark:${m}`, label: m, kind: 'mark-lower', group: 'Accents' })),
  ];
}

// The skeleton in effect for an editable id ("A", "mark:acute"...).
export function skeletonFor(id, overrides = {}) {
  if (overrides[id]) return overrides[id];
  if (id.startsWith('mark:')) return markSkeleton(id.slice(5));
  return baseSkeleton(id);
}

export const LIGATURES = [
  ['f_f_i', ['f', 'f', 'i']], ['f_f_l', ['f', 'f', 'l']], ['f_f', ['f', 'f']], ['f_i', ['f', 'i']], ['f_l', ['f', 'l']],
];

// ---------------------------------------------------------------------------
// Generation

const buildCache = new Map();
const MAX_CACHE = 4000;

function cachedBuild(key, fn) {
  if (buildCache.has(key)) return buildCache.get(key);
  const v = fn();
  if (buildCache.size > MAX_CACHE) buildCache.clear();
  buildCache.set(key, v);
  return v;
}

function geometryKey(D, quality) {
  const { p, m } = D;
  return JSON.stringify([p, m.xHeight, m.capHeight, m.ascender, m.descender, quality]);
}

// Where an accent goes on a given base.
function placeMark(base, mark, mode, D, markName) {
  const mb = mark.bbox;
  const bb = base.bbox;
  const upper = base.kind === 'upper' || base.kind === 'figure';
  const caseTop = upper ? D.m.capHeight : D.m.xHeight;
  const inkCenter = (y0, y1) => {
    let lo = Infinity, hi = -Infinity;
    const { L, R } = base.profile;
    for (let k = 0; k < L.length; k++) {
      const y = base.profile.y0 + (k + 0.5) * PROFILE_STEP;
      if (y < y0 || y > y1 || Number.isNaN(L[k])) continue;
      lo = Math.min(lo, L[k]); hi = Math.max(hi, R[k]);
    }
    return lo === Infinity ? (bb.xMin + bb.xMax) / 2 : (lo + hi) / 2;
  };
  const mcx = (mb.xMin + mb.xMax) / 2;
  if (mode === 'top') {
    const gap = upper ? D.m.capHeight * 0.06 : D.m.xHeight * 0.1;
    const cx = inkCenter(caseTop * 0.7, bb.yMax + 1);
    return [cx - mcx, bb.yMax + gap - mb.yMin];
  }
  if (mode === 'bottom') {
    const cx = inkCenter(0, caseTop * 0.25);
    const top = markName === 'cedilla' ? D.stem * 0.3 : -D.stem * 0.35;
    return [cx - mcx, top - mb.yMax];
  }
  if (mode === 'ogonek') {
    let right = -Infinity;
    const { L, R } = base.profile;
    for (let k = 0; k < L.length; k++) {
      const y = base.profile.y0 + (k + 0.5) * PROFILE_STEP;
      if (y >= 0 && y <= caseTop * 0.15 && !Number.isNaN(R[k])) right = Math.max(right, R[k]);
    }
    if (right === -Infinity) right = bb.xMax;
    return [right - D.stem * 0.55 - (mb.xMax - mb.xMin) * 0.35 - mb.xMin, D.stem * 0.35 - mb.yMax];
  }
  // 'right': vertical caron beside an ascender (ď ľ ť Ľ).
  return [bb.xMax + D.stem * 0.45 - mb.xMin, bb.yMax - mb.yMax];
}

function buildBase(name, sk, kind, D, quality, gkey) {
  const skKey = sk.__key || (sk.__key = JSON.stringify(sk.strokes));
  return cachedBuild(`${gkey}|${name}|${skKey}`, () => {
    const g = buildGlyph(name, sk, kind, D, { quality });
    const bbox = contoursBounds(g.contours);
    const bodyBBox = g.serifCount ? contoursBounds(g.body) : bbox;
    const profile = bbox ? computeProfile(g.contours, bbox) : null;
    const bodyProfile = g.serifCount && bodyBBox ? computeProfile(g.body, bodyBBox) : profile;
    return { ...g, bbox, profile, bodyBBox, bodyProfile };
  });
}

/**
 * project: { params, metrics, skeletons } (see project.js)
 * opts.quality: 'preview' | 'export'
 * opts.only: optional Set of glyph names to build (preview of a subset)
 */
export function generateFont(project, opts = {}) {
  const quality = opts.quality || 'preview';
  const D = derive(project.params, project.metrics);
  const overrides = project.skeletons || {};
  const gkey = geometryKey(D, quality);
  const depth = D.m.xHeight * 0.15;

  // Raw (unspaced) outlines of base glyphs.
  const raw = new Map();
  for (const g of GLYPHS) {
    if (g.type === 'composite') continue;
    raw.set(g.name, buildBase(g.name, skeletonFor(g.name, overrides), g.kind === 'space' ? 'punct' : g.kind, D, quality, gkey));
  }

  // Accent outlines, one set sized for lowercase and one for capitals.
  const markCache = { 'mark-lower': new Map(), 'mark-upper': new Map() };
  const markOutline = (mark, kind) => {
    if (!markCache[kind].has(mark)) {
      const sk = skeletonFor(`mark:${mark}`, overrides);
      markCache[kind].set(mark, buildBase(`${kind}:${mark}`, sk, kind, D, quality, gkey));
    }
    return markCache[kind].get(mark);
  };

  const glyphs = new Map();
  const spaceAdvance = Math.round((0.5 * D.m.xHeight * D.widthFactor + 0.3 * D.stem) * Math.sqrt(D.spacing));

  // Spacing of base glyphs and ligatures.
  for (const g of GLYPHS) {
    if (g.type === 'composite') continue;
    const r = raw.get(g.name);
    if (!r.bbox) {
      glyphs.set(g.name, { ...g, contours: [], advance: spaceAdvance, lsb: 0, bbox: null, profile: null });
      continue;
    }
    // Space the letter's body; serifs may reach into the sidebearings but
    // always keep a clear gap to the neighbour's serifs.
    const body = r.bodyBBox;
    const band = spacingBand(g.kind, body, D.m);
    const base = baseSpacing(g.kind, D);
    let { lsb, rsb, left, right } = autoSidebearings(r.bodyProfile, body, band, base, depth);
    if (r.serifCount) {
      const full = bandExtent(r.profile, band);
      const minGap = base * 0.3;
      if (full) {
        lsb = Math.max(lsb, left - full.left + minGap);
        rsb = Math.max(rsb, full.right - right + minGap);
      }
    }
    const dx = lsb - left;
    glyphs.set(g.name, {
      ...g,
      contours: translateContours(r.contours, dx, 0),
      advance: Math.round(lsb + (right - left) + rsb),
      lsb: r.bbox.xMin + dx,
      dx,
      bbox: { ...r.bbox, xMin: r.bbox.xMin + dx, xMax: r.bbox.xMax + dx },
      profile: r.profile,
      rawBBox: r.bbox,
      band,
      baseSpacing: base,
    });
  }

  // Composites: base outline + positioned accent, sharing the base's spacing.
  for (const g of GLYPHS) {
    if (g.type !== 'composite') continue;
    const [, mode] = MARKS[g.mark];
    const baseRaw = raw.get(g.base);
    const baseG = glyphs.get(g.base);
    const mkind = g.kind === 'upper' || g.kind === 'figure' ? 'mark-upper' : 'mark-lower';
    const mk = markOutline(g.mark, mkind);
    if (!mk.bbox) continue;
    if (g.base === 'space') {
      // Spacing accents (¨ ´ ¯ ¸ `): the accent alone, spaced as a symbol.
      const dy = mode === 'bottom' ? -mk.bbox.yMax + D.stem * 0.3 : D.m.xHeight * 1.1 - mk.bbox.yMin;
      const contours = translateContours(mk.contours, -mk.bbox.xMin, dy);
      const bbox = contoursBounds(contours);
      const base = baseSpacing('symbol', D);
      const dx = base;
      glyphs.set(g.name, {
        ...g,
        contours: translateContours(contours, dx, 0),
        advance: Math.round(bbox.xMax - bbox.xMin + 2 * base),
        lsb: dx,
        dx,
        bbox: { ...bbox, xMin: bbox.xMin + dx, xMax: bbox.xMax + dx },
        profile: computeProfile(contours, bbox),
        rawBBox: bbox,
        band: [bbox.yMin, bbox.yMax],
        baseSpacing: base,
      });
      continue;
    }
    const [mx, my] = placeMark(baseRaw, mk, mode, D, g.mark);
    const dx = baseG.dx;
    const markContours = translateContours(mk.contours, mx + dx, my);
    const contours = [...baseG.contours, ...markContours];
    const bbox = contoursBounds(contours);
    let advance = baseG.advance;
    if (mode === 'right') advance = Math.max(advance, Math.round(bbox.xMax + baseG.baseSpacing * 0.35));
    glyphs.set(g.name, {
      ...g,
      contours,
      advance,
      lsb: bbox.xMin,
      bbox,
      profile: baseG.profile,
      rawBBox: baseG.rawBBox,
      band: baseG.band,
      baseSpacing: baseG.baseSpacing,
      kernGroup: g.base,
      dx,
    });
  }

  // Manual advance widths (keyed by character).
  for (const [ch, adv] of Object.entries(D.m.advanceWidths)) {
    const g = GLYPH_BY_CHAR.get(ch);
    if (g && glyphs.has(g.name)) glyphs.get(g.name).advance = adv;
  }

  // Kerning between group representatives.
  const autoKerning = {};
  if (opts.kerning !== false) {
    let gy0 = Infinity, gy1 = -Infinity;
    for (const g of glyphs.values()) if (g.profile) { gy0 = Math.min(gy0, g.profile.y0); gy1 = Math.max(gy1, g.profile.y0 + g.profile.L.length * PROFILE_STEP); }
    const grid = { y0: gy0, n: Math.ceil((gy1 - gy0) / PROFILE_STEP) };
    const prep = (ch) => {
      const meta = GLYPH_BY_CHAR.get(ch);
      const g = meta && glyphs.get(meta.name);
      if (!g || !g.profile) return null;
      if (!g.sides) g.sides = sideDistances(g, grid);
      return g;
    };
    const lefts = KERN_LEFT.map(prep).filter(Boolean);
    const rights = KERN_RIGHT.map(prep).filter(Boolean);
    const ctx = { cap: D.m.xHeight * 0.6, xHeight: D.m.xHeight };
    for (const a of lefts)
      for (const b of rights) {
        const k = pairKerning(a, b, grid, ctx);
        if (k !== null) autoKerning[`${a.name}|${b.name}`] = k;
      }
  }

  const kerning = D.m.auto ? { ...autoKerning } : {};
  for (const [pair, v] of Object.entries(D.m.kerning)) {
    const [c1, c2] = [...pair];
    const a = GLYPH_BY_CHAR.get(c1), b = GLYPH_BY_CHAR.get(c2);
    if (!a || !b) continue;
    const ka = a.base && a.base !== 'space' ? a.base : a.name;
    const kb = b.base && b.base !== 'space' ? b.base : b.name;
    kerning[`${ka}|${kb}`] = v;
  }

  return { D, glyphs, order: GLYPHS.map((g) => g.name).filter((n) => glyphs.has(n)), kerning, autoKerning };
}

// Kerning lookup honouring groups (composites kern like their base).
export function kernGroupOf(g) {
  return g.kernGroup || g.name;
}

export function pairToChars(pair) {
  const [a, b] = pair.split('|');
  const ca = GLYPH_BY_NAME.get(a)?.char, cb = GLYPH_BY_NAME.get(b)?.char;
  return ca && cb ? ca + cb : null;
}
