#!/usr/bin/env node
// Builds what Vercel serves statically: the interface, plus the preview fonts,
// licences and character sets each family needs. Only /api/export-font stays
// dynamic (a Python function — see api/export-font.py).

import { cpSync, mkdirSync, readdirSync, existsSync, rmSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { FAMILIES } from '../shared/catalog.js';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const MASTERS = path.join(root, 'server', 'masters');
const DIST = path.join(root, 'dist');
// Everything the browser fetches from /masters/<id>/ — never the .ttf masters,
// which are 18 MB and only the export function needs them.
const PUBLIC = ['preview-roman.woff2', 'preview-italic.woff2', 'OFL.txt', 'charset.json'];

const vite = spawnSync('npx', ['vite', 'build'], { cwd: root, stdio: 'inherit' });
if (vite.status !== 0) process.exit(vite.status ?? 1);

let copied = 0;
const missing = [];
for (const family of FAMILIES) {
  const from = path.join(MASTERS, family.id);
  if (!existsSync(path.join(from, 'roman.ttf'))) { missing.push(family.id); continue; }
  const to = path.join(DIST, 'masters', family.id);
  mkdirSync(to, { recursive: true });
  for (const file of PUBLIC) {
    if (existsSync(path.join(from, file))) { cpSync(path.join(from, file), path.join(to, file)); copied++; }
  }
}

if (missing.length) {
  console.error(`\n✗ Missing masters: ${missing.join(', ')}\n  Run \`npm run setup:masters\` before deploying.`);
  rmSync(DIST, { recursive: true, force: true });
  process.exit(1);
}

console.log(`\n✓ ${copied} master files copied into dist/masters/ (${readdirSync(path.join(DIST, 'masters')).length} families).`);
