// Metrics view: vertical zones, optical spacing and kerning. Auto values are
// always computed; anything you type becomes an override stored in the project.

import { el, clear, slider, toggle, numberField } from '../ui.js';
import { state, on, setMetric, setKern, setAdvance } from '../state.js';
import { METRIC_SPEC } from '../../../shared/engine/params.js';
import { textSvg } from '../render.js';

export function metricsView() {
  const panel = el('div', { class: 'panel' });
  const stage = el('div', { class: 'stage' });
  const pad = el('div', { class: 'stage-pad' });
  stage.append(pad);

  let tab = 'kerning';
  let filter = '';

  function renderPanel() {
    clear(panel);
    const m = state.project.metrics;
    panel.append(el('h2', {}, 'Vertical metrics'));
    for (const [key, spec] of Object.entries(METRIC_SPEC)) {
      panel.append(slider({
        label: spec.label, min: spec.min, max: spec.max, value: m[key],
        format: (v) => (key === 'spacing' ? `${v}%` : `${v}u`),
        onInput: (v) => setMetric(key, v),
      }));
    }
    panel.append(
      el('div', { class: 'group' },
        el('h2', {}, 'Auto-metrics'),
        toggle({
          label: 'Automatic kerning',
          checked: m.auto !== false,
          hint: 'Off: only the pairs you set yourself are written to the font',
          onChange: (v) => { setMetric('auto', v); renderPanel(); },
        }),
        el('p', { class: 'hint' }, 'Sidebearings are always optical; kerning pairs below can be overridden one by one.'),
        el('div', { class: 'row' },
          el('button', {
            class: 'btn small ghost',
            onclick: () => { state.project.metrics.kerning = {}; setMetric('auto', m.auto !== false); renderStage(); },
          }, 'Clear kern overrides'),
          el('button', {
            class: 'btn small ghost',
            onclick: () => { state.project.metrics.advanceWidths = {}; setMetric('auto', m.auto !== false); renderStage(); },
          }, 'Clear widths'),
        ),
      ),
      el('div', { class: 'group' },
        el('h2', {}, 'Stem'),
        el('p', { class: 'hint' }, state.font ? `${state.font.zones.stem}u at the current weight` : '—'),
      ),
    );
  }

  function kerningRows() {
    const font = state.font;
    const rows = [];
    const manual = state.project.metrics.kerning;
    const seen = new Set();
    const label = (pair) => {
      const [a, b] = pair.split('|');
      const ga = font.byName.get(a), gb = font.byName.get(b);
      return ga?.char && gb?.char ? ga.char + gb.char : null;
    };
    for (const [pair, value] of Object.entries(font.autoKerning)) {
      const chars = label(pair);
      if (!chars) continue;
      seen.add(chars);
      rows.push({ chars, auto: value, override: manual[chars] ?? null });
    }
    for (const [chars, value] of Object.entries(manual)) {
      if (seen.has(chars)) continue;
      rows.push({ chars, auto: null, override: value });
    }
    rows.sort((a, b) => a.chars.localeCompare(b.chars));
    return rows.filter((r) => !filter || r.chars.includes(filter));
  }

  function renderStage() {
    clear(pad);
    const font = state.font;
    if (!font) { pad.append(el('p', { class: 'hint' }, 'Generating…')); return; }

    const tabs = el('nav', { class: 'pills', style: { margin: '0 0 16px' } },
      ...[['kerning', 'Kerning pairs'], ['widths', 'Advance widths']].map(([id, label]) =>
        el('button', { class: 'pill', 'aria-selected': String(tab === id), onclick: () => { tab = id; renderStage(); } }, label)),
    );

    const search = el('input', {
      type: 'text', placeholder: tab === 'kerning' ? 'Filter pairs, e.g. "To"' : 'Filter characters', value: filter,
      style: { maxWidth: '260px' },
      oninput: (e) => { filter = e.target.value; renderTable(); },
    });

    const tableHost = el('div', { class: 'scroll', style: { maxHeight: 'calc(100vh - 260px)' } });
    pad.append(el('div', { class: 'row between' }, tabs, search), tableHost);

    function renderTable() {
      clear(tableHost);
      if (tab === 'kerning') {
        const rows = kerningRows();
        const table = el('table', { class: 'metrics-table' },
          el('thead', {}, el('tr', {},
            el('th', {}, 'Pair'), el('th', {}, 'Preview'), el('th', {}, 'Auto'), el('th', {}, 'Override'), el('th', {}, ''),
          )),
        );
        const body = el('tbody');
        for (const row of rows.slice(0, 600)) {
          const preview = el('td', {});
          preview.append(textSvg(font, row.chars, { fontSize: 34 }));
          body.append(el('tr', {},
            el('td', { class: 'pair' }, row.chars),
            preview,
            el('td', { class: 'auto' }, row.auto === null ? '—' : `${row.auto}`),
            el('td', {}, numberField({
              value: row.override ?? '', step: 5,
              title: 'Units of 1000 em', onChange: (v) => setKern(row.chars, v),
            })),
            el('td', {}, row.override !== null
              ? el('button', { class: 'btn small ghost', onclick: () => { setKern(row.chars, null); renderTable(); } }, 'Reset')
              : null),
          ));
        }
        table.append(body);
        tableHost.append(
          el('p', { class: 'hint', style: { margin: '0 0 8px' } }, `${rows.length} pairs · values apply to the whole accent family (A also covers Á Â Ä…)`),
          table,
        );
      } else {
        const manual = state.project.metrics.advanceWidths;
        const glyphs = font.glyphs.filter((g) => g.char && (!filter || g.char.includes(filter) || g.name.includes(filter)));
        const table = el('table', { class: 'metrics-table' },
          el('thead', {}, el('tr', {}, el('th', {}, 'Glyph'), el('th', {}, 'Name'), el('th', {}, 'Auto'), el('th', {}, 'Override'), el('th', {}, ''))),
        );
        const body = el('tbody');
        for (const g of glyphs.slice(0, 600)) {
          const override = manual[g.char] ?? null;
          body.append(el('tr', {},
            el('td', { class: 'pair' }, g.char),
            el('td', { class: 'auto' }, g.name),
            el('td', { class: 'auto' }, override === null ? `${g.advance}` : '—'),
            el('td', {}, numberField({ value: override ?? '', step: 5, min: 0, onChange: (v) => setAdvance(g.char, v) })),
            el('td', {}, override !== null ? el('button', { class: 'btn small ghost', onclick: () => { setAdvance(g.char, null); renderTable(); } }, 'Reset') : null),
          ));
        }
        table.append(body);
        tableHost.append(table);
      }
    }
    renderTable();
  }

  renderPanel();
  renderStage();
  const offFont = on('font', renderStage);
  const offProject = on('project', (d) => { if (d.reason === 'load') { renderPanel(); renderStage(); } });

  return {
    node: el('div', { class: 'layout' }, panel, stage),
    dispose: () => { offFont(); offProject(); },
  };
}
