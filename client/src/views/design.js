// Design view: choose a look or a family, shape it with its axes, and see it
// live — specimen, type tester or every glyph — rendered by the browser from
// the real variable master.

import { el, clear, slider, toggle } from '../ui.js';
import { state, on, family, setFamily, setAxis, setTransform, applyLook } from '../state.js';
import { FAMILIES, FAMILY_BY_ID, GENRES, LOOKS, defaultAxes } from '../../../shared/catalog.js';
import { TRANSFORMS, styleOf } from '../../../shared/project.js';
import { applyFont, ensureFont } from '../fonts.js';

const PARAGRAPH = 'Typography is the craft of endowing human language with a durable visual form. Voix ambiguë d’un cœur qui au zéphyr préfère les jattes de kiwis. Příliš žluťoučký kůň úpěl ďábelské ódy — 0123456789.';
const TESTER_DEFAULT = 'Every typeface tells a story before a single word is read.\n\nLes lettres ont une voix : écoutez-les.';

let sampleText = 'Hamburgefonts';
let tab = 'specimen';
let genreFilter = null;
let testerText = TESTER_DEFAULT;
let testerSize = 64;
const charsets = new Map();
const collapsed = (() => { try { return JSON.parse(localStorage.getItem('gentype.collapsed.v2') || '{}'); } catch { return {}; } })();

const fontOf = (p = state.project) => ({ family: p.family, axes: p.axes, italic: p.italic, oblique: p.oblique, tracking: p.tracking });

function section(id, num, title, content, extra) {
  const open = !collapsed[id];
  return el('section', { class: `section${open ? '' : ' collapsed'}` },
    el('button', {
      type: 'button', class: 'section-head', 'aria-expanded': String(open),
      onclick: () => {
        collapsed[id] = open;
        try { localStorage.setItem('gentype.collapsed.v2', JSON.stringify(collapsed)); } catch { /* ignore */ }
        emitRerender();
      },
    }, el('span', { class: 'section-num' }, num), el('span', { class: 'section-title' }, title), extra || null, el('span', { class: 'chev', 'aria-hidden': 'true' }, '↓')),
    open ? el('div', { class: 'section-body' }, content) : null,
  );
}

let emitRerender = () => {};

