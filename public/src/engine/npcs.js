// NPCs recorrentes: gerados, moram num local, lembram do herói (disposição −5..5).
import { gvar } from './grammar.js';
import { markovName } from './names.js';

export const CHANCE_REENCONTRO = 0.7;

/** Gera dados de um NPC sem registrá-lo no estado. */
export function rolarNpc(g, oficioId, local = g.s.local) {
  const temp = g.rng.pick(g.c.npcs.temperamentos);
  return {
    nome: markovName(g.rng, g.c.names.pessoas), genero: g.rng.chance(0.5) ? 'f' : 'm',
    oficio: oficioId, temperamento: temp?.id || null, local, disposicao: 0, encontros: 0, desde: g.s.dia,
  };
}

export function registrarNpc(g, dados) {
  const id = `npc_${(g.s.uid = (g.s.uid || 0) + 1)}`;
  g.s.npcs[id] = { id, ...dados };
  return g.s.npcs[id];
}

/** Vincula um NPC a um evento: reencontro (mesmo local e ofício) ou um novo. */
export function vincularNpc(g, spec = {}) {
  const s = g.s;
  const todos = g.c.npcs.oficios.map((o) => o.id);
  const oficios = spec.oficios?.length ? spec.oficios.filter((o) => todos.includes(o)) : todos;
  const conhecidos = Object.values(s.npcs).filter((n) => n.local === s.local && oficios.includes(n.oficio));
  let npc, novo = false;
  if (conhecidos.length && g.rng.chance(CHANCE_REENCONTRO)) npc = g.rng.pick(conhecidos);
  else { npc = registrarNpc(g, rolarNpc(g, g.rng.pick(oficios.length ? oficios : todos))); novo = true; }
  npc.encontros++;
  npc.visto = s.dia;
  return { npc, novo };
}

export function npcVar(g, npc) {
  const f = npc.genero === 'f';
  const of = g.c.npcs.oficios.find((o) => o.id === npc.oficio);
  const t = g.c.npcs.temperamentos.find((x) => x.id === npc.temperamento);
  return gvar(npc.nome, npc.genero, { oficio: of ? (f ? of.f : of.m) : '', temperamento: t ? (f ? t.f : t.m) : '' });
}

export function mudarDisposicao(g, npc, n) {
  if (!npc || !n) return;
  const antes = npc.disposicao;
  npc.disposicao = Math.max(-5, Math.min(5, npc.disposicao + n));
  if (npc.disposicao !== antes) g.note(`${npc.nome}: ${n > 0 ? '+' : '−'}${Math.abs(n)} confiança`, n > 0 ? 'cura' : 'dano');
}

export function rotuloDisposicao(d) {
  return d >= 4 ? 'leal' : d >= 2 ? 'amigável' : d <= -4 ? 'inimigo' : d <= -2 ? 'hostil' : 'neutro';
}
