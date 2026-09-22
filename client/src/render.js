// Typesetting the generated glyphs directly as SVG: the preview uses the same
// advances, kerning and ligatures the exported font will carry.

import { el, glyphSvg } from './ui.js';
import { LIGATURES } from '../../shared/engine/font.js';

const LIG_BY_TEXT = LIGATURES.map(([name, parts]) => [parts.join(''), name]);

export function layout(font, text, { kerning = true, ligatures = true } = {}) {
  const byChar = new Map(font.glyphs.filter((g) => g.char).map((g) => [g.char, g]));
  const byName = font.byName;
  const run = [];
  let i = 0;
  while (i < text.length) {
    if (ligatures) {
      const hit = LIG_BY_TEXT.find(([seq]) => text.startsWith(seq, i));
      if (hit && byName.has(hit[1])) { run.push(byName.get(hit[1])); i += hit[0].length; continue; }
    }
    const ch = text[i];
    if (ch === '\n') { run.push({ newline: true }); i++; continue; }
    const g = byChar.get(ch) || (ch === ' ' ? byChar.get(' ') : null);
    if (g) run.push(g);
    i++;
  }

  const lines = [[]];
  let x = 0, width = 0;
  for (let k = 0; k < run.length; k++) {
    const g = run[k];
    if (g.newline) { width = Math.max(width, x); x = 0; lines.push([]); continue; }
    const prev = lines[lines.length - 1].at(-1);
    if (kerning && prev) {
      const kern = font.kerning[`${prev.glyph.kernGroup}|${g.kernGroup}`] || 0;
      x += kern;
    }
    lines[lines.length - 1].push({ glyph: g, x });
    x += g.advance;
  }
  width = Math.max(width, x);
  return { lines, width };
}

export function textSvg(font, text, { fontSize = 64, kerning = true, ligatures = true, color = 'currentColor', lineHeight = 1.32 } = {}) {
  const { lines, width } = layout(font, text, { kerning, ligatures });
  const z = font.zones;
  const em = 1000;
  const lh = em * lineHeight;
  const height = lines.length * lh;
  const scale = fontSize / em;
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', `0 ${-z.ascender - 40} ${Math.max(width, 10)} ${height + 40}`);
  svg.setAttribute('width', String(Math.max(width, 10) * scale));
  svg.setAttribute('height', String((height + 40) * scale));
  let body = '';
  lines.forEach((line, li) => {
    for (const { glyph, x } of line) {
      if (!glyph.path) continue;
      body += `<path transform="translate(${x} ${li * lh}) scale(1,-1)" d="${glyph.path}" fill="${color}" fill-rule="nonzero"/>`;
    }
  });
  svg.innerHTML = body;
  return svg;
}

export function glyphGrid(font, { onPick, filter = () => true, cells = null } = {}) {
  const grid = el('div', { class: 'glyph-grid' });
  for (const g of font.glyphs) {
    if (!filter(g)) continue;
    const cell = el('div', { class: 'glyph-cell', title: `${g.name}${g.char ? ` — ${g.char}` : ''} · ${g.advance}u` },
      glyphSvg(g, font.zones),
      el('span', { class: 'tag' }, g.char || g.name),
    );
    if (onPick) {
      cell.style.cursor = 'pointer';
      cell.addEventListener('click', () => onPick(g));
    }
    grid.append(cell);
    if (cells && grid.children.length >= cells) break;
  }
  return grid;
}

// A paragraph wrapped to a width in pixels, set at fontSize.
export function textBlock(font, text, { fontSize = 32, width = 800, lineHeight = 1.3, kerning = true, ligatures = true } = {}) {
  const maxUnits = (width / fontSize) * 1000;
  const lines = [];
  for (const para of text.split('\n')) {
    let line = '';
    for (const word of para.split(/\s+/)) {
      const next = line ? `${line} ${word}` : word;
      if (line && layout(font, next, { kerning, ligatures }).width > maxUnits) { lines.push(line); line = word; }
      else line = next;
    }
    lines.push(line);
  }
  return textSvg(font, lines.join('\n'), { fontSize, kerning, ligatures, lineHeight });
}

// Font size (px) that makes `text` fill `width` pixels, capped.
export function fitSize(font, text, width, max = 240, min = 24) {
  const units = layout(font, text || ' ').width || 1000;
  return Math.max(min, Math.min(max, (width / units) * 1000));
}
