// Instantiates the real masters, end to end. Skipped when the Python
// toolchain (`npm run setup:python`) or the masters (`npm run setup:masters`)
// are not installed.

import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { FAMILIES, defaultAxes } from '../shared/catalog.js';
import { exportRequest, newProject, parseProject } from '../shared/project.js';
import { runPython, pythonStatus } from '../server/compile.js';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const master = (id, file) => path.join(root, 'server', 'masters', id, file);
const script = path.join(root, 'server', 'python', 'instance_font.py');

const status = await pythonStatus();
const skip = !status.ok ? `Python toolchain unavailable (${status.error || 'not installed'})`
  : !existsSync(master('inter', 'roman.ttf')) ? 'Masters not installed (npm run setup:masters)'
  : false;

const SIGNATURES = { ttf: '\0\u0001\0\0', otf: 'OTTO', woff: 'wOFF', woff2: 'wOF2' };

function project(over = {}) {
  return parseProject({ ...newProject('Test Face'), family: 'inter', axes: { wght: 620, opsz: 20 }, ...over }).project;
}

test('every format compiles into a loadable font', { skip }, async () => {
  for (const format of Object.keys(SIGNATURES)) {
    const job = exportRequest(project(), format);
    const { data } = await runPython(script, [], JSON.stringify({ ...job.payload, master: master(job.family, 'roman.ttf') }));
    assert.ok(data.length > 20000, `${format} looks too small (${data.length} bytes)`);
    assert.equal(data.subarray(0, 4).toString('binary'), SIGNATURES[format], `${format} has the wrong signature`);
  }
});

test('the instance is static, renamed and keeps its licence', { skip }, async () => {
  const job = exportRequest(project({ oblique: 8, tracking: 40 }), 'ttf');
  const { data, info } = await runPython(script, [], JSON.stringify({ ...job.payload, master: master(job.family, 'roman.ttf') }));
  assert.ok(data.length > 20000);
  assert.equal(info.variable, false, 'the fvar table should be gone');
  assert.equal(info.familyName, 'Test Face');
  assert.match(info.styleName, /SemiBold/);
  assert.ok(info.italicAngle < 0, 'oblique should tilt the outlines');
});

test('the catalogue and the masters agree', () => {
  for (const f of FAMILIES) {
    assert.ok(f.axes.length, `${f.id} has no axes`);
    for (const a of f.axes) assert.ok(a.min <= a.default && a.default <= a.max, `${f.id}/${a.tag} default is out of range`);
    assert.ok(existsSync(path.join(root, 'server', 'masters', f.id, 'OFL.txt')), `${f.id} is missing its OFL.txt`);
    const axes = defaultAxes(f);
    assert.deepEqual(Object.keys(axes).sort(), f.axes.map((a) => a.tag).sort());
    if (f.italic) assert.ok(skip || existsSync(master(f.id, 'italic.ttf')), `${f.id} claims an italic it does not have`);
  }
});
