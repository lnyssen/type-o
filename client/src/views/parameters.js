// Design view: numbered control sections on the left, the typeface itself as
// the hero on the right (specimen or full glyph set).

import { el, clear, slider, segmented, toggle, numberField, glyphPath } from '../ui.js';
import { state, setParam, setMetric, setMode, setGlyph, on } from '../state.js';
import { PARAM_SPEC, derive, normalizeParams, normalizeMetrics, styleFor } from '../../../shared/engine/params.js';
import { PRESETS } from '../../../shared/engine/presets.js';
import { buildGlyph } from '../../../shared/engine/glyph.js';
import { skeletonFor, editableGlyphs } from '../../../shared/engine/font.js';
import { textSvg, textBlock, fitSize, glyphGrid } from '../render.js';

const SECTIONS = [
  { id: 'style', title: 'Style' },
  { id: 'structure', title: 'Structure', keys: ['construction', 'width', 'aperture', 'slant'] },
  { id: 'stroke', title: 'Stroke', keys: ['weight', 'contrast', 'terminals', 'tension'] },
  { id: 'details', title: 'Details', keys: ['serifMode', 'modulation', 'seed'] },
];

const ENUM_LABELS = { serif: 'Flared', grotesque: 'Grotesk' };
const PARAGRAPH = 'Typography is the craft of endowing human language with a durable visual form. Voix ambiguë d’un cœur qui au zéphyr préfère les jattes de kiwis — 1234567890.';

let sampleText = 'Hamburgefonts';
let tab = 'specimen';
const collapsed = (() => { try { return JSON.parse(localStorage.getItem('gentype.collapsed') || '{}'); } catch { return {}; } })();

// ---- preset thumbnails: two glyphs drawn with the preset's own settings ----

const thumbCache = new Map();
function presetThumb(name, preset) {
  if (!thumbCache.has(name)) {
    const D = derive(preset.params, preset.metrics);
    const parts = [['A', 'upper'], ['g', 'lower']].map(([id, kind]) => buildGlyph(id, skeletonFor(id, {}, D.construction), kind, D, { quality: 'preview' }));
    let x = 0, body = '';
    for (const g of parts) {
      let xMin = Infinity, xMax = -Infinity;
      for (const c of g.contours) for (const p of c) { xMin = Math.min(xMin, p.x); xMax = Math.max(xMax, p.x); }
      body += `<path transform="translate(${x - xMin} 0)" d="${glyphPath(g.contours)}"/>`;
      x += xMax - xMin + 50;
    }
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', `-20 ${-D.m.ascender - 30} ${x + 20} ${D.m.ascender - D.m.descender + 60}`);
    svg.innerHTML = `<g transform="scale(1,-1)" fill="currentColor">${body}</g>`;
    thumbCache.set(name, svg);
  }
  return thumbCache.get(name).cloneNode(true);
}

function activePreset() {
  const p = normalizeParams(state.project.params);
  const m = normalizeMetrics(state.project.metrics);
  for (const [name, preset] of Object.entries(PRESETS)) {
    const matchP = Object.entries(preset.params).every(([k, v]) => p[k] === v);
    const matchM = Object.entries(preset.metrics).every(([k, v]) => m[k] === v);
    if (matchP && matchM) return name;
  }
  return null;
}

