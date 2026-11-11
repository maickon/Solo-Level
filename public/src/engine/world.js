// Mundo dinâmico: locais fixos (conteúdo) + POIs descobertos (estado), conexões e distâncias.
import { cap, gvar } from './grammar.js';

export const MAX_POIS_POR_LOCAL = 3;
export const CHANCE_POI = 0.15;

export const loc = (g, id) => g.s.locais?.[id] || g.c.locations[id];

/** Conexões fixas + conexões criadas por POIs. */
export function conexoes(g, id) {
  return [...(loc(g, id)?.conexoes || []), ...(g.s.conexoesExtra?.[id] || [])];
}

export function marcarVisita(s, id) {
  if (!s.visitados.includes(id)) s.visitados.push(id);
}

/** Distância (em conexões) de `origem` até cada local alcançável. */
export function distancias(g, origem) {
  const dist = new Map([[origem, 0]]);
  const fila = [origem];
  while (fila.length) {
    const atual = fila.shift();
    for (const cx of conexoes(g, atual)) {
      if (!dist.has(cx.para) && loc(g, cx.para)) { dist.set(cx.para, dist.get(atual) + 1); fila.push(cx.para); }
    }
  }
  return dist;
}

/** Tenta descobrir um POI no local atual. Retorna o novo local ou null. */
export function descobrirPoi(g) {
  const s = g.s, atual = g.c.location(s);
  if (atual.gerado || atual.tags?.includes('seguro') || !g.c.pois.length) return null;
  const filhos = Object.values(s.locais).filter((l) => l.pai === atual.id);
  if (filhos.length >= MAX_POIS_POR_LOCAL || !g.rng.chance(CHANCE_POI)) return null;
  const usados = new Set(filhos.map((f) => f.modelo));
  const pool = g.c.pois.filter((p) => (!p.biomas || p.biomas.includes(atual.bioma)) && !usados.has(p.id));
  const tpl = g.rng.weighted(pool);
  if (!tpl) return null;
  // Testa 12 posições ao redor do pai e fica com a mais afastada de qualquer local existente.
  const clamp = (v) => Math.max(3, Math.min(97, Math.round(v)));
  const todos = [...Object.values(g.c.locations), ...Object.values(s.locais)].filter((l) => l.x != null);
  const base = g.rng.next() * Math.PI * 2;
  let melhor = null;
  for (let i = 0; i < 12; i++) {
    const a = base + (i * Math.PI) / 6, rr = 9 + g.rng.int(0, 5);
    const x = clamp((atual.x ?? 50) + Math.cos(a) * rr), y = clamp((atual.y ?? 50) + Math.sin(a) * rr);
    const folga = Math.min(...todos.map((l) => Math.hypot(l.x - x, (l.y - y) * 1.6))); // rótulos ficam abaixo: pesa o eixo y
    if (!melhor || folga > melhor.folga) melhor = { x, y, folga };
  }
  const id = `poi_${(s.uid = (s.uid || 0) + 1)}`;
  const novo = {
    id, nome: cap(g.label(tpl.nome)), genero: tpl.genero || 'm', bioma: atual.bioma,
    tags: [...(tpl.tags || []), 'poi'], conexoes: [{ para: atual.id, tempo: 1 }],
    x: melhor.x, y: melhor.y,
    gerado: true, pai: atual.id, modelo: tpl.id,
  };
  s.locais[id] = novo;
  (s.conexoesExtra[atual.id] ||= []).push({ para: id, tempo: 1 });
  g.vars.poi = gvar(novo.nome, novo.genero);
  return novo;
}
