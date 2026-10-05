// The atelier: real outlines from a master, a stack of destructive operators,
// and a word rendered live from the result. Nothing here is a preview of
// something else — these polygons are what gets packed into the exported font.

import { el, clear, slider, segmented, svg } from '../ui.js';
import { applyFont } from '../fonts.js';
import { state, on, family, setFamily, setAxis, setChain, setSeed, setText } from '../state.js';
import { FAMILIES, GENRES, defaultAxes } from '../../../shared/catalog.js';
import { OPERATORS, OPERATOR_BY_ID } from '../../../shared/ops/operators.js';
import { runGlyph, addStep, rollLegibleChain, legibility } from '../../../shared/ops/chain.js';
import { lineSvg, pathData } from '../../../shared/ops/render.js';
import { outlinesFor, WORKING_SET } from '../outlines.js';

const ALPHABET = [...'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789&@?!€.,'];
let tab = 'word';
let inverted = false;   // the specimen's polarity, independent of the interface
let genreFilter = null;
let openStep = 0;

// Roboto Flex has thirteen axes; naming them all turns the row into a wall.
function axisSummary(f) {
  const names = f.axes.map((a) => a.label.toLowerCase());
  const shown = names.slice(0, 4).join(', ');
  const rest = names.length - 4;
  return `${f.genre} · ${shown}${rest > 0 ? ` +${rest} more` : ''}${f.italic ? ' · italic' : ''}`;
}

