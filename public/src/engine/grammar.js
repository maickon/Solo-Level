// Gramática procedural com tags de contexto, concordância de gênero e anti-repetição.
// Sintaxe: {tabela} {tabela|cap} {tabela@var} {$var.campo} {=masc/fem@var}
const TOKEN = /\{([^{}]+)\}/g;
const MAX_DEPTH = 8;
const MEMORY = 4; // quantas escolhas recentes evitar por tabela

export const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

/** Cria uma variável de template com artigos derivados do gênero. */
export function gvar(nome, genero = 'm', extra = {}) {
  const f = genero === 'f';
  return {
    nome, Nome: cap(nome), genero: f ? 'f' : 'm',
    o: f ? 'a' : 'o', O: f ? 'A' : 'O', um: f ? 'uma' : 'um',
    do: f ? 'da' : 'do', no: f ? 'na' : 'no', ao: f ? 'à' : 'ao',
    ...extra,
  };
}

/**
 * ctx = { rng, tables, vars, tags:Set, memory:{} }
 * memory é persistido no estado do jogo para evitar repetição entre cenas.
 */
export function expand(template, ctx, depth = 0) {
  if (template == null) return '';
  if (Array.isArray(template)) template = ctx.rng.pick(template);
  if (depth > MAX_DEPTH) return '';
  return String(template).replace(TOKEN, (_, raw) => resolveToken(raw.trim(), ctx, depth));
}

function genderOf(ctx, varName) {
  return ctx.vars?.[varName]?.genero === 'f' ? 'f' : 'm';
}

function resolveToken(raw, ctx, depth) {
  // {=masc/fem@var}
  if (raw.startsWith('=')) {
    const [forms, v] = raw.slice(1).split('@');
    const [m, f] = forms.split('/');
    return genderOf(ctx, v) === 'f' ? (f ?? m) : m;
  }
  // {$var.campo}
  if (raw.startsWith('$')) {
    const [v, campo = 'nome'] = raw.slice(1).split('.');
    const val = ctx.vars?.[v]?.[campo];
    return val == null ? '' : String(val);
  }
  let name = raw, mod = null, gv = null;
  if (name.includes('|')) [name, mod] = name.split('|');
  if (name.includes('@')) [name, gv] = name.split('@');
  let out = pickEntry(name, ctx, gv ? genderOf(ctx, gv) : genderOf(ctx, 'heroi'));
  out = expand(out, ctx, depth + 1);
  return mod === 'cap' ? cap(out) : out;
}

function entryText(e, gender) {
  if (typeof e === 'string') return e;
  if (e.m || e.f) return gender === 'f' ? (e.f ?? e.m) : (e.m ?? e.f);
  return e.t ?? '';
}

function pickEntry(name, ctx, gender) {
  const table = ctx.tables?.[name];
  if (!table || !table.length) return `[${name}]`; // visível para o validador
  const tags = ctx.tags || new Set();
  const idx = table.map((_, i) => i);
  const tagged = idx.filter((i) => table[i].tags?.length && table[i].tags.every((t) => tags.has(t)));
  const untagged = idx.filter((i) => !table[i].tags?.length);
  // Entradas com tags compatíveis são mais específicas e têm prioridade total.
  let pool = tagged.length ? tagged : untagged;
  if (!pool.length) pool = idx;
  const mem = ctx.memory ? (ctx.memory[name] ||= []) : [];
  const fresh = pool.filter((i) => !mem.includes(i));
  const choice = ctx.rng.weighted(fresh.length ? fresh : pool, (i) => table[i].peso ?? 1);
  if (ctx.memory) {
    mem.push(choice);
    while (mem.length > Math.min(MEMORY, table.length - 1)) mem.shift();
  }
  return entryText(table[choice], gender);
}

/** Lista tokens {tabela} de um template (usado pelo validador). */
export function tableRefs(template) {
  const refs = [];
  for (const m of String(template).matchAll(TOKEN)) {
    const raw = m[1].trim();
    if (raw.startsWith('$') || raw.startsWith('=')) continue;
    refs.push(raw.split('|')[0].split('@')[0]);
  }
  return refs;
}
