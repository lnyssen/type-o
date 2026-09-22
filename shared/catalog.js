// Master catalogue: professionally designed variable fonts (SIL Open Font
// License) that GenType instantiates and transforms. Files live in
// server/masters/<id>/{roman,italic}.ttf with their OFL.txt.
//
// Axis labels are what the interface shows; `hint` explains what the axis
// does to the letters. Values come straight from each font's fvar table.

export const GENRES = ['Grotesk', 'Geometric', 'Humanist', 'Serif', 'Didone', 'Slab', 'Rounded', 'Display', 'Casual', 'Script'];

const AXIS_LABELS = {
  wght: { label: 'Weight', hint: 'Stroke thickness' },
  wdth: { label: 'Width', hint: 'Horizontal proportions' },
  opsz: { label: 'Optical size', hint: 'Low: sturdy text cut. High: refined, high-contrast display cut' },
  slnt: { label: 'Slant', hint: 'Italic angle' },
  GRAD: { label: 'Grade', hint: 'Weight without changing widths' },
  XOPQ: { label: 'Stem thickness', hint: 'Thickness of vertical strokes' },
  YOPQ: { label: 'Hairline thickness', hint: 'Thickness of horizontal strokes — lower it for more contrast' },
  XTRA: { label: 'Counter width', hint: 'Width of the white inside letters' },
  YTUC: { label: 'Cap height', hint: 'Height of capitals' },
  YTLC: { label: 'x-height', hint: 'Height of lowercase letters' },
  YTAS: { label: 'Ascenders', hint: 'Height of b, d, h, k, l' },
  YTDE: { label: 'Descenders', hint: 'Depth of g, j, p, q, y' },
  YTFI: { label: 'Figure height', hint: 'Height of numerals' },
  SOFT: { label: 'Softness', hint: 'Rounds off corners and terminals' },
  WONK: { label: 'Wonky', hint: 'Swaps in quirky, leaning alternates' },
  CASL: { label: 'Casual', hint: 'From linear to brush-written' },
  MONO: { label: 'Monospace', hint: 'Proportional to fixed-width' },
  CRSV: { label: 'Cursive', hint: 'Cursive alternates (a, f, i, l…)' },
};

const axis = (tag, min, def, max, step) => ({ tag, min, default: def, max, step: step ?? (max - min <= 2 ? (max - min <= 1 ? 0.01 : 0.1) : 1), ...AXIS_LABELS[tag] });

