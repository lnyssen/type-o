// .typeo projects (v3): a master family, its axis values, a few transforms
// and the operator chain applied to its outlines. Everything needed to
// reproduce the exact same font, down to the last accident.

import { FAMILY_BY_ID, FAMILIES, LOOKS, defaultAxes, normalizeAxes, nameProblem } from './catalog.js';
import { parseChain } from './ops/chain.js';

export const FILE_VERSION = 3;
export const FILE_EXTENSION = '.typeo';
export const FORMATS = ['ttf', 'otf', 'woff', 'woff2'];
export const CONTENT_TYPES = { ttf: 'font/ttf', otf: 'font/otf', woff: 'font/woff', woff2: 'font/woff2' };

export const TRANSFORMS = {
  tracking: { min: -80, max: 200, default: 0, label: 'Tracking', hint: 'Letter-spacing in thousandths of an em' },
  oblique: { min: 0, max: 14, default: 0, label: 'Oblique', hint: 'Slant the upright design (degrees)' },
};

const clamp = (v, lo, hi, d) => (Number.isFinite(+v) && v !== null && v !== '' ? Math.min(hi, Math.max(lo, +v)) : d);

export function projectFromLook(look, name = 'Untitled') {
  const family = FAMILY_BY_ID.get(look.family);
  return {
    format: 'typeo',
    fileVersion: FILE_VERSION,
    name,
    version: '1.000',
    family: family.id,
    look: look.name,
    axes: normalizeAxes(family, { ...defaultAxes(family), ...look.axes }),
    italic: false,
    oblique: 0,
    tracking: look.tracking ?? 0,
    chain: [],
    seed: 1,
    text: 'Rafale',
  };
}

export function newProject(name = 'Untitled') {
  return projectFromLook(LOOKS[0], name);
}

export function serializeProject(p) {
  const { project } = parseProject(p);
  return JSON.stringify({ ...project, modified: new Date().toISOString() }, null, 2);
}

// Accepts an object or JSON text; returns a clean project.
export function parseProject(input) {
  const data = typeof input === 'string' ? JSON.parse(input) : input;
  if (!data || data.format !== 'typeo') throw new Error('Not a TYPE-O project');
  if (Number(data.fileVersion) === 1) throw new Error('This project was made with the old skeleton engine and can’t be opened in this version.');
  if (Number(data.fileVersion) > FILE_VERSION) throw new Error('This file was made with a newer version of TYPE-O');
  const family = FAMILY_BY_ID.get(data.family) || FAMILIES[0];
  const warnings = [];
  if (data.family && !FAMILY_BY_ID.has(data.family)) warnings.push(`Unknown family “${data.family}”, using ${family.name}`);
  const project = {
    format: 'typeo',
    fileVersion: FILE_VERSION,
    name: typeof data.name === 'string' && data.name.trim() ? data.name.trim().slice(0, 40) : 'Untitled',
    version: /^\d+\.\d{1,3}$/.test(String(data.version)) ? String(data.version) : '1.000',
    family: family.id,
    look: typeof data.look === 'string' ? data.look : null,
    axes: normalizeAxes(family, data.axes),
    italic: Boolean(data.italic) && family.italic,
    oblique: clamp(data.oblique, TRANSFORMS.oblique.min, TRANSFORMS.oblique.max, 0),
    tracking: Math.round(clamp(data.tracking, TRANSFORMS.tracking.min, TRANSFORMS.tracking.max, 0)),
    chain: parseChain(data.chain),
    seed: Math.max(0, Math.round(clamp(data.seed, 0, 1e9, 1))),
    text: typeof data.text === 'string' && data.text.trim() ? data.text.slice(0, 60) : 'Rafale',
  };
  if (project.italic) project.oblique = 0;
  return { project, warnings };
}

const WEIGHT_NAMES = [[150, 'Thin'], [250, 'ExtraLight'], [350, 'Light'], [450, 'Regular'], [550, 'Medium'], [650, 'SemiBold'], [750, 'Bold'], [850, 'ExtraBold'], [Infinity, 'Black']];
const WIDTH_CLASSES = [[56, 1], [69, 2], [81, 3], [94, 4], [106, 5], [119, 6], [137, 7], [175, 8], [Infinity, 9]];
const WIDTH_NAMES = { 1: 'UltraCondensed', 2: 'ExtraCondensed', 3: 'Condensed', 4: 'SemiCondensed', 6: 'SemiExpanded', 7: 'Expanded', 8: 'ExtraExpanded', 9: 'UltraExpanded' };

export function styleOf(project) {
  const wght = project.axes.wght ?? 400;
  const weightName = WEIGHT_NAMES.find(([lim]) => wght < lim)[1];
  const weightClass = Math.min(900, Math.max(100, Math.round(wght / 100) * 100));
  const widthClass = project.axes.wdth != null ? WIDTH_CLASSES.find(([lim]) => project.axes.wdth < lim)[1] : 5;
  const italic = project.italic || project.oblique > 0;
  const parts = [WIDTH_NAMES[widthClass], weightName].filter(Boolean);
  let style = parts.filter((p) => p !== 'Regular' || parts.length === 1).join(' ');
  if (italic) style = style === 'Regular' ? 'Italic' : `${style} Italic`;
  return { styleName: style, weightClass, widthClass, italic };
}

// Everything the server needs to instantiate the master.
export function exportRequest(project, format) {
  if (!FORMATS.includes(format)) throw new Error(`Unsupported format “${format}”`);
  const family = FAMILY_BY_ID.get(project.family);
  const problem = nameProblem(family, project.name);
  if (problem) throw new Error(problem);
  const { styleName, weightClass, widthClass, italic } = styleOf(project);
  const clean = project.name.replace(/\s+/g, '');
  return {
    family: family.id,
    italic: project.italic,
    fileName: `${clean}-${styleName.replace(/\s+/g, '')}.${format}`,
    payload: {
      format,
      familyName: project.name,
      styleName,
      weightClass,
      widthClass,
      italic,
      version: project.version,
      axes: project.axes,
      oblique: project.italic ? 0 : project.oblique,
      tracking: project.tracking,
      note: `${project.name} is a Modified Version of ${family.name} (© ${family.credit}), generated with TYPE-O. Licensed under the SIL Open Font License 1.1.`,
    },
  };
}
