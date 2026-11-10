// RNG determinístico (mulberry32). O estado vive em state.rng para reprodutibilidade.
export function hashSeed(str) {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return h >>> 0;
}

export class Rng {
  constructor(seed) { this.s = (typeof seed === 'number' ? seed : hashSeed(String(seed))) >>> 0; }
  next() {
    let t = (this.s = (this.s + 0x6d2b79f5) >>> 0);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  int(min, max) { return min + Math.floor(this.next() * (max - min + 1)); }
  chance(p) { return this.next() < p; }
  pick(arr) { return arr.length ? arr[Math.floor(this.next() * arr.length)] : undefined; }
  /** Escolha ponderada; peso via função ou campo `peso` (padrão 1). */
  weighted(arr, w = (x) => x?.peso ?? 1) {
    let total = 0;
    for (const x of arr) total += Math.max(0, w(x));
    if (total <= 0) return undefined;
    let r = this.next() * total;
    for (const x of arr) { r -= Math.max(0, w(x)); if (r < 0) return x; }
    return arr[arr.length - 1];
  }
  /** Rola notação "2d6+1", "1d4-1", "3" ou número. */
  roll(expr) {
    if (typeof expr === 'number') return expr;
    const m = String(expr).replace(/\s/g, '').match(/^(\d*)d(\d+)([+-]\d+)?$/i);
    if (!m) return parseInt(expr, 10) || 0;
    const n = parseInt(m[1] || '1', 10), f = parseInt(m[2], 10);
    let t = 0;
    for (let i = 0; i < n; i++) t += this.int(1, f);
    return t + (m[3] ? parseInt(m[3], 10) : 0);
  }
}
