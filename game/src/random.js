// A small seeded random number generator (mulberry32) so the city and the
// screenshot scenes are the same every run for a given seed.

export function makeRng(seed) {
  let a = seed >>> 0;
  return function next() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Integer in [min, max] from `rng`. */
export function int(rng, min, max) {
  return min + Math.floor(rng() * (max - min + 1));
}

/** Float in [min, max) from `rng`. */
export function range(rng, min, max) {
  return min + rng() * (max - min);
}

/** One element of `list`, from `rng`. */
export function pick(rng, list) {
  return list[Math.floor(rng() * list.length)];
}

/** Fisher-Yates shuffle of a copy of `list`, from `rng`. */
export function shuffle(rng, list) {
  const out = list.slice();
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = out[i];
    out[i] = out[j];
    out[j] = tmp;
  }
  return out;
}
