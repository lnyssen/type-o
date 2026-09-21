// Tiny DOM helpers — enough structure to keep the views readable without a
// framework.

export function el(tag, props = {}, ...children) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(props || {})) {
    if (v === null || v === undefined || v === false) continue;
    if (k === 'class') node.className = v;
    else if (k === 'style' && typeof v === 'object') Object.assign(node.style, v);
    else if (k === 'html') node.innerHTML = v;
    else if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k in node && k !== 'list' && typeof v !== 'boolean') node[k] = v;
    else node.setAttribute(k, v === true ? '' : v);
  }
  for (const c of children.flat(Infinity)) {
    if (c === null || c === undefined || c === false) continue;
    node.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return node;
}

export const clear = (node) => { while (node.firstChild) node.removeChild(node.firstChild); return node; };

export function toast(message, kind = '') {
  const box = document.getElementById('toasts');
  const item = el('div', { class: `toast ${kind}` }, message);
  box.append(item);
  setTimeout(() => {
    item.style.transition = 'opacity .3s, transform .3s';
    item.style.opacity = '0';
    item.style.transform = 'translateY(6px)';
    setTimeout(() => item.remove(), 320);
  }, kind === 'error' ? 6000 : 3200);
  return item;
}

// Labelled slider bound to a setter.
export function slider({ label, hint, min, max, step = 1, value, format = (v) => v, onInput }) {
  const out = el('span', { class: 'control-value' }, format(value));
  const input = el('input', {
    type: 'range', min, max, step, value,
    oninput: (e) => {
      const v = Number(e.target.value);
      out.textContent = format(v);
      onInput(v);
    },
  });
  return el('div', { class: 'control', title: hint || '' },
    el('div', { class: 'control-head' }, el('label', {}, label), out),
    input,
  );
}

export function segmented({ options, value, onChange, labels = {} }) {
  const wrap = el('div', { class: 'seg' });
  for (const opt of options) {
    wrap.append(el('button', {
      type: 'button',
      'aria-pressed': String(opt === value),
      onclick: () => onChange(opt),
    }, labels[opt] ?? opt));
  }
  return wrap;
}

export function toggle({ label, checked, onChange, hint }) {
  return el('label', { class: 'switch', title: hint || '' },
    el('input', { type: 'checkbox', checked, onchange: (e) => onChange(e.target.checked) }),
    el('span', {}, label),
  );
}

export function numberField({ value, onChange, step = 1, min, max, title }) {
  return el('input', {
    type: 'number', value, step, min, max, title,
    onchange: (e) => onChange(e.target.value === '' ? null : Number(e.target.value)),
  });
}

// SVG path data for one locally generated glyph (font units, y up).
export function glyphPath(contours) {
  const r = (v) => Math.round(v * 10) / 10;
  return contours.map((c) => `M${c.map((p) => `${r(p.x)} ${r(p.y)}`).join('L')}Z`).join('');
}

export function glyphSvg(glyph, zones, { box = false, color = 'currentColor' } = {}) {
  const top = zones.ascender + 60;
  const bottom = zones.descender - 60;
  const width = Math.max(glyph.advance, 10);
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', `0 ${-top} ${width} ${top - bottom}`);
  svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
  svg.innerHTML =
    (box ? `<rect x="0" y="${-top}" width="${width}" height="${top - bottom}" fill="none" stroke="rgba(244,242,237,.10)" stroke-width="4"/>` : '') +
    `<path transform="scale(1,-1)" d="${glyph.path ?? glyphPath(glyph.contours)}" fill="${color}" fill-rule="nonzero"/>`;
  return svg;
}
