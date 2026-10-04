// Record the chain as it comes on: every parameter that has an "off" value
// ramps from there to its setting, so the letters start intact and end up
// wherever the operators take them.
//
// Frames are computed first and played back afterwards, so a slow chain gives
// a correctly timed video instead of a slow-motion one.

import { OPERATOR_BY_ID } from '../../shared/ops/operators.js';
import { runGlyph } from '../../shared/ops/chain.js';
import { layout } from '../../shared/ops/render.js';

const FPS = 30;
const SECONDS = 3.2;
const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);

function chainAt(chain, t) {
  return chain.map((step) => {
    const op = OPERATOR_BY_ID.get(step.op);
    const params = { ...step.params };
    for (const spec of op.params) {
      if (spec.off === undefined) continue;
      const value = spec.off + (step.params[spec.key] - spec.off) * t;
      params[spec.key] = spec.step >= 1 ? Math.round(value) : value;
    }
    return { ...step, params };
  });
}

function fill(ctx, contours) {
  ctx.beginPath();
  for (const c of contours) {
    if (c.length < 6) continue;
    ctx.moveTo(c[0], c[1]);
    for (let i = 2; i < c.length; i += 2) ctx.lineTo(c[i], c[i + 1]);
    ctx.closePath();
  }
  // Clipper winds holes against their outer contour, which is exactly what
  // the even-odd rule needs to leave counters open.
  ctx.fill('evenodd');
}

export async function recordChain({ data, project, width = 1280, height = 640, onProgress = () => {} }) {
  if (typeof MediaRecorder === 'undefined') throw new Error('This browser cannot record video.');
  const text = project.text || 'Rafale';
  const chars = [...new Set([...text])].filter((ch) => data.glyphs[ch]);
  const chain = project.chain.filter((s) => s.on);
  const total = Math.round(FPS * SECONDS);

  // 1. compute every frame, and the box that holds all of them
  const frames = [];
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (let f = 0; f <= total; f++) {
    const t = ease(f / total);
    const at = chainAt(chain, t);
    const glyphs = {};
    for (const ch of chars) {
      glyphs[ch] = runGlyph(data.glyphs[ch], at, { seed: project.seed, char: ch, metrics: data.metrics, upm: data.upm });
    }
    const { items } = layout(text, glyphs, { kerning: data.kerning, tracking: project.tracking });
    for (const { x, glyph } of items) {
      for (const c of glyph.contours) {
        for (let i = 0; i < c.length; i += 2) {
          if (c[i] + x < x0) x0 = c[i] + x;
          if (c[i] + x > x1) x1 = c[i] + x;
          if (c[i + 1] < y0) y0 = c[i + 1];
          if (c[i + 1] > y1) y1 = c[i + 1];
        }
      }
    }
    frames.push(items);
    onProgress((f / total) * 0.75);
    if (f % 4 === 0) await new Promise((r) => setTimeout(r, 0)); // keep the page alive
  }
  if (x0 === Infinity) throw new Error('Nothing to record.');

  // 2. one transform that fits every frame, so the word never jumps
  const pad = Math.max(x1 - x0, y1 - y0) * 0.06;
  const bw = x1 - x0 + pad * 2, bh = y1 - y0 + pad * 2;
  const k = Math.min(width / bw, height / bh);

  const canvas = document.createElement('canvas');
  canvas.width = width; canvas.height = height;
  const ctx = canvas.getContext('2d');

  const stream = canvas.captureStream(FPS);
  const type = ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm']
    .find((t) => MediaRecorder.isTypeSupported(t));
  if (!type) throw new Error('This browser cannot record WebM.');
  const recorder = new MediaRecorder(stream, { mimeType: type, videoBitsPerSecond: 8_000_000 });
  const chunks = [];
  recorder.ondataavailable = (e) => e.data.size && chunks.push(e.data);
  const done = new Promise((resolve) => { recorder.onstop = resolve; });
  recorder.start();

  // 3. play the frames back in real time
  for (let f = 0; f < frames.length; f++) {
    ctx.fillStyle = '#1e1e1e';
    ctx.fillRect(0, 0, width, height);
    ctx.save();
    ctx.translate((width - bw * k) / 2 - (x0 - pad) * k, (height + bh * k) / 2 + (y0 - pad) * k);
    ctx.scale(k, -k);
    ctx.fillStyle = '#f4f2ed';
    for (const { x, glyph } of frames[f]) {
      ctx.save();
      ctx.translate(x, 0);
      fill(ctx, glyph.contours);
      ctx.restore();
    }
    ctx.restore();
    onProgress(0.75 + (f / frames.length) * 0.25);
    await new Promise((r) => setTimeout(r, 1000 / FPS));
  }
  await new Promise((r) => setTimeout(r, 160));
  recorder.stop();
  await done;
  return new Blob(chunks, { type });
}
