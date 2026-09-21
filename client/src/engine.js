// Bridge to the generation worker (latest request wins) plus the small
// synchronous helpers the skeleton editor needs on the main thread.

import { state, emit } from './state.js';
import { buildGlyph, contoursBounds } from '../../shared/engine/glyph.js';
import { skeletonFor, GLYPH_BY_NAME } from '../../shared/engine/font.js';
import { derive } from '../../shared/engine/params.js';
import { MARKS } from '../../shared/glyphs/latin.js';

const worker = new Worker(new URL('./worker.js', import.meta.url), { type: 'module' });

let nextId = 1;
let pendingId = null;
let queued = false;

worker.onmessage = ({ data }) => {
  if (data.id !== pendingId) return; // stale result
  pendingId = null;
  if (!data.ok) {
    state.generating = false;
    emit('font-error', data.error);
    return;
  }
  const byName = new Map(data.glyphs.map((g) => [g.name, g]));
  state.font = { ...data, byName };
  state.generating = false;
  state.lastGenerationMs = data.ms;
  emit('font', state.font);
  if (queued) { queued = false; regenerate(); }
};

export function regenerate() {
  if (pendingId !== null) { queued = true; return; }
  pendingId = nextId++;
  state.generating = true;
  emit('generating', true);
  worker.postMessage({ id: pendingId, project: JSON.parse(JSON.stringify(state.project)) });
}

// ---- main-thread helpers for the editor ----

export function editorKind(id) {
  if (id.startsWith('mark:')) return 'mark-lower';
  const meta = GLYPH_BY_NAME.get(id);
  return meta?.kind === 'space' ? 'punct' : meta?.kind || 'lower';
}

export function currentSkeleton(id = state.glyphId) {
  return skeletonFor(id, state.project.skeletons);
}

export function isEdited(id) {
  return Boolean(state.project.skeletons[id]);
}

// Outline of a single glyph, rebuilt synchronously while dragging nodes.
export function previewGlyph(id, skeleton) {
  const D = derive(state.project.params, state.project.metrics);
  const g = buildGlyph(id, skeleton, editorKind(id), D, { quality: 'preview' });
  return { ...g, bbox: contoursBounds(g.contours), D };
}

export const markModes = Object.fromEntries(Object.entries(MARKS).map(([k, v]) => [k, v[1]]));
