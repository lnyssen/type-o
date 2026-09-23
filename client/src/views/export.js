// Export view: name the font, pick a format, compile the static instance on
// the server, test it in the page, and understand the license.

import { el, clear, toast, segmented } from '../ui.js';
import { state, on, setName, family } from '../state.js';
import { FORMATS, styleOf } from '../../../shared/project.js';
import { nameProblem } from '../../../shared/catalog.js';
import { applyFont } from '../fonts.js';

const FORMAT_NOTES = {
  ttf: 'TrueType — install on macOS/Windows, works in Adobe apps and Figma.',
  otf: 'OpenType/CFF — cubic outlines, often preferred for print workflows.',
  woff: 'Web font, compressed, supported everywhere.',
  woff2: 'Web font, smallest file — the modern default for @font-face.',
};

let format = 'ttf';
let testFace = null;

export function exportView() {
  const panel = el('div', { class: 'panel' });
  const stage = el('div', { class: 'stage' });
  const pad = el('div', { class: 'stage-pad' });
  stage.append(pad);
  const status = el('p', { class: 'hint' });

  const sample = el('div', { class: 'export-sample' }, 'Hamburgefonts — AVATAR 1974 — éèàç');
  const sampleLabel = el('div', { class: 'label' });
  const setSampleLabel = () => { sampleLabel.textContent = sample.classList.contains('live') ? 'Compiled font' : 'Live preview'; };

  async function compile(download) {
    const problem = nameProblem(family(), state.project.name);
    if (problem) { toast(problem, 'error'); return; }
    const buttons = panel.querySelectorAll('button');
    buttons.forEach((b) => (b.disabled = true));
    clear(status).append(el('span', { class: 'spinner' }), ` Building ${download ? format.toUpperCase() : 'WOFF2'}…`);
    const started = performance.now();
    try {
      const res = await fetch('/api/export-font', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ project: state.project, format: download ? format : 'woff2' }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || `HTTP ${res.status}`);
      const blob = await res.blob();
      const kb = (blob.size / 1024).toFixed(0);
      const secs = ((performance.now() - started) / 1000).toFixed(1);
      if (download) {
        const name = /filename="([^"]+)"/.exec(res.headers.get('Content-Disposition') || '')?.[1] || `font.${format}`;
        const url = URL.createObjectURL(blob);
        const a = el('a', { href: url, download: name });
        document.body.append(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 4000);
        toast(`${name} — ${kb} KB`, 'ok');
        clear(status).append(`${name} · ${kb} KB · ${secs}s`);
      } else {
        if (testFace) document.fonts.delete(testFace);
        testFace = new FontFace('GenTypeExportTest', await blob.arrayBuffer());
        await testFace.load();
        document.fonts.add(testFace);
        sample.style.cssText = 'font-family: GenTypeExportTest; font-variation-settings: normal; letter-spacing: normal; transform: none;';
        sample.classList.add('live');
        setSampleLabel();
        clear(status).append(`Compiled font loaded · ${kb} KB · ${secs}s`);
      }
    } catch (e) {
      toast(String(e.message || e), 'error');
      clear(status).append(el('span', { style: { color: 'var(--danger)' } }, String(e.message || e)));
    } finally {
      buttons.forEach((b) => (b.disabled = false));
    }
  }

  function renderPanel() {
    clear(panel);
    const fam = family();
    const { styleName, weightClass } = styleOf(state.project);
    const problem = nameProblem(fam, state.project.name);
    const nameHint = el('p', { class: 'hint', style: problem ? { color: 'var(--danger)' } : {} }, problem || `Exported as “${state.project.name} ${styleName}”.`);
    panel.append(
      el('section', { class: 'section' },
        el('div', { class: 'section-head static' }, el('span', { class: 'section-num' }, '01'), el('span', { class: 'section-title' }, 'Name')),
        el('div', { class: 'section-body' },
          el('input', {
            type: 'text', value: state.project.name, 'aria-label': 'Font name',
            oninput: (e) => {
              setName(e.target.value);
              const p = nameProblem(fam, e.target.value);
              nameHint.textContent = p || `Exported as “${e.target.value} ${styleName}”.`;
              nameHint.style.color = p ? 'var(--danger)' : '';
            },
          }),
          nameHint,
        ),
      ),
      el('section', { class: 'section' },
        el('div', { class: 'section-head static' }, el('span', { class: 'section-num' }, '02'), el('span', { class: 'section-title' }, 'Format')),
        el('div', { class: 'section-body' },
          segmented({ options: FORMATS, value: format, labels: Object.fromEntries(FORMATS.map((f) => [f, f.toUpperCase()])), onChange: (f) => { format = f; renderPanel(); } }),
          el('p', { class: 'hint' }, FORMAT_NOTES[format]),
          el('div', { class: 'row' }, el('span', { class: 'badge on' }, `${styleName} · ${weightClass}`), el('span', { class: 'badge' }, `from ${fam.name}`)),
        ),
      ),
      el('section', { class: 'section' },
        el('div', { class: 'section-head static' }, el('span', { class: 'section-num' }, '03'), el('span', { class: 'section-title' }, 'Build')),
        el('div', { class: 'section-body' },
          el('button', { class: 'btn primary', onclick: () => compile(true) }, 'Generate & download'),
          el('button', { class: 'btn ghost', onclick: () => compile(false) }, 'Test the compiled font here'),
          status,
        ),
      ),
    );
  }

  function renderStage() {
    clear(pad);
    const fam = family();
    const p = state.project;
    setSampleLabel();
    if (!sample.classList.contains('live')) applyFont(sample, { family: p.family, axes: p.axes, italic: p.italic, oblique: p.oblique, tracking: p.tracking });
    pad.append(
      el('h1', {}, 'Ready for', el('br'), 'the real world'),
      el('div', { class: 'export-card' },
        sampleLabel,
        sample,
      ),
      el('div', { class: 'export-grid' },
        el('div', { class: 'export-card' },
          el('h3', {}, 'License'),
          el('p', {}, `${p.name || 'Your font'} is a Modified Version of ${fam.name} (© ${fam.credit}), distributed under the SIL Open Font License 1.1. The license and original copyright are embedded in the file.`),
          el('ul', {},
            el('li', {}, 'Use it anywhere: print, web, apps, logos, commercial work.'),
            el('li', {}, 'Share, embed and bundle it with software.'),
            el('li', {}, 'Don’t sell the font file on its own, and keep it under the OFL.'),
          ),
          el('a', { class: 'link', href: `/masters/${fam.id}/OFL.txt`, target: '_blank', rel: 'noreferrer' }, 'Read the license (OFL.txt) ↗'),
        ),
        el('div', { class: 'export-card' },
          el('h3', {}, 'Use it on the web'),
          el('pre', {}, `@font-face {\n  font-family: "${p.name || 'Untitled'}";\n  src: url("${(p.name || 'Untitled').replace(/\s+/g, '')}-${styleOf(p).styleName.replace(/\s+/g, '')}.woff2") format("woff2");\n  font-weight: ${styleOf(p).weightClass};\n  font-style: ${styleOf(p).italic ? 'italic' : 'normal'};\n  font-display: swap;\n}`),
        ),
      ),
    );
  }

  renderPanel();
  renderStage();
  const off = on('project', ({ reason }) => {
    if (reason !== 'name') {
      // the compiled file no longer matches the project: go back to the live preview
      sample.classList.remove('live');
      sample.style.cssText = '';
      renderPanel();
    }
    renderStage();
  });
  return { node: el('div', { class: 'layout' }, panel, stage), dispose: off };
}
