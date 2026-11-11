// Gramática procedural 2.0: tags de contexto, fatos ditos na cena (diz/nao), referência a entidades
// (nome na 1ª menção, pronome depois), concordância de gênero e anti-repetição (entre cenas e de palavras).
// Sintaxe: {tabela} {tabela|cap} {tabela@var} {$var.campo} {=masc/fem@var} {#singular/plural@var}
const TOKEN = /\{([^{}]+)\}/g;
const MAX_DEPTH = 8;

export const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

/**
 * Variável de template com artigos e pronomes derivados do gênero.
 * extra.art = false para nomes próprios sem artigo (pessoas, "Lisboa").
 */
export function gvar(nome, genero = 'm', extra = {}) {
  const f = genero === 'f', art = extra.art ?? true, pl = !!extra.plural;
  const s = pl ? 's' : '';
  const o = (f ? 'a' : 'o') + s, um = pl ? (f ? 'umas' : 'uns') : f ? 'uma' : 'um';
  const d = { do: (f ? 'da' : 'do') + s, no: (f ? 'na' : 'no') + s, ao: f ? `à${s}` : `ao${s}` };
  const ele = (f ? 'ela' : 'ele') + s;
  return {
    nome, Nome: cap(nome), genero: f ? 'f' : 'm', art, plural: pl,
    o, O: cap(o), um, Um: cap(um), ...d,
    ele, Ele: cap(ele), dele: `d${ele}`, lo: o,
    // Nome já com artigo/preposição contraída: "a Vila de Bruma", "das Ruínas Antigas", "de Nesna".
    o_nome: art ? `${o} ${nome}` : nome,
    O_nome: art ? `${cap(o)} ${nome}` : cap(nome),
    do_nome: art ? `${d.do} ${nome}` : `de ${nome}`,
    no_nome: art ? `${d.no} ${nome}` : `em ${nome}`,
    ao_nome: art ? `${d.ao} ${nome}` : `a ${nome}`,
    um_nome: `${um} ${nome}`,
    ...extra,
  };
}

// ---------- Palavras: detecção de repetição ----------
const STOP = new Set(('você voce sobre entre ainda antes depois quando porque mesmo outro outra outros outras ' +
  'algum alguma alguns algumas nada tudo cada todo toda todos todas aqui onde enquanto sempre nunca apenas também ' +
  'tambem muito muita pouco pouca coisa coisas parece agora então entao isso isto aquilo dessa desse deste desta ' +
  'neste nesta nessa nesse seus suas mais menos ponto vezes').split(' '));
/** Radical simples: tira plural e vogal temática ("cansados" → "cansad", "guardá" → "guard"). */
export const radical = (w) => w.toLowerCase().replace(/s$/, '').replace(/[aeoáéóâêô]$/, '');
/** Radicais das palavras de conteúdo (5+ letras, fora da lista de palavras comuns) de um texto. */
export function radicais(texto) {
  const out = new Set();
  for (const w of String(texto).toLowerCase().replace(/\{[^{}]*\}/g, ' ').match(/[a-zà-ú]{5,}/g) || []) {
    if (!STOP.has(w)) out.add(radical(w));
  }
  return out;
}

/**
 * ctx = { rng, tables, vars, tags:Set, memory:{}, cena? }
 * memory é persistida no estado (evita repetir entre cenas).
 * cena = { ditos:Set, mencoes:Map, ultimo:{m,f}, usadas:Set } vive só durante a cena atual.
 */
export function expand(template, ctx, depth = 0) {
  if (template == null) return '';
  if (Array.isArray(template)) template = ctx.rng.pick(template);
  if (depth > MAX_DEPTH) return '';
  ctx.cena ||= novaCena();
  return String(template).replace(TOKEN, (_, raw) => resolveToken(raw.trim(), ctx, depth));
}

export const novaCena = () => ({ ditos: new Set(), mencoes: new Set(), ultimo: {}, usadas: new Set() });

