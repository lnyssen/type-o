// The Vercel deployment answers /api/export-font with Python instead of
// server/index.js. These two implementations must agree, so this compares
// them on the same projects — and checks the generated catalogue is current.

import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { FAMILIES, defaultAxes } from '../shared/catalog.js';
import { newProject, parseProject, exportRequest } from '../shared/project.js';
import { catalogIsCurrent } from '../scripts/build-catalog-json.mjs';
import { pythonBin } from '../server/compile.js';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const skip = existsSync(path.join(root, 'server/masters/inter/roman.ttf'))
  ? false : 'Masters not installed (npm run setup:masters)';

const CASES = [
  { family: 'inter', name: 'Rafale Display', axes: { wght: 620, opsz: 20 }, oblique: 8, tracking: -20 },
  { family: 'inter', name: 'Rafale', axes: { wght: 400, opsz: 14 }, italic: true },
  { family: 'archivo', name: 'Sud Ouest', axes: { wght: 800, wdth: 62 } },
  { family: 'robotoflex', name: 'Chantier 12', axes: { wght: 143, wdth: 151 }, tracking: 200 },
  { family: 'fraunces', name: 'Belle Époque', axes: { wght: 900, opsz: 144, SOFT: 40, WONK: 1 } },
  { family: 'caveat', name: 'Marges', axes: { wght: 700 }, oblique: 14, version: '2.500' },
  { family: 'jost', name: '', axes: { wght: 300 } },            // both sides fall back to “Untitled”
  { family: 'bitter', name: 'Ardoise', axes: { wght: 9999 } },  // both sides clamp to the axis maximum
];
const REFUSED = [
  { family: 'inter', name: 'Inter Sharp' },
  { family: 'sourcesans3', name: 'Source Neue' },
  { family: 'inter', name: 'Voilà! 2000' },
];

// Calls build() inside the serverless function without starting a server.
function python(cases) {
  const code = `
import importlib.util, json, sys
spec = importlib.util.spec_from_file_location("fn", ${JSON.stringify(path.join(root, 'api/export-font.py'))})
fn = importlib.util.module_from_spec(spec); spec.loader.exec_module(fn)
out = []
for case in json.load(sys.stdin):
    try:
        payload, filename, _ = fn.build(case)
        payload.pop("master")
        out.append({"ok": True, "filename": filename, "payload": payload})
    except fn.Refused as e:
        out.append({"ok": False, "error": str(e)})
print(json.dumps(out))`;
  const r = spawnSync(pythonBin(), ['-c', code], { input: JSON.stringify(cases), encoding: 'utf8', maxBuffer: 8 << 20 });
  if (r.status !== 0) throw new Error(r.stderr?.trim() || 'python failed');
  return JSON.parse(r.stdout);
}

test('api/_catalog.json is up to date with shared/catalog.js', () => {
  assert.ok(catalogIsCurrent(), 'run `node scripts/build-catalog-json.mjs` and commit the result');
});

test('the Python function builds the same payload as the Node server', { skip }, () => {
  const bodies = CASES.map((c) => ({ project: { format: 'typeo', fileVersion: 2, ...newProject(c.name), ...c }, format: 'ttf' }));
  const fromPython = python(bodies);
  bodies.forEach((body, i) => {
    const { project } = parseProject(body.project);
    const job = exportRequest(project, 'ttf');
    const got = fromPython[i];
    assert.ok(got.ok, `python refused ${project.name}: ${got.error}`);
    assert.equal(got.filename, job.fileName);
    for (const key of ['familyName', 'styleName', 'weightClass', 'widthClass', 'italic', 'version', 'oblique', 'tracking', 'note']) {
      assert.deepEqual(got.payload[key], job.payload[key], `${project.name}: ${key}`);
    }
    assert.deepEqual(got.payload.axes, job.payload.axes, `${project.name}: axes`);
  });
});

test('the Python function refuses what the Node server refuses', { skip }, () => {
  const bodies = REFUSED.map((c) => ({ project: { format: 'typeo', fileVersion: 2, ...newProject(c.name || 'X'), ...c, name: c.name }, format: 'ttf' }));
  const fromPython = python(bodies);
  bodies.forEach((body, i) => {
    assert.equal(fromPython[i].ok, false, `python accepted ${JSON.stringify(REFUSED[i])}`);
    assert.throws(() => exportRequest(parseProject({ ...body.project, name: REFUSED[i].name || 'Untitled' }).project, 'ttf'),
      undefined, `node accepted ${JSON.stringify(REFUSED[i])}`);
  });
});

test('every family in the catalogue is reachable by the function', { skip }, () => {
  const results = python(FAMILIES.map((f) => ({ project: { family: f.id, name: 'Test Face', axes: defaultAxes(f) }, format: 'woff2' })));
  results.forEach((r, i) => assert.ok(r.ok, `${FAMILIES[i].id}: ${r.error}`));
});
