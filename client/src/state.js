// Application state: the project itself, the current view, and undo history
// for skeleton edits. Everything is autosaved to localStorage so a refresh
// never loses work.

import { newProject, serializeProject, parseProject } from '../../shared/engine/project.js';
import { cloneSkeleton } from '../../shared/engine/skeleton.js';

const STORAGE_KEY = 'gentype.project.v1';
const MAX_HISTORY = 80;

const listeners = new Map();

export const state = {
  project: newProject(),
  mode: 'parameters',
  glyphId: 'A',
  font: null,
  generating: false,
  lastGenerationMs: 0,
};

const history = { past: [], future: [] };

export function on(topic, fn) {
  if (!listeners.has(topic)) listeners.set(topic, new Set());
  listeners.get(topic).add(fn);
  return () => listeners.get(topic).delete(fn);
}

export function emit(topic, detail) {
  for (const fn of listeners.get(topic) || []) fn(detail);
  for (const fn of listeners.get('*') || []) fn(topic, detail);
}

let saveTimer = null;
function autosave() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try { localStorage.setItem(STORAGE_KEY, serializeProject(state.project)); } catch { /* private mode */ }
  }, 400);
}

export function restore() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return false;
    const { project } = parseProject(raw);
    state.project = project;
    return true;
  } catch {
    return false;
  }
}

export function setParam(key, value) {
  state.project.params[key] = value;
  autosave();
  emit('project', { reason: 'params', key });
}

export function setMetric(key, value) {
  state.project.metrics[key] = value;
  autosave();
  emit('project', { reason: 'metrics', key });
}

export function setKern(pair, value) {
  if (value === null || value === 0) delete state.project.metrics.kerning[pair];
  else state.project.metrics.kerning[pair] = value;
  autosave();
  emit('project', { reason: 'kerning', pair });
}

export function setAdvance(char, value) {
  if (value === null) delete state.project.metrics.advanceWidths[char];
  else state.project.metrics.advanceWidths[char] = value;
  autosave();
  emit('project', { reason: 'advance', char });
}

export function setName(name) {
  state.project.name = name;
  autosave();
  emit('project', { reason: 'name' });
}

export function setMode(mode) {
  state.mode = mode;
  emit('mode', mode);
}

export function setGlyph(id) {
  state.glyphId = id;
  emit('glyph', id);
}

// ---- skeleton editing with undo ----

function snapshot() {
  return JSON.stringify(state.project.skeletons);
}

export function commitSkeleton(id, skeleton, { label = 'edit' } = {}) {
  history.past.push(snapshot());
  if (history.past.length > MAX_HISTORY) history.past.shift();
  history.future.length = 0;
  if (skeleton === null) delete state.project.skeletons[id];
  else state.project.skeletons[id] = cloneSkeleton(skeleton);
  autosave();
  emit('project', { reason: 'skeleton', id, label });
}

export function undo() {
  if (!history.past.length) return false;
  history.future.push(snapshot());
  state.project.skeletons = JSON.parse(history.past.pop());
  autosave();
  emit('project', { reason: 'skeleton', id: state.glyphId, label: 'undo' });
  return true;
}

export function redo() {
  if (!history.future.length) return false;
  history.past.push(snapshot());
  state.project.skeletons = JSON.parse(history.future.pop());
  autosave();
  emit('project', { reason: 'skeleton', id: state.glyphId, label: 'redo' });
  return true;
}

export const canUndo = () => history.past.length > 0;
export const canRedo = () => history.future.length > 0;

export function loadProject(project) {
  state.project = project;
  history.past.length = 0;
  history.future.length = 0;
  autosave();
  emit('project', { reason: 'load' });
}

export function resetProject() {
  loadProject(newProject());
}
