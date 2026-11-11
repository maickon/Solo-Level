// Gerador de missões a partir de modelos: contratante (NPC) × destino × alvo × recompensa.
import { gvar } from './grammar.js';
import { loc, distancias } from './world.js';
import { rolarNpc, npcVar } from './npcs.js';

export const MAX_ATIVAS = 3;
export const OFERTAS_POR_DIA = 3;
export const OBJETIVOS = ['vencer', 'explorar', 'chegar'];

/** Ofertas do local atual (regeradas a cada dia). */
export function ofertas(g) {
  const s = g.s, o = s.ofertas[s.local];
  if (o && o.dia === s.dia) return o.lista;
  const lista = [];
  for (let i = 0; i < OFERTAS_POR_DIA * 2 && lista.length < OFERTAS_POR_DIA; i++) {
    const m = gerarMissao(g);
    if (m && !lista.some((x) => x.destino === m.destino && x.tpl === m.tpl)) lista.push(m);
  }
  s.ofertas[s.local] = { dia: s.dia, lista };
  return lista;
}

export function gerarMissao(g) {
  const s = g.s;
  const tpl = g.rng.weighted(g.c.quests);
  if (!tpl) return null;
  let cands = [...distancias(g, s.local)].filter(([, d]) => d >= 1 && d <= 4).map(([id, d]) => ({ l: loc(g, id), d }));
  if (tpl.objetivo === 'chegar') {
    const seguros = cands.filter((x) => x.l.tags?.includes('seguro'));
    if (seguros.length) cands = seguros;
  } else {
    cands = cands.filter((x) => !x.l.tags?.includes('seguro'));
    if (tpl.objetivo === 'vencer') cands = cands.filter((x) => g.c.biomes[x.l.bioma]?.inimigos?.length);
  }
  if (!cands.length) return null;
  const { l: dest, d } = g.rng.pick(cands);
  const alvo = tpl.objetivo === 'vencer' ? g.rng.pick(g.c.biomes[dest.bioma].inimigos) : null;
  // Contratante: reaproveita alguém conhecido do local com ofício compatível, ou rola um novo.
  const oficios = (tpl.oficios || []).filter((o) => g.c.npcs.oficios.some((x) => x.id === o));
  const pool = oficios.length ? oficios : g.c.npcs.oficios.map((o) => o.id);
  const conhecido = Object.values(s.npcs).find((n) => n.local === s.local && pool.includes(n.oficio) && n.disposicao > -2);
  const tier = Math.max(1, Math.ceil((g.c.biomes[dest.bioma]?.perigo || 1) / 1.5));
  const m = {
    uid: (s.uid = (s.uid || 0) + 1), tpl: tpl.id, objetivo: tpl.objetivo, origem: s.local, destino: dest.id,
    alvo, dist: d, tier, estado: 'oferta',
    ouro: Math.max(1, g.rng.roll(tpl.recompensa?.ouro || '2d6') + d * 3),
    xp: (tpl.recompensa?.xp || 2) + d,
    item: !!tpl.recompensa?.item,
    npcId: conhecido?.id || null,
    npc: conhecido ? null : rolarNpc(g, g.rng.pick(pool), s.local),
  };
  m.titulo = textoMissao(g, m, 'titulo');
  return m;
}

/** Prepara $npc, $destino e $alvo para os textos da missão. */
export function varsMissao(g, m) {
  const npc = m.npcId ? g.s.npcs[m.npcId] : m.npc;
  if (npc) g.vars.npc = npcVar(g, npc);
  const d = loc(g, m.destino);
  if (d) g.vars.destino = gvar(d.nome, d.genero);
  if (m.alvo) { const e = g.c.enemies[m.alvo]; g.vars.alvo = gvar(e.nome, e.genero); }
}

export function textoMissao(g, m, campo) {
  const tpl = g.c.quests.find((q) => q.id === m.tpl);
  varsMissao(g, m);
  const npc = contratante(g, m);
  g.npcCtx = npc ? { npc, novo: !(npc.encontros > 1) } : null;
  const t = g.text(tpl?.[campo] || '').trim();
  g.npcCtx = null;
  return t;
}

export const contratante = (g, m) => (m.npcId ? g.s.npcs[m.npcId] : m.npc);
