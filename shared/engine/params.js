// The 8 parametric controls, the vertical metrics, and everything derived
// from them. Every consumer (preview, metrics, export) goes through here so a
// given project always produces the same font.

export const PARAM_SPEC = {
  construction: { type: 'enum', options: ['geometric', 'grotesque', 'humanist'], default: 'grotesque', label: 'Construction', hint: 'Letter structure: alternates (a, g, y, t…), round proportions, stress axis, terminal cuts' },
  weight: { type: 'range', min: 0, max: 100, default: 45, label: 'Weight', hint: 'Stroke thickness' },
  contrast: { type: 'range', min: 0, max: 100, default: 25, label: 'Contrast', hint: 'Thick / thin ratio (broad-nib stress)' },
  terminals: { type: 'enum', options: ['sharp', 'rounded', 'serif'], default: 'sharp', label: 'Terminals', hint: 'Shape of free stroke ends. Serif = flared ends' },
  modulation: { type: 'range', min: 0, max: 100, default: 0, label: 'Modulation', hint: 'Organic sinuosity of curves and strokes (driven by the seed)' },
  width: { type: 'enum', options: ['condensed', 'normal', 'expanded'], default: 'normal', label: 'Width', hint: 'Horizontal proportions' },
  tension: { type: 'range', min: 0, max: 100, default: 50, label: 'Tension', hint: 'Curve energy: low = soft, high = squarish' },
  aperture: { type: 'range', min: 0, max: 100, default: 50, label: 'Aperture', hint: 'How open c, e, s, a… are: closed (Helvetica) to open (Frutiger)' },
  slant: { type: 'range', min: 0, max: 14, default: 0, label: 'Slant', hint: 'Italic angle in degrees' },
  seed: { type: 'int', min: 0, max: 2147483647, default: 12345, label: 'Seed', hint: 'Reproducible randomness' },
  serifMode: { type: 'bool', default: false, label: 'Serif mode', hint: 'Adds bracketed serifs to stems' },
};

export const METRIC_SPEC = {
  xHeight: { min: 380, max: 620, default: 500, label: 'x-height' },
  capHeight: { min: 560, max: 800, default: 700, label: 'Cap height' },
  ascender: { min: 650, max: 900, default: 760, label: 'Ascender' },
  descender: { min: -350, max: -120, default: -220, label: 'Descender' },
  spacing: { min: 50, max: 200, default: 100, label: 'Spacing %' },
};

export const UPM = 1000;

export function defaultParams() {
  return Object.fromEntries(Object.entries(PARAM_SPEC).map(([k, s]) => [k, s.default]));
}

export function defaultMetrics() {
  return {
    auto: true,
    ...Object.fromEntries(Object.entries(METRIC_SPEC).map(([k, s]) => [k, s.default])),
    kerning: {},
    advanceWidths: {},
  };
}

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

// Coerce anything user-provided into a valid parameter set.
export function normalizeParams(p = {}) {
  const out = {};
  for (const [k, s] of Object.entries(PARAM_SPEC)) {
    const v = p[k];
    if (s.type === 'range') out[k] = Number.isFinite(+v) && v !== null && v !== '' ? clamp(+v, s.min, s.max) : s.default;
    else if (s.type === 'int') out[k] = Number.isFinite(+v) && v !== null && v !== '' ? clamp(Math.round(+v), s.min, s.max) : s.default;
    else if (s.type === 'enum') out[k] = s.options.includes(v) ? v : s.default;
    else if (s.type === 'bool') out[k] = typeof v === 'boolean' ? v : s.default;
  }
  return out;
}

export function normalizeMetrics(m = {}) {
  const out = { auto: m.auto !== false };
  for (const [k, s] of Object.entries(METRIC_SPEC))
    out[k] = Number.isFinite(+m[k]) && m[k] !== null && m[k] !== '' ? clamp(Math.round(+m[k]), s.min, s.max) : s.default;
  out.capHeight = Math.max(out.capHeight, out.xHeight + 60);
  out.ascender = Math.max(out.ascender, out.capHeight, out.xHeight + 120);
  out.kerning = {};
  for (const [pair, v] of Object.entries(m.kerning || {}))
    if (typeof pair === 'string' && [...pair].length === 2 && Number.isFinite(+v)) out.kerning[pair] = clamp(Math.round(+v), -500, 500);
  out.advanceWidths = {};
  for (const [ch, v] of Object.entries(m.advanceWidths || {}))
    if (typeof ch === 'string' && [...ch].length === 1 && Number.isFinite(+v)) out.advanceWidths[ch] = clamp(Math.round(+v), 0, 3000);
  return out;
}

const WIDTH_FACTOR = { condensed: 0.8, normal: 1, expanded: 1.22 };

// What each construction implies beyond its alternates.
export const CONSTRUCTIONS = {
  geometric: { roundX: 1.06, penAngle: 0, terminalCut: 'perpendicular', aperture: 0.05 },
  grotesque: { roundX: 0.92, penAngle: 6, terminalCut: 'horizontal', aperture: -0.12 },
  humanist: { roundX: 0.9, penAngle: 30, terminalCut: 'perpendicular', aperture: 0.2 },
};

// Numbers the geometry actually uses.
export function derive(params, metrics) {
  const p = normalizeParams(params);
  const m = normalizeMetrics(metrics);
  const stem = 18 + p.weight * 1.45; // lowercase vertical stem, font units
  // Heavy weights get a little built-in contrast so bars and counters stay open.
  const contrast = p.contrast / 100 + (1 - p.contrast / 100) * 0.36 * (p.weight / 100) ** 2;
  const C = CONSTRUCTIONS[p.construction];
  return {
    p,
    m,
    stem,
    construction: p.construction,
    roundX: C.roundX,
    terminalCut: C.terminalCut,
    // Fraction of the arc a terminal travels: + opens, − closes.
    aperture: C.aperture + ((p.aperture - 50) / 50) * 0.35,
    slant: Math.tan((p.slant * Math.PI) / 180),
    thinRatio: 1 - 0.85 * contrast,
    contrast,
    penAngle: (C.penAngle * Math.PI) / 180,
    tension: 1.12 - p.tension * 0.003, // Hobby tension: 1.12 (soft) → 0.82 (squarish)
    modulation: p.modulation / 100,
    widthFactor: WIDTH_FACTOR[p.width],
    // Wider skeletons as weight grows keeps counters open.
    xScale: WIDTH_FACTOR[p.width] * (1 + (stem - 83) / 480),
    overshoot: Math.round(m.xHeight * 0.014),
    spacing: m.spacing / 100,
  };
}

// Human style name + OS/2 weight class for the exported font.
export function styleFor(params) {
  const np = normalizeParams(params);
  const w = np.weight;
  const table = [
    [8, 'Thin', 100], [20, 'ExtraLight', 200], [32, 'Light', 300], [48, 'Regular', 400],
    [60, 'Medium', 500], [72, 'SemiBold', 600], [84, 'Bold', 700], [93, 'ExtraBold', 800], [101, 'Black', 900],
  ];
  const [, name, cls] = table.find(([lim]) => w < lim);
  const italic = np.slant > 0;
  const styleName = italic ? (name === 'Regular' ? 'Italic' : `${name} Italic`) : name;
  return { styleName, weightClass: cls, italic, italicAngle: -np.slant };
}
