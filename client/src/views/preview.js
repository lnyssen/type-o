// Preview view: type anything, at any size, with the kerning and ligatures the
// exported font will have.

import { el, clear, slider, toggle } from '../ui.js';
import { state, on } from '../state.js';
import { textSvg, glyphGrid } from '../render.js';

const SAMPLES = {
  Pangram: 'Voix ambiguë d’un cœur qui au zéphyr préfère les jattes de kiwis.',
  Waterfall: 'Handgloves 123\nHandgloves 123\nHandgloves 123',
  Diacritics: 'ÀÂÄÇÉÈÊËÎÏÔÖÙÛÜŸ\nāăąćčďęěğıłńňōőřşšţůűźż',
  Kerning: 'AVATAR Toy Yes Wave LT. P, F,\nquartz judge 7/8 «yes»',
  Ligatures: 'office · waffle · baffling · fi fl ff ffi ffl',
  Paragraph: 'The quick brown fox jumps over the lazy dog, while\nsphinxes of black quartz judge a vow of 1,234.56 €.',
};

let text = SAMPLES.Pangram;
let size = 64;
let kerning = true;
let ligatures = true;
let showGrid = true;

export function previewView() {
  const panel = el('div', { class: 'panel' });
  const stage = el('div', { class: 'stage' });
  const pad = el('div', { class: 'stage-pad' });
  stage.append(pad);

  function renderPanel() {
    clear(panel);
    panel.append(
      el('h2', {}, 'Sample'),
      el('textarea', { value: text, spellcheck: false, style: { minHeight: '120px' }, oninput: (e) => { text = e.target.value; renderStage(); } }),
      el('div', { class: 'row', style: { flexWrap: 'wrap', gap: '6px' } },
        ...Object.keys(SAMPLES).map((k) => el('button', {
          class: 'btn small ghost',
          onclick: () => { text = SAMPLES[k]; renderPanel(); renderStage(); },
        }, k)),
      ),
      slider({ label: 'Size', min: 12, max: 220, value: size, format: (v) => `${v}px`, onInput: (v) => { size = v; renderStage(); } }),
      el('div', { class: 'group' },
        toggle({ label: 'Kerning', checked: kerning, onChange: (v) => { kerning = v; renderStage(); } }),
        toggle({ label: 'Ligatures', checked: ligatures, onChange: (v) => { ligatures = v; renderStage(); } }),
        toggle({ label: 'Character set', checked: showGrid, onChange: (v) => { showGrid = v; renderStage(); } }),
      ),
      el('p', { class: 'hint' }, 'Rendered straight from the generated outlines — what you see is what the font file will do.'),
    );
  }

  function renderStage() {
    clear(pad);
    const font = state.font;
    if (!font) { pad.append(el('p', { class: 'hint' }, 'Generating…')); return; }
    pad.append(el('div', { class: 'specimen' }, textSvg(font, text || ' ', { fontSize: size, kerning, ligatures })));
    pad.append(el('h2', { style: { margin: '24px 0 10px' } }, 'Sizes'));
    const waterfall = el('div', { class: 'specimen', style: { display: 'flex', flexDirection: 'column', gap: '10px' } });
    for (const s of [12, 16, 24, 36, 56, 84]) {
      waterfall.append(el('div', { class: 'row', style: { gap: '14px', alignItems: 'center' } },
        el('span', { class: 'badge', style: { minWidth: '46px', textAlign: 'center' } }, `${s}px`),
        textSvg(font, 'Hamburgefonts 123', { fontSize: s, kerning, ligatures }),
      ));
    }
    pad.append(waterfall);
    if (showGrid) {
      pad.append(el('h2', { style: { margin: '24px 0 10px' } }, `Character set — ${font.glyphs.length} glyphs`), glyphGrid(font));
    }
  }

  renderPanel();
  renderStage();
  const offFont = on('font', renderStage);

  return { node: el('div', { class: 'layout' }, panel, stage), dispose: offFont };
}
