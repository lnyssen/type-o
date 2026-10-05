// .typeo project files: a plain JSON document holding everything needed to
// reproduce a font — parameters, metrics, and any hand-edited skeletons.

import { defaultParams, defaultMetrics, normalizeParams, normalizeMetrics } from './params.js';
import { validateSkeleton } from './skeleton.js';
import { skeletonFor } from './font.js';

export const FILE_VERSION = 1;
export const FILE_EXTENSION = '.typeo';

export function newProject(name = 'Untitled') {
  return {
    format: 'typeo',
    fileVersion: FILE_VERSION,
    name,
    version: '1.0',
    created: new Date().toISOString(),
    params: defaultParams(),
    metrics: defaultMetrics(),
    skeletons: {}, // only the glyphs the user actually edited
  };
}

export function serializeProject(project) {
  return JSON.stringify(
    {
      format: 'typeo',
      fileVersion: FILE_VERSION,
      name: project.name,
      version: project.version || '1.0',
      created: project.created || new Date().toISOString(),
      modified: new Date().toISOString(),
      params: normalizeParams(project.params),
      metrics: normalizeMetrics(project.metrics),
      skeletons: project.skeletons || {},
    },
    null,
    2,
  );
}

// Accepts a parsed object or a JSON string. Throws on anything unusable and
// silently drops individual skeletons that fail validation (reported in
// `warnings`).
export function parseProject(input) {
  const data = typeof input === 'string' ? JSON.parse(input) : input;
  if (!data || typeof data !== 'object') throw new Error('Not a TYPE-O project');
  if (data.format !== 'typeo') throw new Error('Not a TYPE-O project (missing format marker)');
  if (Number(data.fileVersion) > FILE_VERSION) throw new Error(`This file was made with a newer version of TYPE-O (v${data.fileVersion})`);

  const warnings = [];
  const skeletons = {};
  for (const [id, sk] of Object.entries(data.skeletons || {})) {
    let known = false;
    try {
      known = Boolean(skeletonFor(id.startsWith('mark:') ? id : id, {}));
    } catch {
      known = false;
    }
    if (!known) { warnings.push(`Unknown glyph "${id}" ignored`); continue; }
    const errs = validateSkeleton(sk, id);
    if (errs.length) { warnings.push(...errs); continue; }
    skeletons[id] = sk;
  }

  const project = {
    format: 'typeo',
    fileVersion: FILE_VERSION,
    name: typeof data.name === 'string' && data.name.trim() ? data.name.trim().slice(0, 64) : 'Untitled',
    version: /^\d+(\.\d+)?$/.test(String(data.version)) ? String(data.version) : '1.0',
    created: data.created || new Date().toISOString(),
    params: normalizeParams(data.params),
    metrics: normalizeMetrics(data.metrics),
    skeletons,
  };
  return { project, warnings };
}
