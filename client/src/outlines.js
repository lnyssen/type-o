// Outlines come from the server once per family + axes, then everything —
// typing, chain edits, rolling — happens in the browser on these polygons.

export const WORKING_SET =
  'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789' +
  ' .,:;!?&@#%*()[]{}/\\-–—‘’“”«»€$£+=<>' +
  'ÀÂÄÇÉÈÊËÎÏÔÖÙÛÜŸÆŒàâäçéèêëîïôöùûüÿæœñÑ';

const cache = new Map();
const key = (family, axes, italic, chars) => JSON.stringify([family, axes, !!italic, chars]);

export function outlinesFor(family, axes, { italic = false, extra = '' } = {}) {
  const chars = WORKING_SET + [...extra].filter((c) => !WORKING_SET.includes(c)).join('');
  const k = key(family, axes, italic, chars);
  if (!cache.has(k)) {
    cache.set(k, fetch('/api/outlines', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ family, axes, italic, chars, tolerance: 1.2 }),
    }).then(async (r) => {
      if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || `HTTP ${r.status}`);
      return r.json();
    }).catch((e) => { cache.delete(k); throw e; }));
  }
  return cache.get(k);
}

export const cached = (family, axes, italic = false, extra = '') =>
  cache.get(key(family, axes, italic, WORKING_SET + [...extra].filter((c) => !WORKING_SET.includes(c)).join('')));