export const FAMILIES = [
  {
    id: 'robotoflex', name: 'Roboto Flex', genre: 'Grotesk', italic: false,
    credit: 'Roboto Flex Project Authors (Font Bureau, Google)',
    blurb: 'Thirteen axes: widths, weights, x-height, ascenders, contrast. The most parametric grotesk there is.',
    axes: [axis('wght', 100, 400, 1000), axis('wdth', 25, 100, 151), axis('opsz', 8, 14, 144), axis('YTLC', 416, 514, 570), axis('YTUC', 528, 712, 760), axis('YTAS', 649, 750, 854), axis('YTDE', -305, -203, -98), axis('XOPQ', 27, 96, 175), axis('YOPQ', 25, 79, 135), axis('XTRA', 323, 468, 603), axis('GRAD', -200, 0, 150), axis('slnt', -10, 0, 0)],
  },
  {
    id: 'inter', name: 'Inter', genre: 'Grotesk', italic: true,
    credit: 'Inter Project Authors (Rasmus Andersson)',
    blurb: 'A neo-grotesk tuned for screens, with a large x-height and tight, even spacing.',
    axes: [axis('wght', 100, 400, 900), axis('opsz', 14, 14, 32)],
  },
  {
    id: 'archivo', name: 'Archivo', genre: 'Grotesk', italic: true,
    credit: 'Archivo Project Authors (Omnibus-Type)',
    blurb: 'Classic grotesk with a real width axis, from compressed poster to wide.',
    axes: [axis('wght', 100, 400, 900), axis('wdth', 62, 100, 125)],
  },
  {
    id: 'spacegrotesk', name: 'Space Grotesk', genre: 'Grotesk', italic: false,
    credit: 'Space Grotesk Project Authors (Florian Karsten)',
    blurb: 'A quirky grotesk with geometric bones and idiosyncratic details.',
    axes: [axis('wght', 300, 400, 700)],
  },
  {
    id: 'jost', name: 'Jost', genre: 'Geometric', italic: true,
    credit: 'Jost Project Authors (indestructible type*)',
    blurb: 'Futura-inspired geometric sans: circular o, single-storey a, pointed apexes.',
    axes: [axis('wght', 100, 400, 900)],
  },
  {
    id: 'sourcesans3', name: 'Source Sans 3', genre: 'Humanist', italic: true, rfn: ['Source'],
    credit: 'Adobe (Paul D. Hunt)',
    blurb: 'Humanist sans with calligraphic roots, open apertures and a warm rhythm.',
    axes: [axis('wght', 200, 400, 900)],
  },
  {
    id: 'ebgaramond', name: 'EB Garamond', genre: 'Serif', italic: true,
    credit: 'EB Garamond Project Authors (Georg Duffner, Octavio Pardo)',
    blurb: 'Old-style serif after Claude Garamont: small x-height, lively Renaissance forms.',
    axes: [axis('wght', 400, 400, 800)],
  },
  {
    id: 'fraunces', name: 'Fraunces', genre: 'Serif', italic: true,
    credit: 'Fraunces Project Authors (Undercase Type)',
    blurb: '“Old Style soft” display serif: add softness, or switch on the wonky alternates.',
    axes: [axis('wght', 100, 400, 900), axis('opsz', 9, 144, 144), axis('SOFT', 0, 0, 100), axis('WONK', 0, 0, 1, 1)],
  },
  {
    id: 'sourceserif4', name: 'Source Serif 4', genre: 'Serif', italic: true, rfn: ['Source'],
    credit: 'Adobe (Frank Grießhammer)',
    blurb: 'Transitional serif with optical sizes from caption to display.',
    axes: [axis('wght', 200, 400, 900), axis('opsz', 8, 20, 60)],
  },
  {
    id: 'bodonimoda', name: 'Bodoni Moda', genre: 'Didone', italic: true,
    credit: 'Bodoni Moda Project Authors (indestructible type*)',
    blurb: 'A true Bodoni: vertical stress, hairline serifs, optical sizes for fashion headlines.',
    axes: [axis('wght', 400, 400, 900), axis('opsz', 6, 11, 96)],
  },
  {
    id: 'playfair', name: 'Playfair', genre: 'Didone', italic: true,
    credit: 'Playfair Project Authors (Claus Eggers Sørensen)',
    blurb: 'High-contrast transitional-to-didone family with width and extreme optical sizes.',
    axes: [axis('wght', 300, 400, 900), axis('wdth', 87.5, 100, 112.5, 0.5), axis('opsz', 5, 14, 1200)],
  },
  {
    id: 'bitter', name: 'Bitter', genre: 'Slab', italic: true, rfn: ['Bitter Pro'],
    credit: 'Bitter Project Authors (Huerta Tipográfica)',
    blurb: 'Contemporary slab serif with small contrast and sturdy square serifs.',
    axes: [axis('wght', 100, 400, 900)],
  },
  {
    id: 'nunito', name: 'Nunito', genre: 'Rounded', italic: true,
    credit: 'Nunito Project Authors (Vernon Adams, Cyreal)',
    blurb: 'Well-balanced sans with fully rounded terminals.',
    axes: [axis('wght', 200, 400, 1000)],
  },
  {
    id: 'anybody', name: 'Anybody', genre: 'Display', italic: true,
    credit: 'Anybody Project Authors (Etcetera Type Co)',
    blurb: 'Retro display grotesk that goes from ultra-condensed to ultra-expanded.',
    axes: [axis('wght', 100, 400, 900), axis('wdth', 50, 100, 150)],
  },
  {
    id: 'recursive', name: 'Recursive', genre: 'Casual', italic: false,
    credit: 'Recursive Project Authors (Arrow Type)',
    blurb: 'Sans with a casual brush axis, monospace axis and cursive alternates.',
    axes: [axis('wght', 300, 400, 1000), axis('CASL', 0, 0, 1), axis('MONO', 0, 0, 1), axis('CRSV', 0, 0.5, 1, 0.5), axis('slnt', -15, 0, 0)],
  },
  {
    id: 'caveat', name: 'Caveat', genre: 'Script', italic: false,
    credit: 'Caveat Project Authors (Impallari Type)',
    blurb: 'Lively handwriting with natural rhythm.',
    axes: [axis('wght', 400, 400, 700)],
  },
];