export function designView() {
  const panel = el('div', { class: 'panel' });
  const stage = el('div', { class: 'stage' });
  const pad = el('div', { class: 'stage-pad' });
  stage.append(pad);
  const fits = [];

  function renderPanel() {
    const scroll = panel.scrollTop;
    clear(panel);
    const p = state.project;
    const fam = family();

    // 01 Looks
    const looks = el('div', { class: 'look-grid' });
    for (const look of LOOKS) {
      const f = FAMILY_BY_ID.get(look.family);
      const axes = { ...defaultAxes(f), ...look.axes };
      looks.append(el('button', {
        type: 'button', class: 'look', 'aria-pressed': String(p.look === look.name), title: `${look.name} — ${f.name}`,
        onclick: () => applyLook(look),
      },
      applyFont(el('span', { class: 'look-glyphs' }, 'Ag'), { family: f.id, axes, tracking: look.tracking ?? 0 }),
      el('span', { class: 'look-name' }, look.name)));
    }

    // 02 Families
    const chips = el('div', { class: 'chips' },
      el('button', { class: 'chip', 'aria-pressed': String(!genreFilter), onclick: () => { genreFilter = null; renderPanel(); } }, 'All'),
      ...GENRES.filter((g) => FAMILIES.some((f) => f.genre === g)).map((g) =>
        el('button', { class: 'chip', 'aria-pressed': String(genreFilter === g), onclick: () => { genreFilter = g; renderPanel(); } }, g)),
    );
    const list = el('div', { class: 'family-list' });
    for (const f of FAMILIES) {
      if (genreFilter && f.genre !== genreFilter) continue;
      list.append(el('button', {
        type: 'button', class: 'family', 'aria-pressed': String(f.id === p.family), onclick: () => setFamily(f.id),
      },
      applyFont(el('span', { class: 'family-name' }, f.name), { family: f.id, axes: defaultAxes(f) }),
      el('span', { class: 'family-meta' }, `${f.genre} · ${f.axes.length} ${f.axes.length > 1 ? 'axes' : 'axis'}${f.italic ? ' · italic' : ''}`)));
    }

    // 03 Axes
    const axes = el('div', { class: 'group' });
    for (const a of fam.axes) {
      axes.append(slider({
        label: a.label, hint: a.hint, min: a.min, max: a.max, step: a.step, value: p.axes[a.tag],
        format: (v) => (a.step < 1 ? Number(v).toFixed(a.step < 0.1 ? 2 : 1) : String(Math.round(v))),
        onInput: (v) => setAxis(a.tag, v),
      }));
    }
    axes.append(el('p', { class: 'hint' }, fam.blurb));

    // 04 Style
    const style = el('div', { class: 'group' },
      fam.italic ? toggle({ label: 'Italic (true cursive design)', checked: p.italic, onChange: (v) => { setTransform('italic', v); renderPanel(); } }) : null,
      p.italic ? null : slider({ ...TRANSFORMS.oblique, value: p.oblique, format: (v) => `${v}°`, onInput: (v) => setTransform('oblique', v) }),
      slider({ ...TRANSFORMS.tracking, value: p.tracking, onInput: (v) => setTransform('tracking', v) }),
    );

    panel.append(
      section('looks', '01', 'Looks', looks),
      section('family', '02', 'Family', [chips, list], el('span', { class: 'section-aside' }, fam.name)),
      section('axes', '03', 'Shape', axes),
      section('style', '04', 'Style', style),
    );
    panel.scrollTop = scroll;
  }

  // Scale a one-line element so it fills the available width.
  function fit(node, max = 300, min = 24) {
    const run = () => {
      node.style.fontSize = '100px';
      const w = node.scrollWidth || 1;
      const avail = pad.clientWidth - 8;
      node.style.fontSize = `${Math.max(min, Math.min(max, (100 * avail) / w))}px`;
    };
    fits.push(run);
    run();
    return node;
  }

  function renderStage() {
    fits.length = 0;
    clear(pad);
    const p = state.project;
    const fam = family();
    const { styleName, weightClass } = styleOf(p);
    const f = fontOf();

    pad.append(el('div', { class: 'stage-head' },
      el('div', { class: 'meta' },
        el('span', { class: 'meta-name' }, p.name || 'Untitled'),
        el('span', {}, `${styleName} · ${weightClass}`),
        el('span', {}, `from ${fam.name}`),
        p.look ? el('span', { class: 'meta-look' }, p.look) : null,
      ),
      el('div', { class: 'tabs', role: 'tablist' },
        ...[['specimen', 'Specimen'], ['tester', 'Type tester'], ['glyphs', 'Glyphs']].map(([id, label]) =>
          el('button', { class: 'tab', role: 'tab', 'aria-selected': String(tab === id), onclick: () => { tab = id; renderStage(); } }, label)),
      ),
    ));

    if (tab === 'tester') {
      const area = applyFont(el('div', { class: 'tester', contenteditable: 'plaintext-only', spellcheck: 'false' }, testerText), f);
      area.style.fontSize = `${testerSize}px`;
      area.addEventListener('input', () => { testerText = area.innerText; });
      pad.append(
        el('div', { class: 'tester-bar' }, slider({ label: 'Size', min: 12, max: 200, value: testerSize, format: (v) => `${v}px`, onInput: (v) => { testerSize = v; area.style.fontSize = `${v}px`; } })),
        area,
      );
      return;
    }

    if (tab === 'glyphs') {
      const grid = el('div', { class: 'char-grid' });
      pad.append(grid);
      const fill = (cps) => {
        clear(grid);
        for (const cp of cps) {
          if (cp < 0x21 || (cp >= 0x7f && cp < 0xa1)) continue;
          const ch = String.fromCodePoint(cp);
          grid.append(el('div', { class: 'char-cell', title: `U+${cp.toString(16).toUpperCase().padStart(4, '0')}` },
            applyFont(el('span', {}, ch), { ...f, tracking: 0 }),
            el('span', { class: 'tag' }, cp.toString(16).toUpperCase().padStart(4, '0'))));
        }
      };
      if (charsets.has(p.family)) fill(charsets.get(p.family));
      else {
        grid.append(el('p', { class: 'hint' }, 'Loading…'));
        fetch(`/api/families/${p.family}/charset`).then((r) => r.json()).then((d) => {
          // the browser previews a Latin subset: show what it can draw
          const shown = d.codepoints.filter((cp) => cp < 0x180 || (cp >= 0x2010 && cp <= 0x2122) || cp === 0xfb01 || cp === 0xfb02);
          charsets.set(p.family, shown);
          if (state.project.family === p.family && tab === 'glyphs') fill(shown);
        }).catch(() => { clear(grid).append(el('p', { class: 'hint' }, 'Could not load the character set.')); });
      }
      return;
    }

    const input = el('input', {
      type: 'text', class: 'sample-input', value: sampleText, spellcheck: false, 'aria-label': 'Headline text', placeholder: 'Type a headline…',
      oninput: (e) => { sampleText = e.target.value; hero.textContent = sampleText || 'Hamburgefonts'; fits.forEach((fn) => fn()); },
    });
    const hero = fit(applyFont(el('div', { class: 'hero-line' }, sampleText || 'Hamburgefonts'), f), 320, 40);

    const weights = [];
    const wAxis = fam.axes.find((a) => a.tag === 'wght');
    if (wAxis) for (let w = Math.ceil(wAxis.min / 100) * 100; w <= wAxis.max; w += 100) weights.push(w);

    pad.append(
      input,
      el('div', { class: 'hero' }, hero),
      el('div', { class: 'specimen-row' },
        el('div', { class: 'label' }, 'Alphabet'),
        el('div', { class: 'stack' },
          fit(applyFont(el('div', { class: 'line' }, 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'), f), 72),
          fit(applyFont(el('div', { class: 'line' }, 'abcdefghijklmnopqrstuvwxyz'), f), 72),
          fit(applyFont(el('div', { class: 'line' }, '0123456789 &@?!€$%*()'), f), 72),
        ),
      ),
      el('div', { class: 'specimen-row' },
        el('div', { class: 'label' }, 'Text'),
        applyFont(el('p', { class: 'paragraph' }, PARAGRAPH), f),
      ),
      el('div', { class: 'specimen-row' },
        el('div', { class: 'label' }, 'Sizes'),
        el('div', { class: 'stack' }, ...[12, 16, 24, 36].map((s) => el('div', { class: 'wf' },
          el('span', { class: 'label' }, `${s}`),
          applyFont(el('span', { style: { fontSize: `${s}px` } }, 'The quick brown fox jumps over the lazy dog'), f),
        ))),
      ),
      weights.length > 1 ? el('div', { class: 'specimen-row' },
        el('div', { class: 'label' }, 'Weights'),
        el('div', { class: 'stack' }, ...weights.map((w) => el('div', { class: 'wf' },
          el('span', { class: 'label' }, `${w}`),
          applyFont(el('span', { style: { fontSize: '30px' }, 'data-w': String(w) }, `${fam.name} ${w} — Rafale`), { ...f, axes: { ...p.axes, wght: w } }),
        ))),
      ) : null,
    );
    ensureFont(p.family, p.italic).then(() => fits.forEach((fn) => fn()));
  }

  // Axis moves only restyle what is on screen (no rebuild): instant.
  function restyle() {
    const f = fontOf();
    for (const node of pad.querySelectorAll('.hero-line, .line, .paragraph, .wf span:not(.label), .tester, .char-cell span:not(.tag)')) {
      if (node.dataset.w) applyFont(node, { ...f, axes: { ...f.axes, wght: Number(node.dataset.w) } });
      else applyFont(node, node.parentElement?.classList.contains('char-cell') ? { ...f, tracking: 0 } : f);
    }
    for (const b of panel.querySelectorAll('.look[aria-pressed="true"]')) b.setAttribute('aria-pressed', 'false');
    fits.forEach((fn) => fn());
  }

  emitRerender = renderPanel;
  renderPanel();
  renderStage();
  let resizeTimer = null;
  const ro = new ResizeObserver(() => { clearTimeout(resizeTimer); resizeTimer = setTimeout(() => fits.forEach((fn) => fn()), 60); });
  ro.observe(pad);
  const off = on('project', ({ reason }) => {
    if (reason === 'axes' || reason === 'tracking' || reason === 'oblique') { restyle(); if (reason === 'axes') renderStageMeta(); return; }
    renderPanel();
    renderStage();
  });
  function renderStageMeta() {
    const meta = pad.querySelector('.meta');
    if (!meta) return;
    const { styleName, weightClass } = styleOf(state.project);
    meta.children[1].textContent = `${styleName} · ${weightClass}`;
  }

  return { node: el('div', { class: 'layout' }, panel, stage), dispose: () => { off(); ro.disconnect(); } };
}
