// Contours to an SVG path, and a line of glyphs to a laid-out specimen.

export function pathData(contours) {
  let d = '';
  for (const c of contours) {
    if (c.length < 6) continue;
    d += `M${c[0].toFixed(1)} ${c[1].toFixed(1)}`;
    for (let i = 2; i < c.length; i += 2) d += `L${c[i].toFixed(1)} ${c[i + 1].toFixed(1)}`;
    d += 'Z';
  }
  return d;
}

// Place glyphs along the baseline, applying kerning and tracking.
export function layout(text, glyphs, { kerning = {}, tracking = 0 } = {}) {
  const items = [];
  let x = 0;
  const chars = [...text];
  for (let i = 0; i < chars.length; i++) {
    const glyph = glyphs[chars[i]];
    if (!glyph) { x += 300; continue; }
    items.push({ char: chars[i], x, glyph });
    x += glyph.advance + tracking;
    const pair = kerning[chars[i] + chars[i + 1]];
    if (pair) x += pair;
  }
  return { items, width: x - tracking };
}

export function lineSvg(text, glyphs, opts = {}) {
  const { items, width } = layout(text, glyphs, opts);
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  const body = items
    .map(({ x, glyph }) => {
      for (const c of glyph.contours) {
        for (let i = 0; i < c.length; i += 2) {
          if (c[i] + x < x0) x0 = c[i] + x;
          if (c[i] + x > x1) x1 = c[i] + x;
          if (c[i + 1] < y0) y0 = c[i + 1];
          if (c[i + 1] > y1) y1 = c[i + 1];
        }
      }
      return `<path transform="translate(${x.toFixed(1)} 0)" d="${pathData(glyph.contours)}"/>`;
    })
    .join('');
  const box = x0 === Infinity
    ? { x0: 0, y0: 0, x1: width, y1: 100, w: width, h: 100 }
    : { x0, y0, x1, y1, w: x1 - x0, h: y1 - y0 };
  return { body, width, box };
}
