// Parameters view: the eight dials on the left, the whole character set
// redrawing live on the right.

import { el, clear, slider, segmented, toggle, numberField } from '../ui.js';
import { state, setParam, on } from '../state.js';
import { PARAM_SPEC } from '../../../shared/engine/params.js';
import { textSvg, glyphGrid } from '../render.js';

const PRESETS = {
  Grotesque: { weight: 45, contrast: 10, terminals: 'sharp', modulation: 0, width: 'normal', tension: 55, serifMode: false },
  Humanist: { weight: 42, contrast: 45, terminals: 'serif', modulation: 12, width: 'normal', tension: 45, serifMode: false },
  'Didone-ish': { weight: 55, contrast: 95, terminals: 'sharp', modulation: 0, width: 'condensed', tension: 70, serifMode: true },
  Rounded: { weight: 62, contrast: 0, terminals: 'rounded', modulation: 0, width: 'normal', tension: 40, serifMode: false },
  Slab: { weight: 58, contrast: 18, terminals: 'sharp', modulation: 0, width: 'normal', tension: 60, serifMode: true },
  Hand: { weight: 40, contrast: 55, terminals: 'rounded', modulation: 65, width: 'normal', tension: 35, serifMode: false },
};

let sampleText = 'Hamburgefonts';

export function parametersView() {
  const panel = el('div', { class: 'panel' });
  const stage = el('div', { class: 'stage' });
  const pad = el('div', { class: 'stage-pad' });
  stage.append(pad);

  const renderPanel = () => {
    clear(panel);
    const p = state.project.params;
    panel.append(el('h2', {}, 'Parameters'));

    for (const [key, spec] of Object.entries(PARAM_SPEC)) {
      if (spec.type === 'range') {
        panel.append(slider({
          label: spec.label, hint: spec.hint, min: spec.min, max: spec.max, value: p[key],
          onInput: (v) => setParam(key, v),
        }));
      } else if (spec.type === 'enum') {
        panel.append(el('div', { class: 'control', title: spec.hint },
          el('div', { class: 'control-head' }, el('label', {}, spec.label)),
          segmented({
            options: spec.options, value: p[key],
            labels: { serif: 'flared' },
            onChange: (v) => { setParam(key, v); renderPanel(); },
          }),
        ));
      } else if (spec.type === 'bool') {
        panel.append(el('div', { class: 'control' }, toggle({
          label: spec.label, hint: spec.hint, checked: p[key],
          onChange: (v) => { setParam(key, v); renderPanel(); },
        })));
      } else if (spec.type === 'int') {
        panel.append(el('div', { class: 'control', title: spec.hint },
          el('div', { class: 'control-head' }, el('label', {}, spec.label)),
          el('div', { class: 'row' },
            numberField({ value: p[key], min: spec.min, max: spec.max, onChange: (v) => setParam(key, v ?? 0) }),
            el('button', { class: 'btn small ghost', onclick: () => { setParam(key, Math.floor(Math.random() * 99999)); renderPanel(); } }, 'Shuffle'),
          ),
        ));
      }
    }

    panel.append(
      el('div', { class: 'group' },
        el('h2', {}, 'Starting points'),
        el('div', { class: 'row', style: { flexWrap: 'wrap', gap: '6px' } },
          ...Object.entries(PRESETS).map(([name, preset]) =>
            el('button', {
              class: 'btn small ghost',
              onclick: () => { for (const [k, v] of Object.entries(preset)) setParam(k, v); renderPanel(); },
            }, name)),
        ),
        el('p', { class: 'hint' }, 'Presets only move the dials — your skeleton edits stay.'),
      ),
    );
  };

  const renderStage = () => {
    clear(pad);
    if (!state.font) { pad.append(el('p', { class: 'hint' }, 'Generating…')); return; }
    const input = el('input', {
      type: 'text', value: sampleText, 'aria-label': 'Sample text',
      oninput: (e) => { sampleText = e.target.value; renderStage(); },
      style: { maxWidth: '420px' },
    });
    const specimen = el('div', { class: 'specimen' }, textSvg(state.font, sampleText || ' ', { fontSize: 96 }));
    pad.append(
      el('div', { class: 'row between', style: { marginBottom: '14px' } },
        el('h2', {}, `${state.font.glyphs.length} glyphs`),
        input,
      ),
      specimen,
      el('h2', { style: { margin: '26px 0 10px' } }, 'Character set'),
      glyphGrid(state.font),
    );
  };

  renderPanel();
  renderStage();
  const offFont = on('font', renderStage);
  const offProject = on('project', (d) => { if (d.reason === 'load') renderPanel(); });

  return {
    node: el('div', { class: 'layout' }, panel, stage),
    dispose: () => { offFont(); offProject(); },
  };
}