export function atelierView() {
  const panel = el('div', { class: 'panel' });
  const stage = el('div', { class: 'stage' });
  const pad = el('div', { class: 'stage-pad' });
  stage.append(pad);

  let data = null;          // outlines from the server
  let loading = false;
  let error = null;
  let token = 0;            // guards against a slow fetch overwriting a fast one

  const chain = () => state.project.chain;
  const probe = () => (data ? { glyph: data.glyphs.R || Object.values(data.glyphs)[0], char: 'R', metrics: data.metrics, upm: data.upm } : null);

  function transform(chars) {
    const out = {};
    if (!data) return out;
    for (const ch of chars) {
      const glyph = data.glyphs[ch];
      if (glyph) out[ch] = runGlyph(glyph, chain(), { seed: state.project.seed, char: ch, metrics: data.metrics, upm: data.upm });
    }
    return out;
  }

  async function load() {
    const p = state.project;
    const mine = ++token;
    loading = true; error = null;
    renderStage();
    try {
      const got = await outlinesFor(p.family, p.axes, { italic: p.italic, extra: p.text });
      if (mine !== token) return;
      data = got;
    } catch (e) {
      if (mine !== token) return;
      error = String(e.message || e);
    } finally {
      if (mine === token) { loading = false; renderPanel(); renderStage(); }
    }
  }

  // ---- panel ----

  function section(num, title, body, aside) {
    return el('section', { class: 'section' },
      el('div', { class: 'section-head static' },
        el('span', { class: 'section-num' }, num),
        el('span', { class: 'section-title' }, title),
        aside || null),
      el('div', { class: 'section-body' }, body));
  }

  function sourceSection() {
    const fam = family();
    const pick = el('button', {
      class: 'source-pick', onclick: () => { tab = 'source'; renderStage(); },
      title: 'Browse every family',
    },
      applyFont(el('span', { class: 'source-pick-name' }, fam.name), { family: fam.id, axes: defaultAxes(fam) }),
      el('span', { class: 'source-pick-go' }, 'Change'),
      el('span', { class: 'source-pick-meta' }, `${fam.genre} · ${fam.axes.length} ${fam.axes.length > 1 ? 'axes' : 'axis'}`));
    const axes = el('div', { class: 'group' },
      ...fam.axes.slice(0, 5).map((a) => slider({
        label: a.label, hint: a.hint, min: a.min, max: a.max, step: a.step, value: state.project.axes[a.tag],
        format: (v) => (a.step < 1 ? Number(v).toFixed(1) : String(Math.round(v))),
        onInput: (v) => setAxis(a.tag, v),
      })));
    return section('01', 'Source', [pick, axes]);
  }

  function stepCard(step, i) {
    const op = OPERATOR_BY_ID.get(step.op);
    const open = openStep === i;
    const head = el('div', { class: 'step-head' },
      el('button', {
        class: 'step-name', onclick: () => { openStep = open ? -1 : i; renderPanel(); },
        title: op.blurb,
      }, el('span', { class: 'step-index' }, String(i + 1)), op.name),
      el('button', { class: 'step-btn', title: step.on ? 'Mute' : 'Unmute', 'aria-pressed': String(!step.on), onclick: () => update(i, { on: !step.on }) }, step.on ? '◉' : '○'),
      el('button', { class: 'step-btn', title: 'Move up', disabled: i === 0, onclick: () => move(i, -1) }, '↑'),
      el('button', { class: 'step-btn', title: 'Move down', disabled: i === chain().length - 1, onclick: () => move(i, 1) }, '↓'),
      el('button', { class: 'step-btn danger', title: 'Remove', onclick: () => remove(i) }, '✕'));
    const body = open ? el('div', { class: 'step-body' },
      el('p', { class: 'hint' }, op.blurb),
      ...op.params.map((spec) => spec.type === 'pick'
        ? el('div', { class: 'control' },
            el('div', { class: 'control-head' }, el('label', {}, spec.label)),
            segmented({ options: spec.options, value: step.params[spec.key], onChange: (v) => setParam(i, spec.key, v) }))
        : slider({
            label: spec.label, hint: spec.hint, min: spec.min, max: spec.max, step: spec.step,
            value: step.params[spec.key], format: (v) => (spec.em ? `${Math.round(v)}‰` : String(v)),
            onInput: (v) => setParam(i, spec.key, v),
          }))) : null;
    return el('div', { class: `step${step.on ? '' : ' muted'}${open ? ' open' : ''}` }, head, body);
  }

  const replace = (next) => setChain(next);
  const update = (i, patch) => replace(chain().map((s, j) => (j === i ? { ...s, ...patch } : s)));
  const setParam = (i, key, value) => replace(chain().map((s, j) => (j === i ? { ...s, params: { ...s.params, [key]: value } } : s)));
  const remove = (i) => { openStep = -1; replace(chain().filter((_, j) => j !== i)); };
  function move(i, d) {
    const next = [...chain()];
    [next[i], next[i + d]] = [next[i + d], next[i]];
    openStep = i + d;
    replace(next);
  }

  function chainSection() {
    const steps = chain().length
      ? chain().map(stepCard)
      : [el('p', { class: 'hint' }, 'No operators yet — add one, or roll a stack below.')];
    const menu = el('div', { class: 'add-menu' },
      ...OPERATORS.map((op) => el('button', {
        class: 'chip', title: op.blurb,
        onclick: () => { openStep = chain().length; replace(addStep(chain(), op.id)); },
      }, `+ ${op.name}`)));
    return section('02', 'Stack', [el('div', { class: 'steps' }, ...steps), menu],
      el('span', { class: 'section-aside' }, `${chain().filter((s) => s.on).length} active`));
  }

  function rollSection() {
    const score = data && chain().length ? legibility(probe().glyph, transform('R').R || probe().glyph) : null;
    return section('03', 'Random', [
      el('button', { class: 'btn primary wide', onclick: roll }, 'Roll a typeface'),
      el('div', { class: 'row seed-row' },
        slider({ label: 'Seed', min: 0, max: 999, step: 1, value: state.project.seed % 1000, onInput: (v) => setSeed(v) }),
        el('button', { class: 'btn small', title: 'Same stack, new accidents', onclick: () => setSeed(state.project.seed + 1) }, 'Next')),
      score === null ? null : el('div', { class: 'meter' },
        el('div', { class: 'meter-bar' }, el('i', { style: { width: `${Math.max(0, Math.min(1, score)) * 100}%` } })),
        el('span', { class: 'hint' }, `Legibility ${score.toFixed(2)}`)),
    ]);
  }

  function roll() {
    if (!data) return;
    setSeed(Math.floor(Math.random() * 1e6));
    setChain(rollLegibleChain(state.project.seed, probe()));
  }

  function renderPanel() {
    const scroll = panel.scrollTop;
    clear(panel);
    panel.append(sourceSection(), chainSection(), rollSection());
    panel.scrollTop = scroll;
  }

  // ---- stage ----

  function svgOf(text, glyphs, kerning) {
    const { body, box } = lineSvg(text, glyphs, { kerning, tracking: state.project.tracking });
    if (!box.w || !box.h) return el('p', { class: 'hint' }, 'Nothing left to draw — soften an operator.');
    const m = Math.max(box.w, box.h) * 0.04;
    return svg({
      class: 'ink',
      viewBox: `${box.x0 - m} ${-box.y1 - m} ${box.w + m * 2} ${box.h + m * 2}`,
      preserveAspectRatio: 'xMidYMid meet',
    }, `<g transform="scale(1 -1)">${body}</g>`);
  }

  function renderStage() {
    clear(pad);
    const p = state.project;
    pad.append(el('div', { class: 'stage-head' },
      el('div', { class: 'meta' },
        el('span', { class: 'meta-name' }, p.name || 'Untitled'),
        el('span', {}, family().name),
        el('span', {}, chain().filter((s) => s.on).map((s) => OPERATOR_BY_ID.get(s.op).name).join(' → ') || 'no operators'),
        loading ? el('span', { class: 'meta-look' }, 'reading outlines…') : null),
      el('div', { class: 'tabs', role: 'tablist' },
        ...[['word', 'Word'], ['alphabet', 'Alphabet'], ['source', 'Source']].map(([id, label]) =>
          el('button', { class: 'tab', role: 'tab', 'aria-selected': String(tab === id), onclick: () => { tab = id; renderStage(); } }, label)),
        // A typeface does not weigh the same in both polarities; let it be seen
        // either way without touching the interface's own theme.
        el('button', {
          class: 'polarity', title: 'Black on white, or white on black',
          'aria-pressed': String(inverted),
          onclick: () => { inverted = !inverted; stage.classList.toggle('inverted', inverted); renderStage(); },
        }))));

    if (error) { pad.append(el('p', { class: 'hint', style: { color: 'var(--danger)' } }, error)); return; }
    if (!data) { pad.append(el('div', { class: 'loading' }, el('span', { class: 'spinner' }), ' Instancing the master…')); return; }

    if (tab === 'source') return renderSource();
    if (tab === 'alphabet') return renderAlphabet();

    const input = el('input', {
      type: 'text', class: 'sample-input', value: p.text, spellcheck: false, 'aria-label': 'Word',
      oninput: (e) => setText(e.target.value),
    });
    const chars = [...new Set([...(p.text || ' ')])].join('');
    pad.append(input, el('div', { class: 'ink-stage' }, svgOf(p.text || ' ', transform(chars), data.kerning)));
  }

  // Every family, set in itself, at the weight you are working at. Choosing a
  // typeface by reading its own letters beats reading its name in a chip.
  function renderSource() {
    const p = state.project;
    const sample = p.text || 'Rafale';
    const chips = el('div', { class: 'chips source-filter' },
      el('button', { class: 'chip', 'aria-pressed': String(!genreFilter), onclick: () => { genreFilter = null; renderStage(); } }, 'All'),
      ...GENRES.filter((g) => FAMILIES.some((f) => f.genre === g)).map((g) =>
        el('button', { class: 'chip', 'aria-pressed': String(genreFilter === g), onclick: () => { genreFilter = g; renderStage(); } }, g)));

    const list = el('div', { class: 'source-list' });
    for (const f of FAMILIES) {
      if (genreFilter && f.genre !== genreFilter) continue;
      // Show each family at the weight being worked at, where it has one.
      const axes = { ...defaultAxes(f) };
      if (f.axes.some((a) => a.tag === 'wght') && p.axes.wght != null) {
        const spec = f.axes.find((a) => a.tag === 'wght');
        axes.wght = Math.min(spec.max, Math.max(spec.min, p.axes.wght));
      }
      list.append(el('button', {
        class: 'source-row', 'aria-pressed': String(f.id === p.family),
        onclick: () => { setFamily(f.id); tab = 'word'; renderStage(); },
      },
        el('div', { class: 'source-row-head' },
          el('span', { class: 'source-row-name' }, f.name),
          el('span', { class: 'source-row-meta' }, axisSummary(f))),
        applyFont(el('div', { class: 'source-row-sample' }, sample), { family: f.id, axes }),
        el('p', { class: 'source-row-blurb' }, f.blurb)));
    }
    pad.append(chips, list);
  }

  // The alphabet can be a few hundred boolean operations: fill it in slices so
  // the panel stays responsive while it draws.
  function renderAlphabet() {
    const grid = el('div', { class: 'ink-grid' });
    pad.append(grid);
    const mine = token;
    let i = 0;
    const step = () => {
      if (mine !== token || !grid.isConnected) return;
      const slice = ALPHABET.slice(i, i + 8);
      for (const ch of slice) {
        const glyph = data.glyphs[ch];
        if (!glyph) continue;
        const out = runGlyph(glyph, chain(), { seed: state.project.seed, char: ch, metrics: data.metrics, upm: data.upm });
        const cell = el('div', { class: 'ink-cell', title: ch });
        cell.append(svgOf(ch, { [ch]: out }, {}));
        grid.append(cell);
      }
      i += 8;
      if (i < ALPHABET.length) setTimeout(step, 0);
    };
    step();
  }

  // ---- wiring ----

  renderPanel();
  load();
  const off = on('project', ({ reason }) => {
    if (reason === 'family' || reason === 'axes' || reason === 'italic') { data = null; load(); renderPanel(); return; }
    if (reason === 'text' && [...state.project.text].some((c) => !WORKING_SET.includes(c) && !(data?.glyphs[c]))) { load(); return; }
    if (reason === 'chain' || reason === 'seed') renderPanel();
    renderStage();
  });

  return { node: el('div', { class: 'layout' }, panel, stage), dispose: () => { token++; off(); } };
}