function genderOf(ctx, varName) {
  return ctx.vars?.[varName]?.genero === 'f' ? 'f' : 'm';
}

const CAMPOS_NOME = new Set(['nome', 'Nome', 'o_nome', 'O_nome', 'do_nome', 'no_nome', 'ao_nome', 'um_nome']);

function resolveToken(raw, ctx, depth) {
  // {=masc/fem@var} — com variável no plural, a forma ganha "s" (ignorado → ignorados).
  if (raw.startsWith('=')) {
    const [forms, v] = raw.slice(1).split('@');
    const [m, f] = forms.split('/');
    const out = genderOf(ctx, v) === 'f' ? (f ?? m) : m;
    return ctx.vars?.[v]?.plural && !/s$/.test(out) ? `${out}s` : out;
  }
  // {#singular/plural@var} — concordância de número (verbos com lugar no plural como sujeito).
  if (raw.startsWith('#')) {
    const [forms, v] = raw.slice(1).split('@');
    const [sing, pl] = forms.split('/');
    return ctx.vars?.[v]?.plural ? (pl ?? sing) : sing;
  }
  // {$var.campo}
  if (raw.startsWith('$')) {
    const [v, campo = 'nome'] = raw.slice(1).split('.');
    const val = ctx.vars?.[v];
    if (!val) return '';
    if (campo === 'ref' || campo === 'Ref') return referencia(ctx, v, val, campo === 'Ref');
    if (CAMPOS_NOME.has(campo)) mencionar(ctx, v, val);
    const out = val[campo];
    if (out != null) for (const r of radicais(out)) ctx.cena.usadas.add(r);
    return out == null ? '' : String(out);
  }
  let name = raw, mod = null, gv = null;
  if (name.includes('|')) [name, mod] = name.split('|');
  if (name.includes('@')) [name, gv] = name.split('@');
  let out = pickEntry(name, ctx, gv ? genderOf(ctx, gv) : genderOf(ctx, 'heroi'));
  out = expand(out, ctx, depth + 1);
  for (const r of radicais(out)) ctx.cena.usadas.add(r);
  return mod === 'cap' ? cap(out) : out;
}

function mencionar(ctx, v, val) {
  ctx.cena.mencoes.add(v);
  ctx.cena.ultimo[val.genero] = v;
}

/** 1ª menção: nome (com artigo se comum); depois: pronome, se não houver ambiguidade de gênero. */
function referencia(ctx, v, val, maiuscula) {
  const c = ctx.cena;
  let out;
  if (c.mencoes.has(v) && c.ultimo[val.genero] === v) out = val.ele;
  else out = val.o_nome;
  mencionar(ctx, v, val);
  return maiuscula ? cap(out) : out;
}

function entryText(e, gender) {
  if (typeof e === 'string') return e;
  if (e.m || e.f) return gender === 'f' ? (e.f ?? e.m) : (e.m ?? e.f);
  return e.t ?? '';
}

/** Memória entre cenas: percorre boa parte da tabela antes de repetir. */
const memoriaMax = (len) => Math.max(0, Math.min(len - 1, Math.max(4, Math.ceil(len * 0.6))));

