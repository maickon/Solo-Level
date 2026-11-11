// Bot que joga partidas aleatórias para detectar travas, textos quebrados e estados inválidos.
import { newState, Game } from '../public/src/engine/game.js';
import { estilo } from './estilo.mjs';

export function simulate(content, { runs = 20, maxTurns = 300 } = {}) {
  const res = { runs, turns: 0, deaths: 0, maxLevel: 1, threadsOpened: 0, threadsResolved: 0, problems: [],
    textos: new Map(), estilo: new Map() };
  for (let r = 0; r < runs; r++) {
    const cls = content.classes[r % content.classes.length];
    const s = newState(content, { classe: cls.id, nome: 'Teste', genero: r % 2 ? 'f' : 'm', seed: `sim-${r}` });
    const g = new Game(content, s);
    const seenThreads = new Set();
    for (let t = 0; t < maxTurns && !s.morto; t++) {
      const cena = s.cena;
      inspect(cena, s, res.problems);
      coletar(cena, res);
      const ok = cena.opcoes.map((o, i) => (o.desativada ? -1 : i)).filter((i) => i >= 0);
      if (!ok.length) { res.problems.push(`sem opções no modo ${cena.modo} (evento ${s.evento?.id})`); break; }
      // Bot: usa consumível de cura quando ferido; senão escolhe aleatoriamente.
      const h = s.heroi;
      const pocao = h.inventario.find((i) => i.efeitos?.some((e) => e.cura));
      if (h.hp <= h.hpMax / 3 && pocao) g.usarItem(pocao.uid);
      else g.choose(ok[g.rng.int(0, ok.length - 1)]);
      for (const f of s.fios) if (!seenThreads.has(f.id)) { seenThreads.add(f.id); res.threadsOpened++; }
      res.turns++;
    }
    res.threadsResolved += [...seenThreads].filter((id) => !s.fios.some((f) => f.id === id)).length;
    if (s.morto) res.deaths++;
    res.maxLevel = Math.max(res.maxLevel, s.heroi.nivel);
    JSON.parse(JSON.stringify(s)); // estado precisa ser serializável
  }
  return res;
}

/** Conta textos (variedade) e avisos de estilo; cada bloco é contado uma vez. */
const contados = new WeakSet();
function coletar(cena, res) {
  for (const b of cena.blocos) {
    if (b.tipo !== 'texto' || contados.has(b)) continue;
    contados.add(b);
    res.textos.set(b.texto, (res.textos.get(b.texto) || 0) + 1);
    for (const a of estilo(b.texto)) if (!res.estilo.has(a)) res.estilo.set(a, b.texto);
  }
}

/** Resumo de variedade: % de textos distintos e os mais repetidos. */
export function variedade(res, top = 5) {
  const total = [...res.textos.values()].reduce((a, n) => a + n, 0);
  const rank = [...res.textos].sort((a, b) => b[1] - a[1]).slice(0, top);
  return { total, distintos: res.textos.size, pct: total ? Math.round((res.textos.size / total) * 100) : 0, rank };
}

function inspect(cena, s, problems) {
  const h = s.heroi;
  for (const b of cena.blocos) {
    if (/\[[a-z_]+\]/.test(b.texto)) problems.push(`tabela ausente em texto: "${b.texto}"`);
    if (/[{}]/.test(b.texto)) problems.push(`token não expandido: "${b.texto}"`);
    if (/undefined|NaN/.test(b.texto)) problems.push(`valor inválido em texto: "${b.texto}"`);
  }
  for (const o of cena.opcoes) if (/[{}[\]]|undefined/.test(o.rotulo)) problems.push(`rótulo quebrado: "${o.rotulo}"`);
  if (h.hp > h.hpMax || h.hp < 0) problems.push(`hp inválido ${h.hp}/${h.hpMax}`);
  if (h.energia > h.energiaMax || h.energia < 0) problems.push(`energia inválida ${h.energia}/${h.energiaMax}`);
  if (h.ouro < 0 || Number.isNaN(h.ouro)) problems.push(`ouro inválido ${h.ouro}`);
}