export function parametersView() {
  const panel = el('div', { class: 'panel' });
  const stage = el('div', { class: 'stage' });
  const pad = el('div', { class: 'stage-pad' });
  stage.append(pad);

  let presetGrid = null;
  const markPreset = () => {
    if (!presetGrid) return;
    const active = activePreset();
    for (const card of presetGrid.children) card.setAttribute('aria-pressed', String(card.dataset.name === active));
  };

  function control(key) {
    const spec = PARAM_SPEC[key];
    const p = state.project.params;
    if (spec.type === 'range') {
      return slider({
        label: spec.label, hint: spec.hint, min: spec.min, max: spec.max, value: p[key],
        format: key === 'slant' ? (v) => `${v}°` : undefined,
        onInput: (v) => { setParam(key, v); markPreset(); },
      });
    }
    if (spec.type === 'enum') {
      return el('div', { class: 'control', title: spec.hint },
        el('div', { class: 'control-head' }, el('label', {}, spec.label)),
        segmented({ options: spec.options, value: p[key], labels: ENUM_LABELS, onChange: (v) => { setParam(key, v); renderPanel(); } }),
      );
    }
    if (spec.type === 'bool') {
      return el('div', { class: 'control' }, toggle({ label: spec.label, hint: spec.hint, checked: p[key], onChange: (v) => { setParam(key, v); renderPanel(); } }));
    }
    return el('div', { class: 'control', title: spec.hint },
      el('div', { class: 'control-head' }, el('label', {}, spec.label)),
      el('div', { class: 'row' },
        numberField({ value: p[key], min: spec.min, max: spec.max, onChange: (v) => { setParam(key, v ?? 0); markPreset(); } }),
        el('button', { class: 'btn small ghost', onclick: () => { setParam(key, Math.floor(Math.random() * 99999)); renderPanel(); } }, 'Shuffle'),
      ),
    );
  }

  function renderPanel() {
    const scroll = panel.scrollTop;
    clear(panel);
    SECTIONS.forEach((section, i) => {
      const open = !collapsed[section.id];
      const body = el('div', { class: 'section-body' });
      if (section.id === 'style') {
        presetGrid = el('div', { class: 'preset-grid' });
        for (const [name, preset] of Object.entries(PRESETS)) {
          presetGrid.append(el('button', {
            type: 'button', class: 'preset', 'data-name': name, title: `Apply ${name}`,
            onclick: () => {
              for (const [k, v] of Object.entries(preset.params)) setParam(k, v);
              for (const [k, v] of Object.entries(preset.metrics)) setMetric(k, v);
              renderPanel();
            },
          }, presetThumb(name, preset), el('span', {}, name)));
        }
        body.append(presetGrid);
      } else {
        for (const key of section.keys) body.append(control(key));
      }
      panel.append(el('section', { class: `section${open ? '' : ' collapsed'}` },
        el('button', {
          type: 'button', class: 'section-head', 'aria-expanded': String(open),
          onclick: () => {
            collapsed[section.id] = open;
            try { localStorage.setItem('gentype.collapsed', JSON.stringify(collapsed)); } catch { /* ignore */ }
            renderPanel();
          },
        }, el('span', { class: 'section-num' }, String(i + 1).padStart(2, '0')), el('span', { class: 'section-title' }, section.title), el('span', { class: 'chev', 'aria-hidden': 'true' }, '↓')),
        open ? body : null,
      ));
    });
    markPreset();
    panel.scrollTop = scroll;
  }

  function renderStage() {
    clear(pad);
    const font = state.font;
    if (!font) { pad.append(el('p', { class: 'hint' }, 'Generating…')); return; }
    const width = Math.max(300, stage.clientWidth - 72);
    const { styleName, weightClass } = styleFor(state.project.params);

    pad.append(el('div', { class: 'stage-head' },
      el('div', { class: 'meta' },
        el('span', { class: 'meta-name' }, state.project.name || 'Untitled'),
        el('span', {}, `${styleName} · ${weightClass}`),
        el('span', {}, activePreset() || 'Custom'),
      ),
      el('div', { class: 'tabs', role: 'tablist' },
        ...[['specimen', 'Specimen'], ['glyphs', `Glyphs ${font.glyphs.length}`]].map(([id, label]) =>
          el('button', { class: 'tab', role: 'tab', 'aria-selected': String(tab === id), onclick: () => { tab = id; renderStage(); } }, label)),
      ),
    ));

    if (tab === 'glyphs') {
      const groups = new Map();
      for (const g of font.glyphs) {
        if (!groups.has(g.group)) groups.set(g.group, new Set());
        groups.get(g.group).add(g.name);
      }
      const editable = new Set(editableGlyphs().map((g) => g.id));
      for (const [group, names] of groups) {
        pad.append(
          el('h2', { class: 'group-title' }, group, el('span', {}, String(names.size))),
          glyphGrid(font, {
            filter: (g) => names.has(g.name),
            onPick: (g) => {
              const id = editable.has(g.name) ? g.name : g.base && editable.has(g.base) ? g.base : null;
              if (!id) return;
              setGlyph(id);
              setMode('skeleton');
            },
          }),
        );
      }
      return;
    }

    const hero = el('div', { class: 'hero' });
    const drawHero = () => {
      clear(hero);
      const text = sampleText || 'Hamburgefonts';
      hero.append(textSvg(font, text, { fontSize: fitSize(font, text, width, 280, 48) }));
    };
    const input = el('input', {
      type: 'text', class: 'sample-input', value: sampleText, spellcheck: false, 'aria-label': 'Sample text',
      placeholder: 'Type something…',
      oninput: (e) => { sampleText = e.target.value; drawHero(); },
    });
    drawHero();

    const inner = width - 150;
    const caps = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const lower = 'abcdefghijklmnopqrstuvwxyz';
    const figures = '0123456789 &@?!€$%';
    pad.append(
      input,
      hero,
      el('div', { class: 'specimen-row' },
        el('div', { class: 'label' }, 'Alphabet'),
        el('div', { class: 'stack' },
          textSvg(font, caps, { fontSize: fitSize(font, caps, inner, 58) }),
          textSvg(font, lower, { fontSize: fitSize(font, lower, inner, 58) }),
          textSvg(font, figures, { fontSize: fitSize(font, figures, inner, 58) }),
        ),
      ),
      el('div', { class: 'specimen-row' },
        el('div', { class: 'label' }, 'Text'),
        el('div', {}, textBlock(font, PARAGRAPH, { fontSize: Math.max(18, Math.min(32, inner / 28)), width: inner })),
      ),
      el('div', { class: 'specimen-row' },
        el('div', { class: 'label' }, 'Sizes'),
        el('div', { class: 'stack' }, ...[12, 16, 22, 30].map((s) => el('div', { class: 'wf' },
          el('span', { class: 'label' }, `${s}px`),
          textSvg(font, 'The quick brown fox jumps over the lazy dog', { fontSize: s }),
        ))),
      ),
    );
  }

  renderPanel();
  renderStage();
  let resizeTimer = null;
  const ro = new ResizeObserver(() => { clearTimeout(resizeTimer); resizeTimer = setTimeout(renderStage, 120); });
  ro.observe(stage);
  const offFont = on('font', renderStage);
  const offProject = on('project', (d) => {
    if (d.reason === 'load') renderPanel();
    if (d.reason === 'name') renderStage();
  });

  return {
    node: el('div', { class: 'layout' }, panel, stage),
    dispose: () => { offFont(); offProject(); ro.disconnect(); },
  };
}
