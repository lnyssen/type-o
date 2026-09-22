// Live preview: the browser renders the variable masters directly, so every
// axis change is instant and shows the real outlines, kerning and ligatures.

import { variationSettings } from '../../shared/catalog.js';

const faces = new Map();

export function cssFamily(id) {
  return `GT-${id}`;
}

// Load (once) the light preview copy of a master; resolves when usable.
export function ensureFont(id, italic = false) {
  const key = `${id}:${italic ? 'i' : 'r'}`;
  if (!faces.has(key)) {
    const face = new FontFace(cssFamily(id), `url(/masters/${id}/preview-${italic ? 'italic' : 'roman'}.woff2) format("woff2")`, {
      style: italic ? 'italic' : 'normal',
      weight: '1 1000',
      stretch: '25% 200%',
      display: 'swap',
    });
    document.fonts.add(face);
    faces.set(key, face.load().catch(() => null));
  }
  return faces.get(key);
}

// Style an element so it shows `axes` of family `id`.
export function applyFont(node, { family, axes, italic = false, oblique = 0, tracking = 0 }) {
  ensureFont(family, italic);
  node.style.fontFamily = `"${cssFamily(family)}", system-ui, sans-serif`;
  node.style.fontVariationSettings = variationSettings(axes);
  node.style.fontStyle = italic ? 'italic' : 'normal';
  node.style.fontWeight = 'normal';
  node.style.fontSynthesis = 'none';
  node.style.letterSpacing = `${tracking / 1000}em`;
  node.style.fontKerning = 'normal';
  node.style.transform = oblique ? `skewX(${-oblique}deg)` : '';
  node.style.transformOrigin = '0 80%';
  return node;
}