function pickEntry(name, ctx, gender) {
  const table = ctx.tables?.[name];
  if (!table || !table.length) return `[${name}]`; // visível para o validador
  const cena = ctx.cena;
  const fatos = new Set([...(ctx.tags || []), ...cena.ditos]);
  let idx = table.map((_, i) => i);
  // 1. Contradições: entradas que negam algo já dito ou presente no contexto saem.
  const coerentes = idx.filter((i) => !(table[i].nao || []).some((f) => fatos.has(f)));
  if (coerentes.length) idx = coerentes;
  // 2. Especificidade: entradas com todas as tags no contexto têm prioridade total.
  const tagged = idx.filter((i) => table[i].tags?.length && table[i].tags.every((t) => fatos.has(t)));
  const untagged = idx.filter((i) => !table[i].tags?.length);
  let pool = tagged.length ? tagged : untagged.length ? untagged : idx;
  // 3. Novidade entre cenas.
  const mem = ctx.memory ? (ctx.memory[name] ||= []) : [];
  const fresh = pool.filter((i) => !mem.includes(i));
  if (fresh.length) pool = fresh;
  // 4. Evita repetir palavras já usadas nesta cena ("cansado… olhos cansados").
  if (cena.usadas.size) {
    const limpas = pool.filter((i) => ![...radicais(entryText(table[i], gender))].some((r) => cena.usadas.has(r)));
    if (limpas.length) pool = limpas;
  }
  const choice = ctx.rng.weighted(pool, (i) => table[i].peso ?? 1);
  if (ctx.memory) {
    mem.push(choice);
    while (mem.length > memoriaMax(table.length)) mem.shift();
  }
  for (const f of table[choice].diz || []) cena.ditos.add(f);
  return entryText(table[choice], gender);
}

/** Acabamento: espaços, pontuação e maiúsculas depois de partes opcionais vazias. */
export function polir(t) {
  return String(t)
    .replace(/\s+/g, ' ').trim()
    .replace(/\s+([.,;:!?…])/g, '$1')
    .replace(/([^.])\.\.(?!\.)/g, '$1.')
    .replace(/,([.!?…])/g, '$1')
    .replace(/(^|[.!?…]["”»]?\s+)([a-zà-ú])/g, (_, a, b) => a + b.toUpperCase())
    .trim();
}

/** Lista tokens {tabela} de um template (usado pelo validador). */
export function tableRefs(template) {
  const refs = [];
  for (const m of String(template).matchAll(TOKEN)) {
    const raw = m[1].trim();
    if (raw.startsWith('$') || raw.startsWith('=') || raw.startsWith('#')) continue;
    refs.push(raw.split('|')[0].split('@')[0]);
  }
  return refs;
}

// " o encara", " o segue"… referindo-se ao herói (não precedido de "você", que indica outro objeto).
const VERBOS_HEROI = 'segue|seguem|encara|encaram|observa|observam|examina|examinam|leva|levam|derruba|derrubam|' +
  'mede|medem|acompanha|acompanham|cerca|cercam|chama|chamam|puxa|puxam|empurra|arrasta|ataca|atacam|morde|' +
  'fere|atinge|acerta|acertam|vê|veem|reconhece|reconhecem|cumprimenta|saúda|espera|esperam|ignora|ignoram|' +
  'agarra|prende|joga|lança|arremessa|acorda|guia|conduz|recebe|recebem|olha|olham|fita|fitam|estuda|avalia|' +
  'interrompe|segura|alcança|persegue|perseguem|deixa|derrubou|viu|seguiu|encarou|levou|chamou|reconheceu|' +
  'expulsa|importuna|rastreia|envolve|abraça|abençoa|dispensa|reconhecessem|cobra|protege';
const PRONOME_FIXO = new RegExp(`(?<![Vv]ocê) o (${VERBOS_HEROI})(?![a-zà-ú])`);

/** Avisos de estilo em templates: nomes de lugar sem artigo, pronome do herói fixo. */
const LUGARES = ['local', 'destino', 'poi'];
export function lintTemplate(tpl) {
  const avisos = [];
  const s = String(tpl);
  for (const m of s.matchAll(/\{\$(\w+)\.(nome|Nome)\}/g)) {
    if (!LUGARES.includes(m[1])) continue;
    const antes = s.slice(0, m.index);
    if (/\{\$\w+\.(o|O|do|no|ao|um)\}\s*$/.test(antes)) continue; // já tem artigo explícito
    avisos.push(`{$${m[1]}.${m[2]}} sem artigo; use {$${m[1]}.o_nome}, do_nome, no_nome ou ao_nome`);
  }
  const p = PRONOME_FIXO.exec(s);
  if (p) avisos.push(`pronome do herói fixo no masculino ("${p[0].trim()}"); use {$heroi.lo}`);
  return avisos;
}
