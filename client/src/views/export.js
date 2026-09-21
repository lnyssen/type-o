// Export view: compile on the server, download the binary, and test the real
// font file in the browser before shipping it.

import { el, clear, toast, segmented } from '../ui.js';
import { state, on, setName } from '../state.js';
import { FORMATS } from '../../../shared/engine/export.js';
import { styleFor } from '../../../shared/engine/params.js';

const FORMAT_NOTES = {
  ttf: 'Desktop-friendly TrueType. Install anywhere, works in Adobe apps and Figma.',
  otf: 'PostScript/CFF outlines. Slightly smaller, preferred by many designers for print.',
  woff: 'Web font, compressed, supported everywhere.',
  woff2: 'Web font, smallest file, the modern default for @font-face.',
};

let format = 'ttf';
let lastTest = null;

export function exportView() {
  const panel = el('div', { class: 'panel' });
  const stage = el('div', { class: 'stage' });
  const pad = el('div', { class: 'stage-pad' });
  stage.append(pad);
  const status = el('p', { class: 'hint' });
  const sample = el('div', {
    style: { fontSize: '44px', lineHeight: '1.25', marginTop: '18px', minHeight: '120px' },
  }, 'Hamburgefonts — AVATAR 123');

  async function compile({ download }) {
    const btns = panel.querySelectorAll('button');
    btns.forEach((b) => (b.disabled = true));
    clear(status).append(el('span', { class: 'spinner' }), ' Compiling ', format.toUpperCase(), '…');
    const started = performance.now();
    try {
      const res = await fetch('/api/export-font', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ project: state.project, format: download ? format : 'woff2' }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
        throw new Error(err.error || `HTTP ${res.status}`);
      }
      const blob = await res.blob();
      const seconds = ((performance.now() - started) / 1000).toFixed(1);
      const kb = (blob.size / 1024).toFixed(1);
      if (download) {
        const url = URL.createObjectURL(blob);
        const a = el('a', { href: url, download: `${(state.project.name || 'Untitled').replace(/\s+/g, '')}-${styleFor(state.project.params).styleName}.${format}` });
        document.body.append(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 4000);
        toast(`${format.toUpperCase()} ready — ${kb} KB`, 'ok');
        clear(status).append(`Done in ${seconds}s · ${kb} KB · ${res.headers.get('X-GenType-Glyphs') || '?'} glyphs`);
      } else {
        if (lastTest) document.fonts.delete(lastTest);
        const face = new FontFace('GenTypeTest', await blob.arrayBuffer());
        await face.load();
        document.fonts.add(face);
        lastTest = face;
        sample.style.fontFamily = 'GenTypeTest';
        toast('Loaded the compiled font into this page', 'ok');
        clear(status).append(`Live test running — ${kb} KB WOFF2`);
      }
    } catch (e) {
      toast(String(e.message || e), 'error');
      clear(status).append(el('span', { style: { color: 'var(--danger)' } }, String(e.message || e)));
    } finally {
      btns.forEach((b) => (b.disabled = false));
    }
  }

  function renderPanel() {
    clear(panel);
    const { styleName, weightClass } = styleFor(state.project.params);
    panel.append(
      el('h2', {}, 'Export'),
      el('div', { class: 'control' },
        el('div', { class: 'control-head' }, el('label', {}, 'Family name')),
        el('input', { type: 'text', value: state.project.name, oninput: (e) => setName(e.target.value) }),
      ),
      el('div', { class: 'control' },
        el('div', { class: 'control-head' }, el('label', {}, 'Format')),
        segmented({ options: FORMATS, value: format, labels: Object.fromEntries(FORMATS.map((f) => [f, f.toUpperCase()])), onChange: (f) => { format = f; renderPanel(); } }),
        el('p', { class: 'hint' }, FORMAT_NOTES[format]),
      ),
      el('div', { class: 'row' },
        el('span', { class: 'badge on' }, `${styleName} · ${weightClass}`),
        el('span', { class: 'badge' }, `${state.font?.glyphs.length ?? '…'} glyphs`),
      ),
      el('div', { class: 'group' },
        el('button', { class: 'btn primary', onclick: () => compile({ download: true }) }, 'Generate & download'),
        el('button', { class: 'btn ghost', onclick: () => compile({ download: false }) }, 'Test in this page'),
        status,
      ),
      el('p', { class: 'hint' }, 'Compilation runs on the server with fontTools: overlaps removed, curves fitted, kerning and ligatures written as OpenType features.'),
    );
  }

  function renderStage() {
    clear(pad);
    pad.append(
      el('h1', {}, 'Ready for', el('br'), 'the real world'),
      el('p', { class: 'hint', style: { maxWidth: '52ch', marginTop: '14px' } },
        'Every export carries proper vertical metrics, optical sidebearings, class kerning, f-ligatures and full Latin Extended-A coverage. Install it, drop it in Figma, or serve it with @font-face.'),
      el('div', { class: 'specimen' },
        el('p', { class: 'hint' }, 'Live test — the text below uses the compiled font once you press “Test in this page”.'),
        sample,
      ),
      el('div', { class: 'specimen', style: { marginTop: '16px' } },
        el('h3', {}, 'Use it on the web'),
        el('pre', { style: { margin: '10px 0 0', color: 'var(--text-dim)', fontSize: '12px', overflowX: 'auto' } },
          `@font-face {\n  font-family: "${state.project.name || 'Untitled'}";\n  src: url("${(state.project.name || 'Untitled').replace(/\s+/g, '')}-${styleFor(state.project.params).styleName}.woff2") format("woff2");\n  font-weight: ${styleFor(state.project.params).weightClass};\n  font-display: swap;\n}`),
      ),
    );
  }

  renderPanel();
  renderStage();
  const offFont = on('font', () => renderPanel());
  const offProject = on('project', (d) => { if (d.reason === 'load' || d.reason === 'name') { renderPanel(); renderStage(); } });

  return { node: el('div', { class: 'layout' }, panel, stage), dispose: () => { offFont(); offProject(); } };
}
