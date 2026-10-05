// Application state: the project (a master family + axes + transforms) and
// the current view. Autosaved to localStorage.

import { newProject, serializeProject, parseProject, projectFromLook } from '../../shared/project.js';
import { FAMILY_BY_ID, defaultAxes, normalizeAxes } from '../../shared/catalog.js';

const STORAGE_KEY = 'typeo.project.v3';
const listeners = new Map();

export const state = {
  project: newProject(),
  mode: 'atelier',
};

export function on(topic, fn) {
  if (!listeners.has(topic)) listeners.set(topic, new Set());
  listeners.get(topic).add(fn);
  return () => listeners.get(topic).delete(fn);
}

export function emit(topic, detail) {
  for (const fn of listeners.get(topic) || []) fn(detail);
}

let saveTimer = null;
function changed(reason) {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try { localStorage.setItem(STORAGE_KEY, serializeProject(state.project)); } catch { /* private mode */ }
  }, 300);
  emit('project', { reason });
}

export function restore() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) state.project = parseProject(raw).project;
  } catch { /* keep the default */ }
}

export const family = () => FAMILY_BY_ID.get(state.project.family);

export function setFamily(id) {
  const f = FAMILY_BY_ID.get(id);
  if (!f || f.id === state.project.family) return;
  // Carry over what still makes sense (weight, width…), reset the rest.
  const carried = normalizeAxes(f, { ...defaultAxes(f), ...state.project.axes });
  Object.assign(state.project, { family: f.id, axes: carried, italic: state.project.italic && f.italic, look: null });
  changed('family');
}

export function setAxis(tag, value) {
  state.project.axes[tag] = value;
  state.project.look = null;
  changed('axes');
}

export function setTransform(key, value) {
  state.project[key] = value;
  if (key === 'italic' && value) state.project.oblique = 0;
  state.project.look = null;
  changed(key);
}

export function applyLook(look) {
  const { name, version, chain, seed, text } = state.project;
  state.project = { ...projectFromLook(look, name), version, chain, seed, text };
  changed('look');
}

export function setChain(chain) {
  state.project.chain = chain;
  changed('chain');
}

export function setSeed(seed) {
  state.project.seed = Math.max(0, Math.round(seed));
  changed('seed');
}

export function setText(text) {
  state.project.text = text;
  changed('text');
}

export function setName(name) {
  state.project.name = name;
  changed('name');
}

export function setMode(mode) {
  state.mode = mode;
  emit('mode', mode);
}

export function loadProject(project) {
  state.project = project;
  changed('load');
}
