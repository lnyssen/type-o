// Deterministic randomness: same seed + same glyph = same wobble, everywhere.

export function hashString(str, seed = 0) {
  let h = (0x811c9dc5 ^ seed) >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h;
}

export function rng(seed) {
  let a = seed >>> 0;
  return function mulberry32() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Smooth 1D value noise in [-1, 1], period `wavelength` along its input.
export function noise1D(seed, wavelength) {
  const cache = new Map();
  const at = (i) => {
    if (!cache.has(i)) cache.set(i, rng(hashString(String(i), seed))() * 2 - 1);
    return cache.get(i);
  };
  return (x) => {
    const f = x / wavelength, i = Math.floor(f), t = f - i;
    const s = t * t * (3 - 2 * t);
    return at(i) * (1 - s) + at(i + 1) * s;
  };
}
