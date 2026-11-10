// Gerador de nomes por cadeia de Markov (ordem 2) a partir de listas-semente.
const cache = new Map();

function model(list, order) {
  const key = list.join(',') + order;
  if (cache.has(key)) return cache.get(key);
  const m = new Map();
  for (const w of list) {
    const s = '^'.repeat(order) + w.toLowerCase() + '$';
    for (let i = 0; i + order < s.length; i++) {
      const k = s.slice(i, i + order);
      if (!m.has(k)) m.set(k, []);
      m.get(k).push(s[i + order]);
    }
  }
  cache.set(key, m);
  return m;
}

export function markovName(rng, list, { order = 2, min = 4, max = 10 } = {}) {
  if (!list?.length) return 'Sem-Nome';
  const m = model(list, order);
  const known = new Set(list.map((w) => w.toLowerCase()));
  for (let tries = 0; tries < 30; tries++) {
    let ctx = '^'.repeat(order), out = '';
    while (out.length <= max) {
      const next = rng.pick(m.get(ctx) || ['$']);
      if (next === '$') break;
      out += next;
      ctx = ctx.slice(1) + next;
    }
    if (out.length >= min && out.length <= max && !known.has(out)) {
      return out.charAt(0).toUpperCase() + out.slice(1);
    }
  }
  return rng.pick(list);
}
