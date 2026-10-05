// Export: the font file, a specimen sheet, or the chain itself animated.
// Whatever the chain did on the Lab stage is what leaves this screen — the
// geometry is sent as-is, the server only packs and licenses it.

import { el, clear, toast, segmented, svg } from '../ui.js';
import { state, on, setName, family } from '../state.js';
import { FORMATS, styleOf } from '../../../shared/project.js';
import { nameProblem } from '../../../shared/catalog.js';
import { OPERATOR_BY_ID } from '../../../shared/ops/operators.js';
import { runGlyph } from '../../../shared/ops/chain.js';
import { buildJob, countPoints } from '../../../shared/ops/build.js';
import { lineSvg } from '../../../shared/ops/render.js';
import { outlinesFor } from '../outlines.js';

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

  const chain = () => state.project.chain.filter((s) => s.on);
  const busy = (on) => panel.querySelectorAll('button').forEach((b) => (b.disabled = on));

  async function outlines() {
    const p = state.project;
    return outlinesFor(p.family, p.axes, { italic: p.italic, extra: p.text });
  }

  function job(data, fmt) {
    const p = state.project;
    const { styleName, weightClass, widthClass, italic } = styleOf(p);
    return {
      ...buildJob(data, chain(), {
        seed: p.seed, tracking: p.tracking, familyName: p.name, styleName,
        format: fmt, version: p.version, weightClass, widthClass, italic,
      }),
      family: p.family,
    };
  }

  // --- the font file ---

  async function compile(download) {
    const p = state.project;
    const problem = nameProblem(family(), p.name);
    if (problem) { toast(problem, 'error'); return; }
    busy(true);
    const fmt = download ? format : 'woff2';
    clear(status).append(el('span', { class: 'spinner' }), ` Building ${fmt.toUpperCase()}…`);
    const started = performance.now();
    try {
      const data = await outlines();
      // No operators means nothing to reshape: instancing the master directly
      // keeps its curves, its full character set and its own kerning.
      const plain = chain().length === 0;
      const res = plain
        ? await fetch('/api/export-font', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ project: p, format: fmt }) })
        : await fetch('/api/build-font', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(job(data, fmt)) });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || `HTTP ${res.status}`);
      const blob = await res.blob();
      const kb = (blob.size / 1024).toFixed(0);
      const secs = ((performance.now() - started) / 1000).toFixed(1);
      const name = /filename="([^"]+)"/.exec(res.headers.get('Content-Disposition') || '')?.[1] || `font.${fmt}`;
      if (download) {
        save(blob, name);
        toast(`${name} — ${kb} KB`, 'ok');
        clear(status).append(`${name} · ${kb} KB · ${secs}s · ${res.headers.get('X-TypeO-Glyphs') || '?'} glyphs`);
      } else {
        if (testFace) document.fonts.delete(testFace);
        testFace = new FontFace('TypeOExportTest', await blob.arrayBuffer());
        await testFace.load();
        document.fonts.add(testFace);
        live = true;
        renderStage();
        clear(status).append(`Compiled font loaded · ${kb} KB · ${secs}s`);
      }
    } catch (e) {
      toast(String(e.message || e), 'error');
      clear(status).append(el('span', { style: { color: 'var(--danger)' } }, String(e.message || e)));
    } finally {
      busy(false);
    }
  }

  function save(blob, name) {
    const url = URL.createObjectURL(blob);
    const a = el('a', { href: url, download: name });
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  }

  // --- the specimen sheet ---

  async function specimen() {
    busy(true);
    clear(status).append(el('span', { class: 'spinner' }), ' Drawing the specimen…');
    try {
      const data = await outlines();
      const p = state.project;
      const glyphsFor = (text) => Object.fromEntries([...new Set([...text])]
        .filter((ch) => data.glyphs[ch])
        .map((ch) => [ch, runGlyph(data.glyphs[ch], chain(), { seed: p.seed, char: ch, metrics: data.metrics, upm: data.upm })]));
      const lines = [p.text || 'Rafale', 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz', '0123456789 &@?!€.,'];
      const W = 1600, PAD = 80;
      let y = PAD, parts = [];
      for (const [i, text] of lines.entries()) {
        const { body, box } = lineSvg(text, glyphsFor(text), { kerning: data.kerning, tracking: p.tracking });
        if (!box.w) continue;
        const h = i === 0 ? 420 : 150;
        const k = Math.min((W - PAD * 2) / box.w, h / Math.max(1, box.h));
        parts.push(`<g transform="translate(${(PAD - box.x0 * k).toFixed(1)} ${(y + h / 2 + ((box.y0 + box.y1) / 2) * k).toFixed(1)}) scale(${k.toFixed(4)} ${(-k).toFixed(4)})">${body}</g>`);
        y += h + 60;
      }
      const label = chain().map((s) => OPERATOR_BY_ID.get(s.op).name).join(' → ') || 'no operators';
      const sheet = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${y + PAD}" viewBox="0 0 ${W} ${y + PAD}">`
        + `<rect width="100%" height="100%" fill="#1e1e1e"/><g fill="#f4f2ed">${parts.join('')}</g>`
        + `<text x="${PAD}" y="${y + 30}" fill="#7d39eb" font-family="monospace" font-size="20">`
        + `${esc(p.name)} — ${esc(family().name)} — ${esc(label)} — seed ${p.seed}</text></svg>`;
      save(new Blob([sheet], { type: 'image/svg+xml' }), `${p.name.replace(/\s+/g, '')}-specimen.svg`);
      clear(status).append('Specimen saved as SVG.');
    } catch (e) {
      toast(String(e.message || e), 'error');
    } finally { busy(false); }
  }

  const esc = (s) => String(s).replace(/[<>&]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c]));

  // --- the animation ---

  async function animate() {
    if (!chain().length) { toast('Add an operator first — there is nothing to animate.', 'error'); return; }
    busy(true);
    clear(status).append(el('span', { class: 'spinner' }), ' Recording…');
    try {
      const data = await outlines();
      const p = state.project;
      const { recordChain } = await import('../animate.js');
      const blob = await recordChain({ data, project: p, onProgress: (t) => {
        clear(status).append(el('span', { class: 'spinner' }), ` Recording… ${Math.round(t * 100)}%`);
      } });
      save(blob, `${p.name.replace(/\s+/g, '')}-${p.seed}.webm`);
      clear(status).append(`Animation saved · ${(blob.size / 1024 / 1024).toFixed(1)} MB`);
    } catch (e) {
      toast(String(e.message || e), 'error');
      clear(status).append(el('span', { style: { color: 'var(--danger)' } }, String(e.message || e)));
    } finally { busy(false); }
  }

  // --- panel ---

  function renderPanel() {
    clear(panel);
    const fam = family();
    const p = state.project;
    const { styleName, weightClass } = styleOf(p);
    const problem = nameProblem(fam, p.name);
    const nameHint = el('p', { class: 'hint', style: problem ? { color: 'var(--danger)' } : {} },
      problem || `Exported as “${p.name} ${styleName}”.`);
    const section = (num, title, ...body) => el('section', { class: 'section' },
      el('div', { class: 'section-head static' }, el('span', { class: 'section-num' }, num), el('span', { class: 'section-title' }, title)),
      el('div', { class: 'section-body' }, ...body));

    panel.append(
      section('01', 'Name',
        el('input', {
          type: 'text', value: p.name, 'aria-label': 'Font name',
          oninput: (e) => {
            setName(e.target.value);
            const bad = nameProblem(fam, e.target.value);
            nameHint.textContent = bad || `Exported as “${e.target.value} ${styleName}”.`;
            nameHint.style.color = bad ? 'var(--danger)' : '';
          },
        }), nameHint),
      section('02', 'Format',
        segmented({ options: FORMATS, value: format, labels: Object.fromEntries(FORMATS.map((f) => [f, f.toUpperCase()])), onChange: (f) => { format = f; renderPanel(); } }),
        el('p', { class: 'hint' }, FORMAT_NOTES[format]),
        el('div', { class: 'row' },
          el('span', { class: 'badge on' }, `${styleName} · ${weightClass}`),
          el('span', { class: 'badge' }, `from ${fam.name}`),
          chain().length ? el('span', { class: 'badge' }, `${chain().length} operators`) : null)),
      section('03', 'Build',
        el('button', { class: 'btn primary', onclick: () => compile(true) }, 'Generate & download'),
        el('button', { class: 'btn ghost', onclick: () => compile(false) }, 'Test it here'),
        status),
      section('04', 'Also',
        el('button', { class: 'btn ghost', onclick: specimen }, 'Specimen sheet (SVG)'),
        el('button', { class: 'btn ghost', onclick: animate }, 'Animation (WebM)'),
        el('p', { class: 'hint' }, 'The specimen is vector. The animation plays the chain from nothing to its full setting.')),
    );
  }

  // --- stage ---

  let live = false;

  function renderStage() {
    clear(pad);
    const p = state.project;
    const fam = family();
    const label = chain().map((s) => OPERATOR_BY_ID.get(s.op).name).join(' → ') || 'no operators';
    const sample = live
      ? el('div', { class: 'export-sample live', style: { fontFamily: 'TypeOExportTest', fontSize: '64px' } }, p.text || 'Rafale')
      : el('div', { class: 'export-preview' });

    pad.append(
      el('h1', {}, 'Ready for', el('br'), 'the real world'),
      el('div', { class: 'export-card' },
        el('div', { class: 'label' }, live ? 'Compiled font' : 'What will be exported'),
        sample),
      el('div', { class: 'export-grid' },
        el('div', { class: 'export-card' },
          el('h3', {}, 'License'),
          el('p', {}, `${p.name || 'Your font'} is a Modified Version of ${fam.name} (© ${fam.credit}), distributed under the SIL Open Font License 1.1. The license and original copyright are embedded in the file.`),
          el('ul', {},
            el('li', {}, 'Use it anywhere: print, web, apps, logos, commercial work.'),
            el('li', {}, 'Share, embed and bundle it with software.'),
            el('li', {}, 'Don’t sell the font file on its own, and keep it under the OFL.')),
          el('a', { class: 'link', href: `/masters/${fam.id}/OFL.txt`, target: '_blank', rel: 'noreferrer' }, 'Read the license (OFL.txt) ↗')),
        el('div', { class: 'export-card' },
          el('h3', {}, 'The recipe'),
          el('p', {}, `${fam.name}, seed ${p.seed}`),
          el('pre', {}, chain().length
            ? chain().map((s, i) => `${i + 1}. ${OPERATOR_BY_ID.get(s.op).name}\n   ${Object.entries(s.params).map(([k, v]) => `${k} ${v}`).join('  ')}`).join('\n')
            : 'No operators — the master is instanced as it is.'),
          el('p', { class: 'hint' }, 'Saved inside the .typeo file, so this exact font can be rebuilt.'))),
    );

    if (!live) drawPreview(sample);
  }

  async function drawPreview(host) {
    try {
      const data = await outlines();
      const p = state.project;
      const text = p.text || 'Rafale';
      const glyphs = Object.fromEntries([...new Set([...text])]
        .filter((ch) => data.glyphs[ch])
        .map((ch) => [ch, runGlyph(data.glyphs[ch], chain(), { seed: p.seed, char: ch, metrics: data.metrics, upm: data.upm })]));
      const { body, box } = lineSvg(text, glyphs, { kerning: data.kerning, tracking: p.tracking });
      if (!box.w || !host.isConnected) return;
      const m = Math.max(box.w, box.h) * 0.04;
      clear(host).append(svg({
        class: 'ink', viewBox: `${box.x0 - m} ${-box.y1 - m} ${box.w + m * 2} ${box.h + m * 2}`,
        preserveAspectRatio: 'xMidYMid meet',
      }, `<g transform="scale(1 -1)">${body}</g>`));
    } catch { /* the stage is decoration; the panel reports failures */ }
  }

  renderPanel();
  renderStage();
  const off = on('project', ({ reason }) => {
    if (reason !== 'name') { live = false; renderPanel(); }
    renderStage();
  });
  return { node: el('div', { class: 'layout' }, panel, stage), dispose: off };
}
