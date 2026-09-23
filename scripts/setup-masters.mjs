#!/usr/bin/env node
// Downloads the variable masters GenType instantiates. The fonts themselves
// stay out of git (they are large, and upstream keeps them up to date); each
// server/masters/<id>/ already holds the METADATA.pb and OFL.txt that say what
// to fetch and under which licence.
//
//   node scripts/setup-masters.mjs [id…]   (no argument = every family)
//
// Everything downloaded is SIL Open Font License 1.1, from google/fonts.

import { readdirSync, readFileSync, existsSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const MASTERS = path.join(root, 'server', 'masters');
const BASE = 'https://raw.githubusercontent.com/google/fonts/main/ofl';
const python = ['server/.venv/bin/python', 'python3'].map((p) => path.join(root, p)).find(existsSync) || 'python3';

const wanted = new Set(process.argv.slice(2));
const ids = readdirSync(MASTERS).filter((id) => existsSync(path.join(MASTERS, id, 'METADATA.pb')) && (!wanted.size || wanted.has(id)));
if (!ids.length) { console.error('No such family in server/masters/'); process.exit(1); }

// METADATA.pb lists the variable files: the upright one, then the italic.
function filesOf(id) {
  const meta = readFileSync(path.join(MASTERS, id, 'METADATA.pb'), 'utf8');
  const names = [...meta.matchAll(/filename:\s*"([^"]+\.ttf)"/g)].map((m) => m[1]).filter((n) => n.includes('['));
  const italic = names.find((n) => /-Italic\[/.test(n));
  const roman = names.find((n) => !/-Italic\[/.test(n));
  return [['roman', roman], ['italic', italic]].filter(([, n]) => n);
}

async function download(url, dest) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  writeFileSync(dest, Buffer.from(await res.arrayBuffer()));
}

let failed = 0;
for (const id of ids) {
  for (const [role, file] of filesOf(id)) {
    const ttf = path.join(MASTERS, id, `${role}.ttf`);
    const woff2 = path.join(MASTERS, id, `preview-${role}.woff2`);
    try {
      if (existsSync(ttf) && existsSync(woff2)) { console.log(`· ${id}/${role} — already there`); continue; }
      if (!existsSync(ttf)) await download(`${BASE}/${id}/${encodeURIComponent(file)}`, ttf);
      const sub = spawnSync(python, [path.join(root, 'server/python/preview_font.py'), ttf, woff2], { encoding: 'utf8' });
      if (sub.status !== 0) throw new Error(sub.stderr?.trim() || 'preview_font.py failed — run npm run setup:python first');
      console.log(`✓ ${id}/${role}`);
    } catch (e) {
      failed++;
      console.error(`✗ ${id}/${role}: ${e.message}`);
    }
  }
}

console.log(failed ? `\n${failed} file(s) failed. Fix the errors above and run it again.` : '\nAll masters ready — SIL Open Font License 1.1, see each server/masters/<id>/OFL.txt.');
process.exit(failed ? 1 : 0);
