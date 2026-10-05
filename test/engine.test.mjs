import test from 'node:test';
import assert from 'node:assert/strict';

import { generateFont, GLYPHS, GLYPH_BY_CHAR, skeletonFor, editableGlyphs } from '../shared/engine/font.js';
import { parseSkeleton, serializeSkeleton, validateSkeleton } from '../shared/engine/skeleton.js';
import { derive, defaultParams, defaultMetrics, normalizeParams } from '../shared/engine/params.js';
import { buildExportPayload, FORMATS } from '../shared/engine/export.js';
import { newProject, serializeProject, parseProject } from '../shared/engine/project.js';

const project = (params = {}, metrics = {}) => ({ name: 'Test', params, metrics, skeletons: {} });

test('the default set covers Latin Extended-A with 200+ glyphs', () => {
  assert.ok(GLYPHS.length > 200, `only ${GLYPHS.length} glyphs`);
  for (const ch of 'AZaz09.,;:!?-—“”«»€$@&#%ÀÇÉÎÑÖŒßŠŽąčęłńřůž') {
    assert.ok(GLYPH_BY_CHAR.has(ch), `missing ${ch}`);
  }
});

test('every glyph produces finite, closed outlines with a positive advance', () => {
  const font = generateFont(project());
  for (const name of font.order) {
    const g = font.glyphs.get(name);
    assert.ok(g.advance > 0, `${name} has no advance`);
    assert.ok(Number.isFinite(g.lsb), `${name} has a bad sidebearing`);
    if (name === 'space') { assert.equal(g.contours.length, 0); continue; }
    assert.ok(g.contours.length > 0, `${name} drew nothing`);
    for (const c of g.contours) {
      assert.ok(c.length >= 3, `${name} has a degenerate contour`);
      for (const p of c) assert.ok(Number.isFinite(p.x) && Number.isFinite(p.y), `${name} has NaN coordinates`);
    }
  }
});

test('strokes align to their zones, curves overshoot slightly', () => {
  const m = { xHeight: 500, capHeight: 700, ascender: 760, descender: -220 };
  const font = generateFont(project({ weight: 50 }, m));
  const D = derive({ weight: 50 }, m);
  const near = (a, b, tol) => Math.abs(a - b) <= tol;
  assert.ok(near(font.glyphs.get('H').bbox.yMax, 700, 2), 'H should stop at the cap line');
  assert.ok(near(font.glyphs.get('H').bbox.yMin, 0, 2), 'H should sit on the baseline');
  assert.ok(near(font.glyphs.get('x').bbox.yMax, 500, 2), 'x should stop at the x-height');
  const o = font.glyphs.get('o').bbox;
  assert.ok(o.yMax > 500 && o.yMax <= 500 + D.overshoot + 2, `o overshoot out of range (${o.yMax})`);
  assert.ok(o.yMin < 0 && o.yMin >= -D.overshoot - 2, `o overshoot out of range (${o.yMin})`);
  assert.ok(near(font.glyphs.get('p').bbox.yMin, -220, 3), 'p should reach the descender');
});

test('vertical metrics drive the geometry', () => {
  const tall = generateFont(project({}, { xHeight: 600, capHeight: 780 }));
  assert.ok(Math.abs(tall.glyphs.get('x').bbox.yMax - 600) <= 2);
  assert.ok(Math.abs(tall.glyphs.get('H').bbox.yMax - 780) <= 2);
});

test('weight, width and contrast change the shapes as expected', () => {
  const light = generateFont(project({ weight: 5, contrast: 0 }));
  const black = generateFont(project({ weight: 100, contrast: 0 }));
  const stemOf = (font) => { const b = font.glyphs.get('l').bbox; return b.xMax - b.xMin; };
  assert.ok(stemOf(black) > stemOf(light) * 3, 'black should be much heavier than thin');

  const normal = generateFont(project({ width: 'normal' }));
  const condensed = generateFont(project({ width: 'condensed' }));
  assert.ok(condensed.glyphs.get('n').advance < normal.glyphs.get('n').advance);

  const flat = generateFont(project({ weight: 50, contrast: 0 }));
  const high = generateFont(project({ weight: 50, contrast: 100 }));
  const barHeight = (font) => { const b = font.glyphs.get('hyphen').bbox; return b.yMax - b.yMin; };
  assert.ok(barHeight(high) < barHeight(flat) * 0.6, 'high contrast should thin the horizontals');
});

