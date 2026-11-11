// Avaliador de condições declarativas (`requer`). Todas as chaves precisam passar.
import { hasItemTag } from './hero.js';

const has = (arr, v) => Array.isArray(arr) && arr.includes(v);
const lista = (v) => (Array.isArray(v) ? v : [v]);
const estabsAqui = (s) => (s.estabs?.[s.local] || []).map((e) => e.id);

const CHECKS = {
  bioma: (v, s, c) => has(v, c.biome(s).id),
  local: (v, s) => has(v, s.local),
  local_tags: (v, s, c) => v.every((t) => c.location(s).tags?.includes(t)),
  sem_local_tags: (v, s, c) => !v.some((t) => c.location(s).tags?.includes(t)),
  periodo: (v, s) => has(v, s.periodo),
  clima: (v, s) => has(v, s.clima),
  item_tag: (v, s) => hasItemTag(s.heroi, v),
  sem_item_tag: (v, s) => !hasItemTag(s.heroi, v),
  ouro_min: (v, s) => s.heroi.ouro >= v,
  ferido: (v, s) => (s.heroi.hp <= s.heroi.hpMax / 2) === !!v,
  traco: (v, s) => s.heroi.tracos.includes(v),
  sem_traco: (v, s) => !s.heroi.tracos.includes(v),
  flag: (v, s) => !!s.flags[v],
  sem_flag: (v, s) => !s.flags[v],
  fio: (v, s) => s.fios.some((f) => f.id === v),
  sem_fio: (v, s) => !s.fios.some((f) => f.id === v),
  nivel_min: (v, s) => s.heroi.nivel >= v,
  perigo_min: (v, s, c) => (c.biome(s).perigo ?? 0) >= v,
  perigo_max: (v, s, c) => (c.biome(s).perigo ?? 0) <= v,
  // Estabelecimentos do povoado atual: basta um da lista existir (sem_estab: nenhum).
  estab: (v, s) => lista(v).some((id) => estabsAqui(s).includes(id)),
  sem_estab: (v, s) => !lista(v).some((id) => estabsAqui(s).includes(id)),
  npc_conhecido: (v, s) => !!s.evento?.npc && !s.evento.npcNovo === !!v,
  npc_disposicao_min: (v, s) => (s.npcs?.[s.evento?.npc]?.disposicao ?? -99) >= v,
  npc_disposicao_max: (v, s) => (s.npcs?.[s.evento?.npc]?.disposicao ?? 99) <= v,
};

export const CONDITION_KEYS = Object.keys(CHECKS);

/** c = content (com helpers biome(s)/location(s)). */
export function check(req, state, c) {
  if (!req) return true;
  for (const [k, v] of Object.entries(req)) {
    const fn = CHECKS[k];
    if (!fn) throw new Error(`Condição desconhecida: ${k}`);
    if (!fn(v, state, c)) return false;
  }
  return true;
}
