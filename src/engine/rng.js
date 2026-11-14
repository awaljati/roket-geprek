// Angka acak dengan seed: semua tim battle mendapat kejadian acak yang sama.
export function makeRng(seed) {
  let a = typeof seed === 'string' ? [...seed].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7) : seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
