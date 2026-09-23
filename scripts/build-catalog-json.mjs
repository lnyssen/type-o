#!/usr/bin/env node
// The Vercel function is Python, so it cannot import shared/catalog.js. This
// writes the fields it needs — names, credits, reserved font names and the
// axis ranges it clamps to — into api/_catalog.json. Committed, and checked
// by test/vercel.test.mjs.

import { writeFileSync, readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { FAMILIES } from '../shared/catalog.js';

const out = path.join(path.dirname(path.dirname(fileURLToPath(import.meta.url))), 'api', '_catalog.json');

export const catalogJson = () => `${JSON.stringify(Object.fromEntries(FAMILIES.map((f) => [
  f.id, {
    name: f.name,
    credit: f.credit,
    italic: Boolean(f.italic),
    rfn: f.rfn || [],
    axes: Object.fromEntries(f.axes.map((a) => [a.tag, [a.min, a.default, a.max]])),
  },
])), null, 2)}\n`;

export const catalogIsCurrent = () => existsSync(out) && readFileSync(out, 'utf8') === catalogJson();

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  writeFileSync(out, catalogJson());
  console.log(`Wrote ${path.relative(process.cwd(), out)} — ${FAMILIES.length} families.`);
}
