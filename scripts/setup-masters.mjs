#!/usr/bin/env node
// Downloads the variable masters TYPE-O instantiates. The fonts themselves
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

const CHARSET = 'import sys,json\nfrom fontTools.ttLib import TTFont\nf=TTFont(sys.argv[1],lazy=True)\nprint(json.dumps({"codepoints":sorted(f.getBestCmap())}))';

function run(args) {
  const r = spawnSync(python, args, { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });
  if (r.status !== 0) throw new Error(r.stderr?.trim() || 'Python failed — run npm run setup:python first');
  return r.stdout;
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
      const charset = path.join(MASTERS, id, 'charset.json');
      const done = existsSync(ttf) && existsSync(woff2) && (role === 'italic' || existsSync(charset));
      if (done) { console.log(`· ${id}/${role} — already there`); continue; }
      if (!existsSync(ttf)) await download(`${BASE}/${id}/${encodeURIComponent(file)}`, ttf);
      if (!existsSync(woff2)) run([path.join(root, 'server/python/preview_font.py'), ttf, woff2]);
      // The covered codepoints, so the glyph overview needs no server call.
      if (role === 'roman') writeFileSync(charset, run(['-c', CHARSET, ttf]).trim());
      console.log(`✓ ${id}/${role}`);
    } catch (e) {
      failed++;
      console.error(`✗ ${id}/${role}: ${e.message}`);
    }
  }
}

console.log(failed ? `\n${failed} file(s) failed. Fix the errors above and run it again.` : '\nAll masters ready — SIL Open Font License 1.1, see each server/masters/<id>/OFL.txt.');
process.exit(failed ? 1 : 0);