export const FAMILY_BY_ID = new Map(FAMILIES.map((f) => [f.id, f]));

// Curated looks: one family plus a combination of axes that reads as a
// distinct typeface. They are starting points; every axis stays editable.
export const LOOKS = [
  { name: 'Neo-grotesk', family: 'inter', axes: { wght: 500, opsz: 32 }, tracking: -15 },
  { name: 'Swiss poster', family: 'archivo', axes: { wght: 800, wdth: 62 }, tracking: -10 },
  { name: 'Wide grotesk', family: 'robotoflex', axes: { wght: 600, wdth: 151, opsz: 72, YTLC: 470 }, tracking: 0 },
  { name: 'Compressed', family: 'robotoflex', axes: { wght: 800, wdth: 25, opsz: 144, YTLC: 570, XTRA: 323 }, tracking: 0 },
  { name: 'Geometric', family: 'jost', axes: { wght: 450 }, tracking: 0 },
  { name: 'Humanist', family: 'sourcesans3', axes: { wght: 450 }, tracking: 0 },
  { name: 'Garamond', family: 'ebgaramond', axes: { wght: 400 }, tracking: 0 },
  { name: 'Soft serif', family: 'fraunces', axes: { wght: 600, opsz: 144, SOFT: 100, WONK: 0 }, tracking: -10 },
  { name: 'Wonky', family: 'fraunces', axes: { wght: 800, opsz: 144, SOFT: 50, WONK: 1 }, tracking: -15 },
  { name: 'Editorial', family: 'sourceserif4', axes: { wght: 350, opsz: 60 }, tracking: -5 },
  { name: 'Fashion didone', family: 'bodonimoda', axes: { wght: 500, opsz: 96 }, tracking: -10 },
  { name: 'Display didone', family: 'playfair', axes: { wght: 800, wdth: 87.5, opsz: 1200 }, tracking: -10 },
  { name: 'Slab', family: 'bitter', axes: { wght: 600 }, tracking: 0 },
  { name: 'Rounded', family: 'nunito', axes: { wght: 800 }, tracking: 0 },
  { name: 'Retro display', family: 'anybody', axes: { wght: 900, wdth: 150 }, tracking: -20 },
  { name: 'Casual', family: 'recursive', axes: { wght: 600, CASL: 1, MONO: 0, CRSV: 0.5 }, tracking: 0 },
  { name: 'Mono', family: 'recursive', axes: { wght: 400, CASL: 0, MONO: 1, CRSV: 0 }, tracking: 0 },
  { name: 'Handwritten', family: 'caveat', axes: { wght: 500 }, tracking: 0 },
];

export function defaultAxes(family) {
  return Object.fromEntries(family.axes.map((a) => [a.tag, a.default]));
}

// Clamp a project's axis values to what its family supports.
export function normalizeAxes(family, axes = {}) {
  const out = {};
  for (const a of family.axes) {
    const v = Number(axes[a.tag]);
    out[a.tag] = Number.isFinite(v) ? Math.min(a.max, Math.max(a.min, v)) : a.default;
  }
  return out;
}

// CSS font-variation-settings for the live preview.
export function variationSettings(axes) {
  return Object.entries(axes).map(([t, v]) => `"${t}" ${v}`).join(', ');
}

// Names that may not be used for a derivative font (OFL Reserved Font Names
// plus the original family name, to avoid confusion with the original).
export function forbiddenNames(family) {
  return [family.name, ...(family.rfn || [])];
}

export function nameProblem(family, name) {
  const clean = String(name || '').trim();
  if (!clean) return 'Give your font a name.';
  if (!/^[\p{L}\p{N} \-]{1,40}$/u.test(clean)) return 'Use letters, numbers, spaces or hyphens (max 40).';
  for (const bad of forbiddenNames(family))
    if (clean.toLowerCase().includes(bad.toLowerCase())) return `The license reserves “${bad}”: pick a different name.`;
  return null;
}
