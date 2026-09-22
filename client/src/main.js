// App shell: mode switching, project save/load, shortcuts, status bar.

import { el, clear, toast } from './ui.js';
import { state, on, emit, setMode, setName, restore, loadProject, undo, redo } from './state.js';
import { regenerate } from './engine.js';
import { serializeProject, parseProject, FILE_EXTENSION } from '../../shared/engine/project.js';
import { parametersView } from './views/parameters.js';
import { skeletonView } from './views/skeleton.js';
import { metricsView } from './views/metrics.js';
import { previewView } from './views/preview.js';
import { exportView } from './views/export.js';

const MODES = [
  ['parameters', 'Design', parametersView],
  ['skeleton', 'Skeleton', skeletonView],
  ['metrics', 'Metrics', metricsView],
  ['preview', 'Preview', previewView],
  ['export', 'Export', exportView],
];

const workspace = document.getElementById('workspace');
const nav = document.getElementById('modes');
const nameInput = document.getElementById('project-name');
const fileInput = document.getElementById('file-input');

let current = null;

function mount(mode) {
  current?.dispose?.();
  clear(workspace);
  const def = MODES.find(([id]) => id === mode) || MODES[0];
  current = def[2]();
  workspace.append(current.node);
  for (const btn of nav.children) btn.setAttribute('aria-selected', String(btn.dataset.mode === def[0]));
}

for (const [id, label] of MODES) {
  const btn = el('button', { class: 'pill', 'data-mode': id, onclick: () => setMode(id) }, label);
  nav.append(btn);
}

// ---- project i/o ----

function saveProject() {
  const blob = new Blob([serializeProject(state.project)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = el('a', { href: url, download: `${(state.project.name || 'Untitled').replace(/\s+/g, '-')}${FILE_EXTENSION}` });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 3000);
  toast('Project saved', 'ok');
}

async function openProject(file) {
  try {
    const { project, warnings } = parseProject(await file.text());
    loadProject(project);
    nameInput.value = project.name;
    regenerate();
    toast(`Opened “${project.name}”`, 'ok');
    for (const w of warnings.slice(0, 3)) toast(w, 'error');
  } catch (e) {
    toast(`Could not open that file: ${e.message}`, 'error');
  }
}

document.getElementById('btn-save').addEventListener('click', saveProject);
document.getElementById('btn-export').addEventListener('click', () => setMode('export'));
document.getElementById('btn-open').addEventListener('click', () => fileInput.click());
fileInput.addEventListener('change', () => { if (fileInput.files[0]) openProject(fileInput.files[0]); fileInput.value = ''; });
nameInput.addEventListener('input', () => setName(nameInput.value));

window.addEventListener('dragover', (e) => e.preventDefault());
window.addEventListener('drop', (e) => {
  e.preventDefault();
  const file = e.dataTransfer?.files?.[0];
  if (file) openProject(file);
});

window.addEventListener('keydown', (e) => {
  const mod = e.metaKey || e.ctrlKey;
  const typing = /^(INPUT|TEXTAREA)$/.test(document.activeElement?.tagName || '');
  if (mod && e.key.toLowerCase() === 's') { e.preventDefault(); saveProject(); }
  else if (mod && e.key.toLowerCase() === 'o') { e.preventDefault(); fileInput.click(); }
  else if (mod && e.key.toLowerCase() === 'e') { e.preventDefault(); setMode('export'); }
  else if (mod && e.key.toLowerCase() === 'z' && !e.shiftKey) { if (typing) return; e.preventDefault(); if (undo()) emit('project', { reason: 'skeleton', label: 'undo' }); }
  else if (mod && (e.key.toLowerCase() === 'y' || (e.key.toLowerCase() === 'z' && e.shiftKey))) { if (typing) return; e.preventDefault(); redo(); }
});

// ---- status bar ----

const statusGlyphs = document.getElementById('status-glyphs');
const statusTime = document.getElementById('status-time');
const statusPython = document.getElementById('status-python');

on('font', (font) => {
  statusGlyphs.textContent = `${font.glyphs.length} glyphs`;
  statusTime.textContent = `preview rebuilt in ${font.ms} ms`;
});
on('generating', () => { statusTime.textContent = 'generating…'; });
on('font-error', (message) => toast(`Generation failed: ${message}`, 'error'));
on('mode', mount);

// Regenerate whenever anything that changes outlines changes.
let pending = null;
on('project', (detail) => {
  if (detail.reason === 'name') return;
  clearTimeout(pending);
  pending = setTimeout(regenerate, 40);
});

fetch('/api/health')
  .then((r) => r.json())
  .then((h) => {
    statusPython.textContent = h.python?.ok ? `compiler ready · fontTools ${h.python.fontTools}` : 'compiler unavailable — run npm run setup:python';
    statusPython.style.color = h.python?.ok ? '' : 'var(--danger)';
  })
  .catch(() => { statusPython.textContent = 'API offline — export disabled'; statusPython.style.color = 'var(--danger)'; });

// ---- boot ----

restore();
nameInput.value = state.project.name;
mount(state.mode);
regenerate();
