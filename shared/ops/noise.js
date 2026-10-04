// Seeded value noise. Same seed, same letter, same accident — every time.

import { hashString, rng } from '../engine/random.js';

const smooth = (t) => t * t * (3 - 2 * t);

export function noise2D(seed, wavelength) {
  const cache = new Map();
  const at = (i, j) => {
    const key = i * 65537 + j;
    if (!cache.has(key)) cache.set(key, rng(hashString(`${i}:${j}`, seed))() * 2 - 1);
    return cache.get(key);
  };
  return (x, y) => {
    const fx = x / wavelength, fy = y / wavelength;
    const i = Math.floor(fx), j = Math.floor(fy);
    const sx = smooth(fx - i), sy = smooth(fy - j);
    const a = at(i, j) * (1 - sx) + at(i + 1, j) * sx;
    const b = at(i, j + 1) * (1 - sx) + at(i + 1, j + 1) * sx;
    return a * (1 - sy) + b * sy;
  };
}

export { hashString, rng };
