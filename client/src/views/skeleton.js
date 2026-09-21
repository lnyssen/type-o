// Skeleton editor: a p5 canvas where nodes are dragged, inserted and drawn,
// with the resulting glyph rendered underneath in real time.

import { el, clear, toast, toggle } from '../ui.js';
import { state, on, commitSkeleton, undo, redo, setGlyph } from '../state.js';
import { currentSkeleton, previewGlyph, isEdited, editorKind } from '../engine.js';
import { editableGlyphs } from '../../../shared/engine/font.js';
import { cloneSkeleton, serializeSkeleton, parseSkeleton, validateSkeleton } from '../../../shared/engine/skeleton.js';
import { strokeToCubics } from '../../../shared/engine/spline.js';
import { yMapper } from '../../../shared/engine/glyph.js';
import { derive } from '../../../shared/engine/params.js';

const TOOLS = { move: 'Move', insert: 'Insert', pen: 'Pen', erase: 'Erase' };
const GRID = 10;

export function skeletonView() {
  const panel = el('div', { class: 'panel' });
  const stage = el('div', { class: 'stage' });
  const canvasHost = el('div');
  const toolbar = el('div', { class: 'editor-toolbar' });
  const info = el('p', { class: 'hint' });
  stage.append(el('div', { class: 'stage-pad' }, toolbar, canvasHost, info));

  const ui = { tool: 'move', snap: true, showOutline: true, selection: null, draft: null, hover: null };
  let sk = cloneSkeleton(currentSkeleton());
  let glyph = null;
  let sketch = null;

  const rebuild = () => { glyph = previewGlyph(state.glyphId, sk); sketch?.redraw(); };
  const commit = (label) => { commitSkeleton(state.glyphId, sk, { label }); rebuild(); renderPanel(); };
  const reload = () => { sk = cloneSkeleton(currentSkeleton()); ui.selection = null; ui.draft = null; rebuild(); renderPanel(); renderToolbar(); };

  // ---------- panel: glyph picker + node inspector + source ----------

  let query = '';
  function renderPanel() {
    clear(panel);
    const glyphs = editableGlyphs();
    const groups = new Map();
    for (const g of glyphs) {
      if (query && !(g.label.toLowerCase().includes(query.toLowerCase()) || g.id.toLowerCase().includes(query.toLowerCase()))) continue;
      if (!groups.has(g.group)) groups.set(g.group, []);
      groups.get(g.group).push(g);
    }

    const picker = el('div', { class: 'picker' });
    for (const [group, items] of groups) {
      picker.append(el('div', { class: 'picker-section' }, group));
      const grid = el('div', { class: 'picker-grid' });
      for (const g of items) {
        grid.append(el('button', {
          type: 'button',
          class: isEdited(g.id) ? 'edited' : '',
          'aria-selected': String(g.id === state.glyphId),
          title: `${g.id}${isEdited(g.id) ? ' (edited)' : ''}`,
          onclick: () => setGlyph(g.id),
        }, g.label.length > 3 ? g.label.slice(0, 3) : g.label));
      }
      picker.append(grid);
    }

    const source = el('textarea', { spellcheck: false, value: serializeSkeleton(sk), style: { fontFamily: 'ui-monospace, monospace', fontSize: '11px', minHeight: '110px' } });

    panel.append(
      el('h2', {}, 'Glyph'),
      el('input', { type: 'text', placeholder: 'Search glyphs…', value: query, oninput: (e) => { query = e.target.value; renderPanel(); } }),
      picker,
      el('div', { class: 'group' },
        el('h2', {}, 'Selection'),
        ui.selection ? nodeInspector() : el('p', { class: 'hint' }, 'Click a node to edit it. Drag to move, right-click to delete.'),
      ),
      el('div', { class: 'group' },
        el('h2', {}, 'Skeleton source'),
        source,
        el('div', { class: 'row' },
          el('button', {
            class: 'btn small', onclick: () => {
              try {
                const parsed = parseSkeleton(source.value);
                const errs = validateSkeleton(parsed, state.glyphId);
                if (errs.length) throw new Error(errs[0]);
                sk = parsed;
                ui.selection = null;
                commit('source');
              } catch (e) { toast(String(e.message || e), 'error'); }
            },
          }, 'Apply'),
          el('button', { class: 'btn small ghost', onclick: () => { commitSkeleton(state.glyphId, null); reload(); } }, 'Reset glyph'),
        ),
        el('p', { class: 'hint' }, '-- straight · .. curved · {deg} fixed direction · ^ corner · cycle closes'),
      ),
    );
  }

  function nodeInspector() {
    const { s, n } = ui.selection;
    const stroke = sk.strokes[s];
    const node = stroke?.nodes[n];
    if (!node) return el('p', { class: 'hint' }, 'Nothing selected.');
    const joinButton = (index, label) => {
      const join = stroke.joins[index];
      if (join === undefined) return null;
      return el('button', {
        class: 'btn small ghost',
        onclick: () => { stroke.joins[index] = join === 'line' ? 'curve' : 'line'; commit('join'); },
      }, `${label}: ${join === 'line' ? 'straight' : 'curved'}`);
    };
    return el('div', { class: 'group' },
      el('div', { class: 'row' },
        el('span', { class: 'badge' }, `stroke ${s + 1} · node ${n + 1}`),
        el('span', { class: 'badge' }, `${Math.round(node.x)}, ${Math.round(node.y)}`),
      ),
      el('div', { class: 'row', style: { flexWrap: 'wrap', gap: '6px' } },
        el('button', {
          class: 'btn small ghost',
          onclick: () => { node.corner = !node.corner; commit('corner'); },
        }, node.corner ? 'Corner' : 'Smooth'),
        joinButton(n - 1, 'In'),
        joinButton(n, 'Out'),
        el('button', {
          class: 'btn small ghost',
          onclick: () => { if (node.dir == null) node.dir = 0; else delete node.dir; commit('dir'); },
        }, node.dir == null ? 'Fix direction' : `Direction ${Math.round(node.dir)}°`),
        node.dir != null ? el('button', { class: 'btn small ghost', onclick: () => { node.dir = (node.dir + 15) % 360; commit('dir'); } }, '+15°') : null,
        el('button', { class: 'btn small ghost', onclick: () => deleteNode(s, n) }, 'Delete node'),
      ),
    );
  }

  // ---------- toolbar ----------

  function renderToolbar() {
    clear(toolbar);
    for (const [key, label] of Object.entries(TOOLS)) {
      toolbar.append(el('button', {
        class: `pill ${ui.tool === key ? '' : 'ghost'}`,
        'aria-selected': String(ui.tool === key),
        onclick: () => { ui.tool = key; ui.draft = null; renderToolbar(); sketch?.redraw(); },
      }, label));
    }
    toolbar.append(
      el('span', { class: 'grow' }),
      toggle({ label: 'Snap', checked: ui.snap, onChange: (v) => { ui.snap = v; } }),
      toggle({ label: 'Outline', checked: ui.showOutline, onChange: (v) => { ui.showOutline = v; sketch?.redraw(); } }),
      el('button', { class: 'btn small ghost', onclick: () => { if (undo()) reload(); } }, 'Undo'),
      el('button', { class: 'btn small ghost', onclick: () => { if (redo()) reload(); } }, 'Redo'),
    );
  }

  // ---------- skeleton operations ----------

  function deleteNode(s, n) {
    const stroke = sk.strokes[s];
    if (!stroke) return;
    if (stroke.nodes.length <= 1) sk.strokes.splice(s, 1);
    else {
      stroke.nodes.splice(n, 1);
      stroke.joins.splice(Math.min(n, stroke.joins.length - 1), 1);
    }
    ui.selection = null;
    commit('delete');
  }

  function insertOnSegment(pt) {
    let best = null;
    sk.strokes.forEach((stroke, si) => {
      const segCount = stroke.closed ? stroke.nodes.length : stroke.nodes.length - 1;
      for (let i = 0; i < segCount; i++) {
        const a = stroke.nodes[i], b = stroke.nodes[(i + 1) % stroke.nodes.length];
        const abx = b.x - a.x, aby = b.y - a.y;
        const len2 = abx * abx + aby * aby || 1;
        const t = Math.max(0, Math.min(1, ((pt.x - a.x) * abx + (pt.y - a.y) * aby) / len2));
        const px = a.x + abx * t, py = a.y + aby * t;
        const d = Math.hypot(pt.x - px, pt.y - py);
        if (!best || d < best.d) best = { d, si, i, x: px, y: py };
      }
    });
    if (!best || best.d > 90) return false;
    const stroke = sk.strokes[best.si];
    stroke.nodes.splice(best.i + 1, 0, { x: Math.round(best.x), y: Math.round(best.y) });
    stroke.joins.splice(best.i + 1, 0, stroke.joins[best.i]);
    ui.selection = { s: best.si, n: best.i + 1 };
    commit('insert');
    return true;
  }

  function penClick(pt, straight) {
    if (!ui.draft) {
      ui.draft = { nodes: [pt], joins: [], closed: false };
      sk.strokes.push(ui.draft);
    } else {
      const first = ui.draft.nodes[0];
      if (ui.draft.nodes.length > 1 && Math.hypot(pt.x - first.x, pt.y - first.y) < 25) {
        ui.draft.joins.push(straight ? 'line' : 'curve');
        ui.draft.closed = true;
        ui.draft = null;
        commit('stroke');
        return;
      }
      ui.draft.nodes.push(pt);
      ui.draft.joins.push(straight ? 'line' : 'curve');
    }
    rebuild();
  }

  function endDraft() {
    if (!ui.draft) return;
    if (ui.draft.nodes.length < 2) sk.strokes.pop();
    ui.draft = null;
    commit('stroke');
  }

  // ---------- p5 sketch ----------

  const sketchFn = (s) => {
    let view = { scale: 0.5, ox: 0, oy: 0 };
    let dragging = null;

    const toModel = (x, y) => ({ x: (x - view.ox) / view.scale, y: (view.oy - y) / view.scale });
    const toScreen = (x, y) => ({ x: view.ox + x * view.scale, y: view.oy - y * view.scale });
    const snap = (p) => (ui.snap ? { x: Math.round(p.x / GRID) * GRID, y: Math.round(p.y / GRID) * GRID } : { x: Math.round(p.x), y: Math.round(p.y) });

    const fit = () => {
      const D = derive(state.project.params, state.project.metrics);
      const mapY = yMapper(editorKind(state.glyphId), D.m);
      const top = Math.max(mapY(800), D.m.ascender) + 80;
      const bottom = Math.min(mapY(-260), D.m.descender) - 80;
      const w = s.width, h = s.height;
      view.scale = Math.min((h - 40) / (top - bottom), (w - 40) / 1100);
      view.ox = w / 2 - ((glyph?.bbox ? (glyph.bbox.xMin + glyph.bbox.xMax) / 2 : 250) * view.scale);
      view.oy = h / 2 + ((top + bottom) / 2) * view.scale;
      return { D, mapY, top, bottom };
    };

    s.setup = () => {
      const c = s.createCanvas(canvasHost.clientWidth || 800, Math.max(420, window.innerHeight - 260));
      c.canvas.className = 'editor-canvas';
      c.canvas.addEventListener('contextmenu', (e) => e.preventDefault());
      s.noLoop();
    };

    s.windowResized = () => {
      s.resizeCanvas(canvasHost.clientWidth || 800, Math.max(420, window.innerHeight - 260));
      s.redraw();
    };

    s.draw = () => {
      const { D, mapY } = fit();
      s.background(36, 36, 36);

      // grid
      if (view.scale > 0.15) {
        s.stroke(255, 255, 255, 12);
        s.strokeWeight(1);
        for (let x = -200; x <= 1200; x += 100) {
          const a = toScreen(x, 0);
          s.line(a.x, 0, a.x, s.height);
        }
      }

      // zone lines
      const kind = editorKind(state.glyphId);
      const zones = kind.startsWith('mark')
        ? [[0, 'baseline']]
        : [[0, 'baseline'], [D.m.xHeight, 'x-height'], [D.m.capHeight, 'cap'], [D.m.ascender, 'asc'], [D.m.descender, 'desc']];
      s.textSize(11);
      for (const [y, label] of zones) {
        const p = toScreen(0, y);
        s.stroke(125, 57, 235, label === 'baseline' ? 150 : 70);
        s.line(0, p.y, s.width, p.y);
        s.noStroke();
        s.fill(169, 123, 255, 170);
        s.text(label, 8, p.y - 5);
      }

      // filled glyph
      if (ui.showOutline && glyph) {
        s.noStroke();
        s.fill(244, 242, 237, 55);
        for (const c of glyph.contours) {
          s.beginShape();
          for (const pt of c) { const q = toScreen(pt.x, pt.y); s.vertex(q.x, q.y); }
          s.endShape(s.CLOSE);
        }
      }

      // skeleton
      for (const [si, stroke] of sk.strokes.entries()) {
        if (stroke.nodes.length > 1) {
          const { cubics } = strokeToCubics(mapped(stroke, D, mapY), D.tension);
          s.noFill();
          s.stroke(169, 123, 255, 220);
          s.strokeWeight(1.5);
          for (const bz of cubics) {
            const a = toScreen(bz[0].x, bz[0].y), c1 = toScreen(bz[1].x, bz[1].y), c2 = toScreen(bz[2].x, bz[2].y), b = toScreen(bz[3].x, bz[3].y);
            s.bezier(a.x, a.y, c1.x, c1.y, c2.x, c2.y, b.x, b.y);
          }
        }
        stroke.nodes.forEach((node, ni) => {
          const q = toScreen(...mapNode(node, D, mapY));
          const selected = ui.selection && ui.selection.s === si && ui.selection.n === ni;
          const hovered = ui.hover && ui.hover.s === si && ui.hover.n === ni;
          s.strokeWeight(selected || hovered ? 2 : 1.2);
          s.stroke(selected ? 255 : 169, selected ? 255 : 123, selected ? 255 : 255, 230);
          s.fill(selected ? 125 : 30, selected ? 57 : 30, selected ? 235 : 30);
          if (node.corner) s.rect(q.x - 4.5, q.y - 4.5, 9, 9);
          else s.circle(q.x, q.y, 9);
          if (node.dir != null) {
            const a = (-node.dir * Math.PI) / 180;
            s.stroke(125, 57, 235);
            s.line(q.x, q.y, q.x + Math.cos(a) * 22, q.y + Math.sin(a) * 22);
          }
        });
      }

      // draft hint
      if (ui.draft) {
        const last = ui.draft.nodes.at(-1);
        const q = toScreen(...mapNode(last, D, mapY));
        s.stroke(125, 57, 235, 180);
        s.strokeWeight(1);
        s.line(q.x, q.y, s.mouseX, s.mouseY);
      }
    };

    // Design coordinates are what we edit; the canvas shows metric space.
    const mapNode = (node, D, mapY) => [node.x * D.xScale, mapY(node.y)];
    const mapped = (stroke, D, mapY) => ({
      ...stroke,
      nodes: stroke.nodes.map((n) => ({ ...n, x: n.x * D.xScale, y: mapY(n.y) })),
    });
    const fromScreen = (x, y, D, mapY) => {
      const m = toModel(x, y);
      // invert the zone mapping numerically (monotonic, so a short search is fine)
      let lo = -400, hi = 1000;
      for (let i = 0; i < 40; i++) {
        const mid = (lo + hi) / 2;
        if (mapY(mid) < m.y) lo = mid; else hi = mid;
      }
      return { x: m.x / D.xScale, y: (lo + hi) / 2 };
    };

    const hitTest = (x, y, D, mapY) => {
      for (const [si, stroke] of sk.strokes.entries()) {
        for (const [ni, node] of stroke.nodes.entries()) {
          const q = toScreen(...mapNode(node, D, mapY));
          if (Math.hypot(q.x - x, q.y - y) < 10) return { s: si, n: ni };
        }
      }
      return null;
    };

    s.mouseMoved = () => {
      const { D, mapY } = fit();
      const hit = hitTest(s.mouseX, s.mouseY, D, mapY);
      const changed = JSON.stringify(hit) !== JSON.stringify(ui.hover);
      ui.hover = hit;
      if (changed || ui.draft) s.redraw();
    };

    s.mousePressed = (event) => {
      if (s.mouseX < 0 || s.mouseY < 0 || s.mouseX > s.width || s.mouseY > s.height) return;
      const { D, mapY } = fit();
      const hit = hitTest(s.mouseX, s.mouseY, D, mapY);
      const model = snap(fromScreen(s.mouseX, s.mouseY, D, mapY));

      if (event?.button === 2 || ui.tool === 'erase') {
        if (hit) deleteNode(hit.s, hit.n);
        return false;
      }
      if (ui.tool === 'pen') { penClick(model, event?.shiftKey); renderPanel(); return false; }
      if (ui.tool === 'insert') { if (!insertOnSegment(model)) toast('Click closer to a stroke to insert a node'); return false; }
      if (hit) {
        ui.selection = hit;
        if (event?.altKey) { sk.strokes[hit.s].nodes[hit.n].corner = !sk.strokes[hit.s].nodes[hit.n].corner; commit('corner'); }
        else { dragging = hit; renderPanel(); s.redraw(); }
      } else {
        ui.selection = null;
        renderPanel();
        s.redraw();
      }
      return false;
    };

    s.mouseDragged = () => {
      if (!dragging) return;
      const { D, mapY } = fit();
      const model = snap(fromScreen(s.mouseX, s.mouseY, D, mapY));
      const node = sk.strokes[dragging.s].nodes[dragging.n];
      node.x = model.x;
      node.y = model.y;
      rebuild();
      return false;
    };

    s.mouseReleased = () => {
      if (dragging) { dragging = null; commit('move'); }
    };

    s.doubleClicked = () => { endDraft(); renderPanel(); return false; };

    s.keyPressed = () => {
      if (!ui.selection) return;
      const node = sk.strokes[ui.selection.s]?.nodes[ui.selection.n];
      if (!node) return;
      const step = s.keyIsDown(s.SHIFT) ? 10 : 1;
      if (s.keyCode === s.LEFT_ARROW) node.x -= step;
      else if (s.keyCode === s.RIGHT_ARROW) node.x += step;
      else if (s.keyCode === s.UP_ARROW) node.y += step;
      else if (s.keyCode === s.DOWN_ARROW) node.y -= step;
      else if (s.keyCode === s.BACKSPACE || s.keyCode === s.DELETE) { deleteNode(ui.selection.s, ui.selection.n); return false; }
      else if (s.keyCode === s.ESCAPE) { endDraft(); ui.selection = null; renderPanel(); s.redraw(); return false; }
      else return;
      rebuild();
      return false;
    };
  };

  // ---------- wiring ----------

  renderToolbar();
  renderPanel();
  rebuild();
  // p5 is the heaviest dependency in the app: only the editor pulls it in.
  let disposed = false;
  import('p5').then(({ default: p5 }) => {
    if (disposed) return;
    sketch = new p5(sketchFn, canvasHost);
  }).catch(() => toast('Could not load the canvas library', 'error'));

  const offGlyph = on('glyph', () => { reload(); updateInfo(); });
  const offProject = on('project', (d) => {
    if (d.reason === 'params' || d.reason === 'metrics' || d.reason === 'load') { if (d.reason === 'load') reload(); else rebuild(); }
    updateInfo();
  });
  const offFont = on('font', updateInfo);

  function updateInfo() {
    const g = state.font?.byName.get(state.glyphId);
    info.textContent = g
      ? `${state.glyphId} — advance ${g.advance}u · left sidebearing ${g.lsb}u${isEdited(state.glyphId) ? ' · edited' : ''}`
      : `${state.glyphId}${isEdited(state.glyphId) ? ' — edited' : ''}`;
  }
  updateInfo();

  return {
    node: el('div', { class: 'layout wide' }, panel, stage),
    dispose: () => { disposed = true; offGlyph(); offProject(); offFont(); sketch?.remove(); },
  };
}
