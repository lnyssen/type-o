#!/usr/bin/env node
// The mark: a ring cut across the middle, the halves pushed apart. An O that
// slipped — what a typo is, and what the operators do to a letter.
//
// Built with the project's own polygon algebra rather than hand-written arcs:
// the booleans are already tested, and the result cannot have a wrong sweep.
//
//   node scripts/make-icon.mjs   → writes docs/mark.svg, prints both variants

import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { circle, rect, difference, intersect, union, translate } from '../shared/ops/clip.js';
import { pathData } from '../shared/ops/render.js';

const S = 32;
const R = 11.6;     // outer radius
const T = 4.4;      // ring thickness
const GAP = 2.0;    // the cut
const SHIFT = 2.7;  // how far each half slides

const c = S / 2;
const ring = difference([circle(c, c, R, 96)], [circle(c, c, R - T, 96)]);
const top = translate(intersect(ring, [rect(-S, c + GAP / 2, S * 2, S * 2)]), SHIFT, 0);
const bottom = translate(intersect(ring, [rect(-S, -S, S * 2, c - GAP / 2)]), -SHIFT, 0);
const d = pathData(union(top, bottom));

const mark = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${S} ${S}"><path fill="currentColor" d="${d}"/></svg>`;
const favicon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${S} ${S}"><rect width="${S}" height="${S}" rx="7" fill="#000"/><path fill="#fff" d="${d}"/></svg>`;

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
writeFileSync(path.join(root, 'docs/mark.svg'), favicon);
process.stdout.write(JSON.stringify({ mark, favicon }));