test('the same seed always produces the same font', () => {
  const key = (font) => font.order.map((n) => font.glyphs.get(n).contours.flat().map((p) => `${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(' ')).join('|');
  const a = generateFont(project({ modulation: 60, seed: 7 }));
  const b = generateFont(project({ modulation: 60, seed: 7 }));
  const c = generateFont(project({ modulation: 60, seed: 8 }));
  assert.equal(key(a), key(b), 'same seed must be reproducible');
  assert.notEqual(key(a), key(c), 'a different seed must change the shapes');
});

test('auto-kerning tightens the classic pairs and leaves flat ones alone', () => {
  const font = generateFont(project());
  const k = (a, b) => font.kerning[`${GLYPH_BY_CHAR.get(a).name}|${GLYPH_BY_CHAR.get(b).name}`] ?? 0;
  for (const pair of ['AV', 'VA', 'AT', 'LT', 'Yo', 'Ta']) assert.ok(k(pair[0], pair[1]) <= -20, `${pair} should be kerned (${k(pair[0], pair[1])})`);
  for (const pair of ['HH', 'nn', 'oo', 'OO']) assert.equal(k(pair[0], pair[1]), 0, `${pair} should not need kerning`);
  for (const v of Object.values(font.autoKerning)) assert.ok(v >= -160 && v <= 160, `kern ${v} is out of a sane range`);
});

test('manual metrics override the automatic ones', () => {
  const font = generateFont({ ...project(), metrics: { ...defaultMetrics(), advanceWidths: { A: 999 }, kerning: { AV: -123 } } });
  assert.equal(font.glyphs.get('A').advance, 999);
  assert.equal(font.kerning['A|V'], -123);
});

test('accents are placed above their base and share its advance', () => {
  const font = generateFont(project());
  for (const [acc, base] of [['Aacute', 'A'], ['eacute', 'e'], ['ncaron', 'n'], ['otilde', 'o']]) {
    const a = font.glyphs.get(acc), b = font.glyphs.get(base);
    assert.equal(a.advance, b.advance, `${acc} should keep the advance of ${base}`);
    assert.ok(a.bbox.yMax > b.bbox.yMax, `${acc} should be taller than ${base}`);
  }
  const cedilla = font.glyphs.get('Ccedilla');
  assert.ok(cedilla.bbox.yMin < 0, 'the cedilla should hang below the baseline');
});

test('extreme parameter combinations stay finite and reasonably fast', () => {
  const combos = [
    { weight: 0, contrast: 100, tension: 0 },
    { weight: 100, contrast: 100, tension: 100, serifMode: true },
    { weight: 100, contrast: 0, terminals: 'rounded', width: 'expanded' },
    { weight: 70, modulation: 100, terminals: 'serif', width: 'condensed', seed: 999 },
  ];
  for (const params of combos) {
    const started = Date.now();
    const font = generateFont(project(params));
    assert.ok(Date.now() - started < 4000, 'generation should not crawl');
    for (const name of font.order) {
      const g = font.glyphs.get(name);
      for (const c of g.contours) for (const p of c) assert.ok(Number.isFinite(p.x) && Number.isFinite(p.y), `${name} broke at ${JSON.stringify(params)}`);
    }
  }
});

test('the skeleton notation round-trips', () => {
  const src = '0,0 -- 0,700; 0,380 .. 245,500{0} .. 470,250 .. 245,0{180}^ .. 0,120; [w=0.6,noserif] 10,10 .. 20,20 .. cycle';
  const parsed = parseSkeleton(src);
  assert.deepEqual(validateSkeleton(parsed), []);
  const again = parseSkeleton(serializeSkeleton(parsed));
  assert.deepEqual(again, parsed);
  assert.throws(() => parseSkeleton('0,0 0,700'), /Missing connector/);
});

test('every default skeleton is valid and editable', () => {
  for (const g of editableGlyphs()) {
    const sk = skeletonFor(g.id, {});
    assert.deepEqual(validateSkeleton(sk, g.id), [], `${g.id} has an invalid skeleton`);
  }
});

test('edited skeletons replace the defaults', () => {
  const custom = parseSkeleton('0,0 -- 0,700');
  const font = generateFont({ ...project(), skeletons: { A: custom } });
  const A = font.glyphs.get('A');
  assert.ok(A.bbox.xMax - A.bbox.xMin < 200, 'the edited A should be a single stem');
});

test('projects round-trip through .typeo', () => {
  const p = newProject('My Face');
  p.params.weight = 77;
  p.metrics.kerning.AV = -50;
  p.skeletons.A = parseSkeleton('0,0 -- 0,700');
  const { project: loaded, warnings } = parseProject(serializeProject(p));
  assert.deepEqual(warnings, []);
  assert.equal(loaded.name, 'My Face');
  assert.equal(loaded.params.weight, 77);
  assert.equal(loaded.metrics.kerning.AV, -50);
  assert.deepEqual(loaded.skeletons.A, p.skeletons.A);
  assert.throws(() => parseProject('{"format":"nope"}'), /Not a TYPE-O project/);
});

test('bad input is coerced instead of crashing', () => {
  const p = normalizeParams({ weight: 5000, contrast: 'abc', terminals: 'dragon', seed: -4 });
  assert.equal(p.weight, 100);
  assert.equal(p.contrast, defaultParams().contrast);
  assert.equal(p.terminals, 'sharp');
  assert.equal(p.seed, 0);
  const { project: loaded, warnings } = parseProject({ format: 'typeo', skeletons: { A: { strokes: [{ nodes: [{ x: 'x', y: 0 }], joins: [] }] }, Nope: { strokes: [] } } });
  assert.equal(Object.keys(loaded.skeletons).length, 0);
  assert.ok(warnings.length >= 1);
});

test('export payloads are complete and free of NaN', () => {
  for (const format of FORMATS) {
    const payload = buildExportPayload({ ...project({ weight: 60, serifMode: true }), name: 'Payload Test' }, format);
    assert.equal(payload.format, format);
    assert.ok(payload.glyphs.length > 200);
    assert.ok(payload.kerning.pairs.length > 50);
    assert.ok(payload.ligatures.length >= 5);
    const numbers = [];
    for (const g of payload.glyphs) {
      assert.ok(Number.isInteger(g.advance) && g.advance >= 0, `${g.name} advance`);
      for (const c of g.contours) {
        numbers.push(...c.start);
        for (const s of c.segs) numbers.push(...s.slice(1));
      }
    }
    assert.ok(numbers.every(Number.isFinite), 'payload contains NaN');
    for (const [a, b] of payload.kerning.pairs) {
      assert.ok(payload.kerning.classes[a] && payload.kerning.classes[b], 'kern pair references an undefined class');
    }
  }
  assert.throws(() => buildExportPayload(project(), 'svg'), /Unsupported format/);
});

test('curve fitting keeps outlines close to the sampled shape', () => {
  const payload = buildExportPayload(project({ weight: 50 }), 'ttf');
  const font = generateFont(project({ weight: 50 }), { quality: 'export' });
  for (const name of ['O', 'o', 'S', 'a']) {
    const source = font.glyphs.get(name);
    const target = payload.glyphs.find((g) => g.name === name);
    const bounds = (pts) => pts.reduce((acc, p) => ({
      xMin: Math.min(acc.xMin, p[0]), xMax: Math.max(acc.xMax, p[0]),
      yMin: Math.min(acc.yMin, p[1]), yMax: Math.max(acc.yMax, p[1]),
    }), { xMin: 1e9, xMax: -1e9, yMin: 1e9, yMax: -1e9 });
    const pts = target.contours.flatMap((c) => [c.start, ...c.segs.map((s) => s.slice(-2))]);
    const b = bounds(pts);
    assert.ok(Math.abs(b.xMin - source.bbox.xMin) < 4 && Math.abs(b.yMax - source.bbox.yMax) < 4, `${name} drifted while fitting`);
    const segments = target.contours.reduce((n, c) => n + c.segs.length, 0);
    assert.ok(segments < 160, `${name} uses ${segments} segments — fitting is not compressing`);
  }
});

test('serifs stay proportionate and never fuse with the neighbours', () => {
  for (const contrast of [0, 55, 100]) {
    const font = generateFont(project({ weight: 55, contrast, serifMode: true }));
    for (const [a, b] of [['a', 'm'], ['m', 'l'], ['n', 'n'], ['H', 'I']]) {
      const ga = font.glyphs.get(a), gb = font.glyphs.get(b);
      const kern = font.kerning[`${a}|${b}`] || 0;
      const gap = (ga.advance - ga.bbox.xMax) + gb.bbox.xMin + kern;
      assert.ok(gap >= 15, `${a}${b} serifs touch at contrast ${contrast} (gap ${gap.toFixed(0)})`);
    }
    // Inside the m, the serifs of neighbouring stems must leave a visible gap.
    const m = font.glyphs.get('m');
    const feet = m.contours
      .map((c) => ({ x0: Math.min(...c.map((p) => p.x)), x1: Math.max(...c.map((p) => p.x)), y1: Math.max(...c.map((p) => p.y)) }))
      .filter((c) => c.y1 < 120)
      .sort((p, q) => p.x0 - q.x0);
    assert.equal(feet.length, 3, 'm should have three foot serifs');
    for (let i = 1; i < feet.length; i++) assert.ok(feet[i].x0 - feet[i - 1].x1 > 60, 'serifs inside m are fusing');
  }
});

test('construction swaps the structure, not just the stroke', () => {
  const geo = generateFont(project({ construction: 'geometric' }));
  const hum = generateFont(project({ construction: 'humanist' }));
  const grot = generateFont(project({ construction: 'grotesque' }));
  // single-storey a: its skeleton is a bowl plus a full-height stem
  assert.notEqual(serializeSkeleton(skeletonFor('a', {}, 'geometric')), serializeSkeleton(skeletonFor('a', {}, 'grotesque')));
  const aTopRight = (f) => { const a = f.glyphs.get('a'); return Math.max(...a.contours.flat().filter((p) => p.x > a.bbox.xMax - 20).map((p) => p.y)); };
  assert.ok(aTopRight(geo) > aTopRight(grot) + 40, 'the single-storey a has a stem reaching the x-height');
  // binocular g reaches much further left under the baseline than the single-storey one
  const gHum = hum.glyphs.get('g').bbox, gGrot = grot.glyphs.get('g').bbox;
  assert.notDeepEqual([Math.round(gHum.yMin), Math.round(gHum.xMax - gHum.xMin)], [Math.round(gGrot.yMin), Math.round(gGrot.xMax - gGrot.xMin)]);
  // geometric rounds are wider than grotesque ones
  const w = (f) => f.glyphs.get('o').bbox.xMax - f.glyphs.get('o').bbox.xMin;
  assert.ok(w(geo) > w(grot) * 1.08, 'geometric o should be rounder');
});

test('aperture opens and closes terminals', () => {
  const tip = (font) => { const c = font.glyphs.get('c'); return c.bbox.xMax; };
  const closed = generateFont(project({ aperture: 0 }));
  const open = generateFont(project({ aperture: 100 }));
  const cTop = (font) => {
    // the height of the upper terminal's lowest point: higher = more open
    const g = font.glyphs.get('c');
    const right = g.contours.flat().filter((p) => p.x > g.bbox.xMax - 30);
    return Math.min(...right.filter((p) => p.y > 250).map((p) => p.y));
  };
  assert.ok(cTop(open) > cTop(closed) + 20, 'an open c should end higher up');
  assert.ok(Number.isFinite(tip(closed)) && Number.isFinite(tip(open)));
});

test('slant shears outlines and marks the export as italic', () => {
  const upright = generateFont(project({ slant: 0 }));
  const italic = generateFont(project({ slant: 12 }));
  const topX = (font) => { const l = font.glyphs.get('l'); return l.contours.flat().reduce((a, p) => (p.y > a.y ? p : a)).x - l.bbox.xMin; };
  assert.ok(topX(italic) > topX(upright) + 100, 'the top of l should lean right');
  const payload = buildExportPayload({ ...project({ slant: 12, weight: 45 }), name: 'Slanted' }, 'ttf');
  assert.equal(payload.italic, true);
  assert.equal(payload.styleName, 'Italic');
  assert.equal(payload.italicAngle, -12);
});

test('every preset generates a complete font', async () => {
  const { PRESETS } = await import('../shared/engine/presets.js');
  for (const [name, preset] of Object.entries(PRESETS)) {
    const font = generateFont({ params: preset.params, metrics: preset.metrics, skeletons: {} });
    for (const g of font.glyphs.values())
      for (const c of g.contours) for (const p of c) assert.ok(Number.isFinite(p.x) && Number.isFinite(p.y), `${name}/${g.name}`);
  }
});
