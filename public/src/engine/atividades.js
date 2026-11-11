// Lugares internos e atividades (storylets): cada povoado sorteia, uma vez, seus estabelecimentos;
// o menu do lugar mostra algumas atividades válidas no contexto, sorteadas por relevância e novidade.
import { gvar } from './grammar.js';
import { check } from './conditions.js';

export const ATIVIDADES_POVOADO = 3;
export const ATIVIDADES_ERMO = 2;
export const MIN_ESTABS = 3;
export const RECARGA_PADRAO = 2; // dias até uma atividade feita poder voltar

/** Estabelecimentos do local atual (sorteados na primeira vez e guardados no estado). */
export function estabelecimentos(g, local = g.c.location(g.s)) {
  const s = g.s;
  if (!local || local.tags?.includes('poi')) return [];
  if (s.estabs[local.id]) return s.estabs[local.id];
  const tags = new Set(local.tags || []);
  const fixos = new Set(local.estabelecimentos || []);
  const cat = g.c.estabelecimentos.filter((e) => fixos.has(e.id) || (e.em || []).some((t) => tags.has(t)));
  if (!cat.length) { s.estabs[local.id] = []; return []; }
  const escolhidos = cat.filter((e) => fixos.has(e.id) || g.rng.chance(e.chance ?? 0.5));
  const resto = cat.filter((e) => !escolhidos.includes(e)).sort((a, b) => (b.chance ?? 0.5) - (a.chance ?? 0.5));
  while (escolhidos.length < Math.min(MIN_ESTABS, cat.length)) escolhidos.push(resto.shift());
  s.estabs[local.id] = escolhidos.map((e) => ({
    id: e.id, nome: e.nome ? g.label(e.nome) : e.rotulo, rotulo: e.rotulo || e.id, genero: e.genero || 'm',
    artigo: e.artigo ?? true,
  }));
  return s.estabs[local.id];
}

export const temEstab = (s, id) => (s.estabs?.[s.local] || []).some((e) => e.id === id);

/** Variável $estab para textos da atividade. */
export function varEstab(g, id) {
  const e = (g.s.estabs[g.s.local] || []).find((x) => x.id === id);
  return e ? gvar(e.nome, e.genero, { art: e.artigo, rotulo: e.rotulo }) : null;
}

/** Estabelecimento que dá contexto à atividade (o primeiro exigido que existe aqui). */
export function estabDaAtividade(s, ev) {
  const req = ev.requer?.estab;
  const lista = Array.isArray(req) ? req : req ? [req] : [];
  return lista.find((id) => temEstab(s, id)) || null;
}

/** Atividades oferecidas agora neste local (fixas durante o período). */
export function atividadesDoMomento(g) {
  const s = g.s, l = g.c.location(s);
  estabelecimentos(g, l);
  const chave = `${s.dia}-${s.periodo}`;
  const atual = s.atvOferta[s.local];
  if (atual && atual.chave === chave) return atual.ids.filter((id) => g.c.eventMap[id]);
  const povoado = (s.estabs[s.local] || []).length > 0;
  const n = povoado ? ATIVIDADES_POVOADO : ATIVIDADES_ERMO;
  const pool = g.c.events.filter((e) => e.tipo === 'atividade' && !emRecarga(s, e) && check(e.requer, s, g.c));
  const ids = [];
  while (ids.length < n && pool.length) {
    // Relevância: atividades mais específicas para o contexto pesam mais (salience).
    const ev = g.rng.weighted(pool, (e) => (e.peso ?? 1) * (1 + 0.5 * Object.keys(e.requer || {}).length));
    ids.push(ev.id);
    pool.splice(pool.indexOf(ev), 1);
  }
  s.atvOferta[s.local] = { chave, ids };
  return ids;
}

function emRecarga(s, ev) {
  const feita = s.atvFeitas[ev.id];
  return feita != null && s.dia - feita < (ev.recarga ?? RECARGA_PADRAO);
}

/** Marca a atividade como feita e a retira da oferta atual. */
export function concluirAtividade(s, id) {
  s.atvFeitas[id] = s.dia;
  const o = s.atvOferta[s.local];
  if (o) o.ids = o.ids.filter((x) => x !== id);
}
