// End-to-end compilation test. Skipped automatically when the Python
// toolchain is not installed (`npm run setup:python`).

import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { buildExportPayload } from '../shared/engine/export.js';
import { compileFont, pythonStatus } from '../server/compile.js';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const status = await pythonStatus();
const skip = status.ok ? false : `Python toolchain unavailable (${status.error || 'not installed'})`;

const project = { name: 'Compile Test', params: { weight: 55, contrast: 40, serifMode: true }, metrics: {}, skeletons: {} };

test('compiles every format into a loadable font', { skip }, async () => {
  for (const format of ['ttf', 'otf', 'woff', 'woff2']) {
    const payload = buildExportPayload(project, format);
    const { data } = await compileFont(payload);
    assert.ok(data.length > 10000, `${format} looks too small (${data.length} bytes)`);
    const tag = data.subarray(0, 4).toString('binary');
    const expected = { ttf: '\0\0\0', otf: 'OTTO', woff: 'wOFF', woff2: 'wOF2' }[format];
    assert.equal(tag, expected, `${format} has the wrong signature`);
  }
});

test('rejects payloads it cannot build', { skip }, async () => {
  await assert.rejects(() => compileFont({ format: 'ttf', glyphs: [] }), /No glyphs|KeyError|error/i);
});

test('the compiled font carries the expected tables and features', { skip }, async () => {
  const payload = buildExportPayload(project, 'ttf');
  const { data } = await compileFont(payload);
  const text = data.toString('binary');
  for (const table of ['glyf', 'cmap', 'head', 'hhea', 'hmtx', 'maxp', 'name', 'post', 'OS/2', 'GPOS', 'GSUB']) {
    assert.ok(text.includes(table), `missing ${table} table`);
  }
  assert.ok(existsSync(path.join(root, 'server', 'python', 'build_font.py')));
});
