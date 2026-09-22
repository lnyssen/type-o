// Starting points that differ in structure and proportions, not just in
// stroke: each one sets the construction, the metrics and the dials.
export const PRESETS = {
  Swiss: {
    params: { construction: 'grotesque', weight: 52, contrast: 12, terminals: 'sharp', aperture: 22, width: 'normal', tension: 58, modulation: 0, slant: 0, serifMode: false },
    metrics: { xHeight: 530, capHeight: 720, ascender: 760, descender: -210, spacing: 88 },
  },
  Geometric: {
    params: { construction: 'geometric', weight: 44, contrast: 0, terminals: 'sharp', aperture: 60, width: 'normal', tension: 40, modulation: 0, slant: 0, serifMode: false },
    metrics: { xHeight: 440, capHeight: 700, ascender: 800, descender: -250, spacing: 104 },
  },
  Humanist: {
    params: { construction: 'humanist', weight: 46, contrast: 32, terminals: 'sharp', aperture: 85, width: 'normal', tension: 46, modulation: 0, slant: 0, serifMode: false },
    metrics: { xHeight: 510, capHeight: 700, ascender: 760, descender: -230, spacing: 104 },
  },
  'Old style': {
    params: { construction: 'humanist', weight: 36, contrast: 72, terminals: 'serif', aperture: 75, width: 'normal', tension: 40, modulation: 6, slant: 0, serifMode: true },
    metrics: { xHeight: 420, capHeight: 660, ascender: 780, descender: -270, spacing: 96 },
  },
  Didone: {
    params: { construction: 'geometric', weight: 56, contrast: 96, terminals: 'sharp', aperture: 18, width: 'condensed', tension: 72, modulation: 0, slant: 0, serifMode: true },
    metrics: { xHeight: 460, capHeight: 700, ascender: 760, descender: -230, spacing: 92 },
  },
  Slab: {
    params: { construction: 'geometric', weight: 62, contrast: 8, terminals: 'sharp', aperture: 45, width: 'normal', tension: 60, modulation: 0, slant: 0, serifMode: true },
    metrics: { xHeight: 490, capHeight: 700, ascender: 760, descender: -220, spacing: 100 },
  },
  Rounded: {
    params: { construction: 'grotesque', weight: 72, contrast: 0, terminals: 'rounded', aperture: 25, width: 'expanded', tension: 50, modulation: 0, slant: 0, serifMode: false },
    metrics: { xHeight: 550, capHeight: 720, ascender: 760, descender: -200, spacing: 98 },
  },
  Italic: {
    params: { construction: 'humanist', weight: 42, contrast: 48, terminals: 'serif', aperture: 90, width: 'condensed', tension: 42, modulation: 18, slant: 11, serifMode: false },
    metrics: { xHeight: 470, capHeight: 680, ascender: 780, descender: -250, spacing: 94 },
  },
  Hand: {
    params: { construction: 'humanist', weight: 40, contrast: 55, terminals: 'rounded', aperture: 70, width: 'normal', tension: 35, modulation: 65, slant: 4, serifMode: false },
    metrics: { xHeight: 480, capHeight: 690, ascender: 770, descender: -240, spacing: 100 },
  },
};
