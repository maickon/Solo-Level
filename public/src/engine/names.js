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

// Terminações que soam femininas/masculinas em nomes de fantasia lusófonos.
const SOA_F = /(a|ia|ie|ne|ra|is|ys|elle|ine)$/i;
const SOA_M = /[^a]$/i;

/**
 * Nome com gênero coerente. Usa `pessoas_m`/`pessoas_f` se o pacote tiver (≥ 8 nomes);
 * senão filtra os nomes gerados de `pessoas` pela terminação.
 */
export function nomePessoa(rng, names, genero = 'm') {
  const f = genero === 'f';
  const lista = names?.[f ? 'pessoas_f' : 'pessoas_m'];
  if (lista?.length >= 8) return markovName(rng, lista);
  const soa = f ? SOA_F : SOA_M;
  let nome = '';
  for (let i = 0; i < 25; i++) {
    nome = markovName(rng, names?.pessoas || []);
    if (soa.test(nome)) return nome;
  }
  const sementes = (names?.pessoas || []).filter((n) => soa.test(n));
  return sementes.length ? rng.pick(sementes) : nome;
}
