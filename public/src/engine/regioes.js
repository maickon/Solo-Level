// Mundo infinito: regiões geradas a partir de modelos (regioes.json) quando o herói desbrava uma fronteira.
// Coerência de vizinhança: cada modelo diz de quais biomas pode nascer (`de`), então não há saltos absurdos
// (uma ilha nasce da costa, uma cidade anã da montanha). Outros planos só se abrem por portais (efeito `portal`).
import { cap, gvar } from './grammar.js';
import { loc, conexoes } from './world.js';

export const TEMPO_DESBRAVAR = 2;
export const CHANCE_MASMORRA = 0.06; // ao explorar um local que ainda não tem masmorra

/** Saídas de fronteira ainda não exploradas de um local. */
export const fronteirasLivres = (g, l) => Math.max(0, (l?.fronteira || 0) - (g.s.fronteirasUsadas[l?.id] || 0));

/** Modelos de região que podem nascer a partir do local `origem`. */
export function modelosPara(g, origem, { plano = false, masmorra = false } = {}) {
  const usados = new Set(Object.values(g.s.regioes).map((r) => r.modelo));
  return g.c.regioes.filter((m) => !!m.plano === plano && (m.tipo === 'masmorra') === masmorra
    && !(m.unico && usados.has(m.id))
    && (plano || !m.de || m.de.includes('*') || m.de.includes(origem.bioma) || (origem.tags || []).some((t) => m.de.includes(t)))
    && (!m.nivel_min || g.s.heroi.nivel >= m.nivel_min));
}

/** Centro do mundo conhecido (para "empurrar" regiões novas para fora). */
function centro(g) {
  const ls = [...Object.values(g.c.locations), ...Object.values(g.s.locais)].filter((l) => l.x != null);
  return { x: ls.reduce((a, l) => a + l.x, 0) / ls.length, y: ls.reduce((a, l) => a + l.y, 0) / ls.length, ls };
}

/** Escolhe a posição mais livre perto de (x,y), no semiplano da direção `ang`. */
function posicaoLivre(g, todos, x, y, ang, raio) {
  let melhor = null;
  for (let i = 0; i < 10; i++) {
    const a = ang + (g.rng.next() - 0.5) * 1.6, r = raio * (0.8 + g.rng.next() * 0.5);
    const px = Math.round(x + Math.cos(a) * r), py = Math.round(y + Math.sin(a) * r);
    const folga = Math.min(...todos.map((l) => Math.hypot(l.x - px, (l.y - py) * 1.4)));
    if (!melhor || folga > melhor.folga) melhor = { x: px, y: py, folga };
  }
  return melhor;
}

/**
 * Gera uma região a partir de `origem`. Retorna o local de entrada.
 * Masmorras (`tipo: "masmorra"`) viram uma cadeia de salas; as demais, um pequeno aglomerado de locais.
 */
export function gerarRegiao(g, origem, modelo, opts = {}) {
  const portal = !!opts.portal, masmorra = modelo.tipo === 'masmorra';
  const s = g.s;
  const rid = `reg_${(s.uid = (s.uid || 0) + 1)}`;
  const nomeReg = cap(g.label(modelo.nome || modelo.id));
  const { x: cx, y: cy, ls } = centro(g);
  const todos = ls.map((l) => ({ x: l.x, y: l.y }));
  // Direção: para longe do centro (planos ficam "acima" da origem no mapa).
  let ang = portal ? -Math.PI / 2 : masmorra && !opts.fronteira ? g.rng.next() * Math.PI * 2 : Math.atan2((origem.y ?? cy) - cy, (origem.x ?? cx) - cx);
  if (!Number.isFinite(ang) || (origem.x === cx && origem.y === cy)) ang = g.rng.next() * Math.PI * 2;
  const specs = [...(modelo.locais || [])];
  const covil = masmorra ? specs.pop() : null; // o covil é sempre o último de `locais`, mesmo com opcionais
  for (const op of modelo.opcionais || []) if (g.rng.chance(op.chance ?? 0.5)) specs.push(op);
  if (masmorra) { // salas intermediárias sorteadas entre a entrada e o covil
    const salas = modelo.salas || [2, 3];
    const n = g.rng.int(salas[0], salas[1]);
    const meio = modelo.sala || { nome: '{sala_nome}', tags: ['sala'] };
    for (let i = 0; i < n; i++) specs.push(meio);
    if (covil) specs.push(covil);
  }
  const criados = [];
  let ancora = { x: origem.x ?? cx, y: origem.y ?? cy };
  specs.forEach((spec, i) => {
    const id = `${rid}_${i}`;
    const p = posicaoLivre(g, todos, ancora.x, ancora.y, ang, i === 0 ? 16 : masmorra ? 8 : 10);
    todos.push(p);
    const l = {
      id, nome: cap(g.label(spec.nome || modelo.nome)), genero: spec.genero || modelo.genero || 'm',
      artigo: spec.artigo ?? modelo.artigo ?? true, plural: !!(spec.plural ?? false),
      bioma: spec.bioma || modelo.bioma, tags: [...new Set([...(modelo.tags || []), ...(spec.tags || [])])],
      estabelecimentos: spec.estabelecimentos, conexoes: [], x: p.x, y: p.y,
      gerado: true, regiao: rid, modelo: modelo.id, fronteira: 0,
    };
    if (masmorra) l.tags.push('masmorra');
    if (masmorra && i === specs.length - 1) l.tags.push('covil');
    s.locais[id] = l;
    criados.push(l);
    // Masmorra: corredor linear; demais: tudo ligado à entrada (e vizinhos encadeados).
    if (i > 0) {
      const ant = masmorra ? criados[i - 1] : (i > 1 && g.rng.chance(0.5) ? criados[i - 1] : criados[0]);
      const t = spec.tempo ?? (masmorra ? 0 : 1);
      ant.conexoes.push({ para: id, tempo: t });
      l.conexoes.push({ para: ant.id, tempo: t });
    }
    if (!masmorra) ancora = criados[0];
    else ancora = p;
  });
  const entrada = criados[0];
  // Ligação com a origem (o caminho desbravado vira estrada comum; portais custam 0 períodos).
  const tempo = portal ? 0 : modelo.tempo ?? (masmorra ? 0 : 2);
  (s.conexoesExtra[origem.id] ||= []).push({ para: entrada.id, tempo });
  entrada.conexoes.push({ para: origem.id, tempo });
  // Novas fronteiras ficam nos locais mais afastados do centro (o mundo continua a crescer).
  // Regiões abertas sempre deixam ao menos uma saída nova: o mundo nunca se fecha.
  const saidas = masmorra || modelo.plano ? (modelo.fronteira || 0) : Math.max(1, modelo.fronteira ?? 1);
  const longe = [...criados].sort((a, b) => Math.hypot(b.x - cx, b.y - cy) - Math.hypot(a.x - cx, a.y - cy));
  for (let i = 0; i < saidas; i++) longe[i % longe.length].fronteira++;
  s.regioes[rid] = { id: rid, modelo: modelo.id, nome: nomeReg, origem: origem.id, entrada: entrada.id, dia: s.dia, locais: criados.map((l) => l.id) };
  g.vars.regiao = gvar(nomeReg, modelo.genero || 'f', { art: modelo.artigo ?? true });
  return entrada;
}

/** Local da região a que `id` pertence (ou null). */
export const regiaoDe = (g, id) => g.s.regioes[loc(g, id)?.regiao] || null;

/** Há algum caminho a partir de `id`? (sanidade: locais gerados nunca ficam isolados) */
export const temSaida = (g, id) => conexoes(g, id).length > 0;
