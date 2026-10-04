// Turn the outlines on screen into the job the font builder packs. Both the
// browser and the tests go through here, so an export is always the geometry
// that was actually displayed.

import { runGlyph } from './chain.js';
import { clean } from './clip.js';
import { simplify } from './simplify.js';

// Per-mille of the em. At 0.35 the dropped vertices are a third of a unit off
// a 1000-unit em — invisible at any size, and it removes most of the points.
const EXPORT_TOLERANCE = 0.35;

export function buildJob(data, chain, options = {}) {
  const {
    seed = 1, tracking = 0, familyName = 'Untitled', styleName = 'Regular',
    format = 'ttf', version = '1.000', weightClass = 400, widthClass = 5,
    italic = false, note = '', copyright = '', license = '', only = null,
  } = options;

  const unit = (data.upm || 1000) / 1000;
  const glyphs = {};
  for (const [ch, glyph] of Object.entries(data.glyphs)) {
    if (only && !only.includes(ch)) continue;
    const out = runGlyph(glyph, chain, { seed, char: ch, metrics: data.metrics, upm: data.upm, tidy: false });
    const contours = simplify(clean(out.contours, 0.2 * unit, 6 * unit * unit), EXPORT_TOLERANCE * unit)
      .map((c) => c.map((v) => Math.round(v)));
    glyphs[ch] = { advance: Math.max(0, Math.round(out.advance + tracking * unit)), contours };
  }

  return {
    format, familyName, styleName, version, weightClass, widthClass, italic,
    upm: data.upm, metrics: data.metrics, glyphs, kerning: data.kerning || {},
    note, copyright, license,
  };
}

export function countPoints(job) {
  let points = 0, contours = 0;
  for (const g of Object.values(job.glyphs)) {
    contours += g.contours.length;
    for (const c of g.contours) points += c.length / 2;
  }
  return { glyphs: Object.keys(job.glyphs).length, contours, points };
}
