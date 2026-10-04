// App shell: mode switching, project save/load, shortcuts, status bar.

import { el, clear, toast } from './ui.js';
import { state, on, setMode, setName, restore, loadProject, family } from './state.js';
import { serializeProject, parseProject, FILE_EXTENSION } from '../../shared/project.js';
import { labView } from './views/lab.js';
import { exportView } from './views/export.js';

const MODES = [
  ['lab', 'Lab', labView],
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
  if (!mod) return;
  const key = e.key.toLowerCase();
  if (key === 's') { e.preventDefault(); saveProject(); }
  else if (key === 'o') { e.preventDefault(); fileInput.click(); }
  else if (key === 'e') { e.preventDefault(); setMode('export'); }
});

// ---- status bar ----

const statusGlyphs = document.getElementById('status-glyphs');
const statusTime = document.getElementById('status-time');
const statusPython = document.getElementById('status-python');

function showProject() {
  const fam = family();
  statusGlyphs.textContent = `${fam.name} · ${fam.genre}`;
  statusTime.textContent = state.project.look ? `look: ${state.project.look}` : 'custom';
  if (nameInput.value !== state.project.name) nameInput.value = state.project.name;
}

on('project', showProject);
on('mode', mount);

fetch('/api/health')
  .then((r) => r.json())
  .then((h) => {
    const missing = h.missingMasters?.length;
    if (missing) {
      statusPython.textContent = `${missing} master${missing > 1 ? 's' : ''} missing — run npm run setup:masters`;
      statusPython.style.color = 'var(--danger)';
    } else if (h.python?.ok) {
      statusPython.textContent = `compiler ready · fontTools ${h.python.fontTools}`;
      statusPython.style.color = '';
    } else {
      statusPython.textContent = 'compiler unavailable — run npm run setup:python';
      statusPython.style.color = 'var(--danger)';
    }
  })
  .catch(() => { statusPython.textContent = 'API offline — export disabled'; statusPython.style.color = 'var(--danger)'; });

// ---- boot ----

restore();
nameInput.value = state.project.name;
showProject();
mount(state.mode);
