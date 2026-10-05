#!/usr/bin/env node
// Add a variable family from google/fonts, reading its axes out of the font
// itself rather than transcribing them by hand.
//
//   node scripts/add-family.mjs <ofl-dir> <genre> ["one line about it"]
//   node scripts/add-family.mjs --batch families.json
//
// Downloads the licence, the metadata and the variable files, builds the
// preview and the charset, then prints a catalogue entry ready to paste into
// shared/catalog.js.

import { existsSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const MASTERS = path.join(root, 'server', 'masters');
const BASE = 'https://raw.githubusercontent.com/google/fonts/main/ofl';
const python = ['server/.venv/bin/python', 'python3'].map((p) => path.join(root, p)).find(existsSync) || 'python3';

const run = (args) => {
  const r = spawnSync(python, args, { encoding: 'utf8', maxBuffer: 64 << 20 });
  if (r.status !== 0) throw new Error(r.stderr?.trim() || 'python failed');
  return r.stdout;
};

async function get(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return Buffer.from(await res.arrayBuffer());
}

const CHARSET = 'import sys,json\nfrom fontTools.ttLib import TTFont\nf=TTFont(sys.argv[1],lazy=True)\nprint(json.dumps({"codepoints":sorted(f.getBestCmap())}))';
const FVAR = `import sys, json
from fontTools.ttLib import TTFont
f = TTFont(sys.argv[1], lazy=True)
name = f["name"]
axes = []
if "fvar" in f:
    for a in f["fvar"].axes:
        axes.append({"tag": a.axisTag, "min": a.minValue, "default": a.defaultValue, "max": a.maxValue})
print(json.dumps({
    "family": name.getDebugName(16) or name.getDebugName(1),
    "copyright": name.getDebugName(0) or "",
    "designer": name.getDebugName(9) or "",
    "axes": axes,
    "glyphs": f["maxp"].numGlyphs,
}))`;

async function add(id, genre, blurb) {
  const dir = path.join(MASTERS, id);
  mkdirSync(dir, { recursive: true });

  for (const file of ['METADATA.pb', 'OFL.txt']) {
    const dest = path.join(dir, file);
    if (!existsSync(dest)) writeFileSync(dest, await get(`${BASE}/${id}/${file}`));
  }
  const meta = readFileSync(path.join(dir, 'METADATA.pb'), 'utf8');
  const names = [...meta.matchAll(/filename:\s*"([^"]+\.ttf)"/g)].map((m) => m[1]).filter((n) => n.includes('['));
  const roman = names.find((n) => !/-Italic\[/.test(n));
  const italic = names.find((n) => /-Italic\[/.test(n));
  if (!roman) throw new Error(`${id} has no variable file in its metadata`);

  for (const [role, file] of [['roman', roman], ['italic', italic]]) {
    if (!file) continue;
    const ttf = path.join(dir, `${role}.ttf`);
    if (!existsSync(ttf)) writeFileSync(ttf, await get(`${BASE}/${id}/${encodeURIComponent(file)}`));
    const woff2 = path.join(dir, `preview-${role}.woff2`);
    if (!existsSync(woff2)) run([path.join(root, 'server/python/preview_font.py'), ttf, woff2]);
  }
  const charset = path.join(dir, 'charset.json');
  if (!existsSync(charset)) writeFileSync(charset, run(['-c', CHARSET, path.join(dir, 'roman.ttf')]).trim());

  const info = JSON.parse(run(['-c', FVAR, path.join(dir, 'roman.ttf')]));
  const rfn = [...(readFileSync(path.join(dir, 'OFL.txt'), 'utf8').split('\n')[0] || '')
    .matchAll(/Reserved Font Names?\s*[“"'‘]([^”"'’]+)/g)].map((m) => m[1].trim());

  const credit = ((info.copyright.match(/Copyright\s*(?:\(c\)\s*)?(?:\d{4}(?:\s*[-–]\s*\d{4})?,?\s*)?(.+?)(?:\s*\(|\s*,\s|\.\s|$)/i)
    || [, info.designer])[1] || info.designer || `${info.family} Project Authors`)
    .replace(/^\d{4}(\s*[-–]\s*\d{4})?[,\s]*/, '').replace(/\s+/g, ' ').trim();

  const axes = info.axes.map((a) => {
    const nums = [a.min, a.default, a.max].map((v) => (Number.isInteger(v) ? v : Math.round(v * 100) / 100));
    return `axis('${a.tag}', ${nums.join(', ')})`;
  }).join(', ');

  return {
    id, glyphs: info.glyphs, tags: info.axes.map((a) => a.tag),
    entry: `  {
    id: '${id}', name: ${JSON.stringify(info.family)}, genre: '${genre}', italic: ${Boolean(italic)},${rfn.length ? `\n    rfn: ${JSON.stringify(rfn)},` : ''}
    credit: ${JSON.stringify(credit.replace(/\s+/g, ' ').trim())},
    blurb: ${JSON.stringify(blurb || '')},
    axes: [${axes}],
  },`,
  };
}

const args = process.argv.slice(2);
const jobs = args[0] === '--batch'
  ? JSON.parse(readFileSync(args[1], 'utf8'))
  : [{ id: args[0], genre: args[1], blurb: args[2] }];

const entries = [];
for (const job of jobs) {
  try {
    const got = await add(job.id, job.genre, job.blurb);
    entries.push(got.entry);
    console.error(`✓ ${job.id.padEnd(22)} ${got.glyphs} glyphs  ${got.tags.join(',')}`);
  } catch (e) {
    console.error(`✗ ${job.id.padEnd(22)} ${e.message}`);
  }
}
process.stdout.write(entries.join('\n') + '\n');
