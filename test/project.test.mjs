// The .typeo v3 format, the look presets and the export naming rules.

import test from 'node:test';
import assert from 'node:assert/strict';

import { FAMILIES, FAMILY_BY_ID, LOOKS, defaultAxes, normalizeAxes, nameProblem, variationSettings } from '../shared/catalog.js';
import { newProject, projectFromLook, serializeProject, parseProject, styleOf, exportRequest, FILE_VERSION } from '../shared/project.js';

test('every look points at a real family and stays inside its axes', () => {
  for (const look of LOOKS) {
    const f = FAMILY_BY_ID.get(look.family);
    assert.ok(f, `${look.name} refers to an unknown family “${look.family}”`);
    const p = projectFromLook(look, 'Test');
    for (const a of f.axes) assert.ok(p.axes[a.tag] >= a.min && p.axes[a.tag] <= a.max, `${look.name}/${a.tag} is out of range`);
    assert.match(variationSettings(p.axes), /^"\w{4}" /);
  }
  assert.equal(new Set(LOOKS.map((l) => l.name)).size, LOOKS.length, 'two looks share a name');
});

test('projects round-trip through .typeo', () => {
  const p = projectFromLook(LOOKS[3], 'Round Trip');
  const back = parseProject(serializeProject(p)).project;
  assert.deepEqual({ ...back }, { ...p });
  assert.equal(back.fileVersion, FILE_VERSION);
});

test('bad input is coerced instead of crashing', () => {
  const { project, warnings } = parseProject({ format: 'typeo', fileVersion: 2, name: '  ', family: 'nope', axes: { wght: 1e9, zzzz: 3 }, tracking: '900', oblique: -5 });
  assert.equal(project.name, 'Untitled');
  assert.equal(project.family, FAMILIES[0].id);
  assert.ok(warnings.length, 'an unknown family should warn');
  assert.deepEqual(Object.keys(project.axes).sort(), FAMILIES[0].axes.map((a) => a.tag).sort());
  assert.ok(project.tracking <= 200 && project.oblique === 0);
  assert.throws(() => parseProject({ format: 'typeo', fileVersion: 1 }), /skeleton engine/);
  assert.throws(() => parseProject({ format: 'nope' }), /Not a TYPE-O project/);
});

test('style names follow the weight and the width', () => {
  const inter = FAMILY_BY_ID.get('inter');
  const base = { ...newProject('X'), family: 'inter', axes: defaultAxes(inter) };
  assert.equal(styleOf({ ...base, axes: { wght: 400 } }).styleName, 'Regular');
  assert.equal(styleOf({ ...base, axes: { wght: 700 } }).styleName, 'Bold');
  assert.equal(styleOf({ ...base, axes: { wght: 400 }, oblique: 8 }).styleName, 'Italic');
  const archivo = FAMILY_BY_ID.get('archivo');
  const narrow = normalizeAxes(archivo, { wght: 800, wdth: 62 });
  assert.equal(styleOf({ ...base, family: 'archivo', axes: narrow }).styleName, 'ExtraCondensed ExtraBold');
});

test('exports refuse names that break the Open Font License', () => {
  const inter = FAMILY_BY_ID.get('inter');
  assert.ok(nameProblem(inter, 'Inter'), 'the original family name must be refused');
  assert.ok(nameProblem(FAMILY_BY_ID.get('sourcesans3'), 'Source Neue'), 'reserved font names must be refused');
  assert.ok(nameProblem(inter, ''), 'an empty name must be refused');
  assert.equal(nameProblem(inter, 'Rafale Display'), null);
  assert.throws(() => exportRequest({ ...newProject('Inter'), family: 'inter', axes: defaultAxes(inter) }, 'ttf'));
  assert.throws(() => exportRequest(newProject('Rafale'), 'eot'), /Unsupported format/);

  const job = exportRequest({ ...newProject('Rafale Display'), family: 'inter', axes: { wght: 700 }, italic: false, oblique: 0, tracking: 0 }, 'woff2');
  assert.equal(job.fileName, 'RafaleDisplay-Bold.woff2');
  assert.equal(job.payload.weightClass, 700);
  assert.match(job.payload.note, /Modified Version of Inter/);
  assert.match(job.payload.note, /SIL Open Font License/);
});
