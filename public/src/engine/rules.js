// Sistema de regras "Fio" — 2d6 + atributo: 10+ sucesso, 7–9 parcial, 6- falha.
// Todas as funções recebem `g` (Game): g.s estado, g.c conteúdo, g.rng, g.say(tpl, vars), g.diary(txt).
import { stats, syncMax, addItem, removeItem } from './hero.js';
import { generateItem } from './items.js';
import { gvar } from './grammar.js';
import { mudarDisposicao } from './npcs.js';

export const PERIODOS = ['manha', 'tarde', 'noite', 'madrugada'];
export const PERIODO_NOME = { manha: 'Manhã', tarde: 'Tarde', noite: 'Noite', madrugada: 'Madrugada' };
export const MAX_EXAUSTAO = 5;
export const xpParaNivel = (n) => n * 8;
const RESULT = { sucesso: 'Sucesso', parcial: 'Sucesso parcial', falha: 'Falha' };
const ATTR_ROTULO = { forca: 'FORÇA', agilidade: 'AGILIDADE', mente: 'MENTE', presenca: 'PRESENÇA' };

/** Teste de atributo. bonusTag: {tag: bônus} se o herói tiver item com a tag. */
export function teste(g, atributo, { dificuldade = 0, bonusTag = null } = {}) {
  const h = g.s.heroi, st = stats(h, g.c);
  const d1 = g.rng.int(1, 6), d2 = g.rng.int(1, 6);
  let mod = (st.attrs[atributo] || 0) - st.penalidade - dificuldade;
  if (bonusTag) for (const [tag, b] of Object.entries(bonusTag)) if (h.inventario.some((i) => i.tags?.includes(tag))) mod += b;
  const total = d1 + d2 + mod;
  // 6+6 sempre é crítico (sucesso); 1+1 sempre é desastre (falha).
  const especial = d1 === 6 && d2 === 6 ? 'critico' : d1 === 1 && d2 === 1 ? 'desastre' : null;
  const resultado = especial === 'critico' ? 'sucesso' : especial === 'desastre' ? 'falha'
    : total >= 10 ? 'sucesso' : total >= 7 ? 'parcial' : 'falha';
  g.s.caos = Math.max(1, Math.min(9, g.s.caos + (resultado === 'falha' ? 1 : resultado === 'sucesso' ? -1 : 0)));
  const sinal = mod >= 0 ? '+' : '−';
  const rot = especial === 'critico' ? 'CRÍTICO!' : especial === 'desastre' ? 'DESASTRE!' : RESULT[resultado];
  g.roll(`${ATTR_ROTULO[atributo] || atributo} · 2d6 (${d1}+${d2}) ${sinal}${Math.abs(mod)} = ${total} → ${rot}`, especial || resultado);
  return { d1, d2, mod, total, resultado, especial };
}

/** Oráculo interno sim/não ajustado pelo caos (1–9). */
export function oraculo(g, chance) {
  return g.rng.chance(Math.min(0.95, Math.max(0.02, chance + (g.s.caos - 5) * 0.03)));
}

// ---------- Vida, energia, morte ----------
export function dano(g, n, { reduzir = false } = {}) {
  const h = g.s.heroi;
  if (reduzir) n = Math.max(1, n - stats(h, g.c).defesa);
  h.hp = Math.max(0, h.hp - n);
  g.note(`−${n} vida`, 'dano');
  if (h.hp <= 0) morrer(g);
  return n;
}
export function cura(g, n) {
  const h = g.s.heroi, antes = h.hp;
  h.hp = Math.min(h.hpMax, h.hp + n);
  if (h.hp > antes) g.note(`+${h.hp - antes} vida`, 'cura');
}
export function energia(g, n) {
  const h = g.s.heroi, antes = h.energia;
  h.energia = Math.max(0, Math.min(h.energiaMax, h.energia + n));
  if (h.energia !== antes) g.note(`${n > 0 ? '+' : '−'}${Math.abs(h.energia - antes)} energia`, n > 0 ? 'cura' : 'dano');
}
export function exaustao(g, n) {
  const h = g.s.heroi, antes = h.exaustao;
  h.exaustao = Math.max(0, Math.min(MAX_EXAUSTAO, h.exaustao + n));
  if (h.exaustao !== antes) g.note(`${n > 0 ? '+' : '−'}${Math.abs(h.exaustao - antes)} exaustão`, n > 0 ? 'dano' : 'cura');
}
export function morrer(g) {
  if (g.s.morto) return;
  g.s.morto = true;
  g.s.combate = null;
  g.diary(`${g.s.heroi.nome} tombou ${g.c.location(g.s)?.genero === 'f' ? 'na' : 'no'} ${g.c.location(g.s)?.nome}, no dia ${g.s.dia}.`);
}

// ---------- Progressão ----------
export function ganharXp(g, n) {
  const h = g.s.heroi;
  h.xp += n;
  g.note(`+${n} XP`, 'xp');
  while (h.xp >= xpParaNivel(h.nivel)) {
    h.xp -= xpParaNivel(h.nivel);
    h.nivel++;
    h.hpBase += 3; h.energiaBase += 1;
    if (h.nivel % 2 === 0) {
      const melhor = Object.entries(h.atributos).sort((a, b) => b[1] - a[1])[0][0];
      if (h.atributos[melhor] < 4) h.atributos[melhor]++;
    }
    syncMax(h, g.c);
    h.hp = Math.min(h.hpMax, h.hp + 3);
    g.say('{subir_nivel}');
    g.note(`Nível ${h.nivel}!`, 'xp');
    g.diary(`Alcancei o nível ${h.nivel}.`);
  }
}

export function darItem(g, opts = {}) {
  const tier = opts.tier ?? Math.max(1, Math.ceil((g.c.biome(g.s).perigo || 1) / 1.5));
  const item = generateItem(g.c, g.rng, g.s, { ...opts, tier });
  g.vars.item = gvar(item.nome, item.genero);
  g.say('{item_encontrado}');
  if (addItem(g.s.heroi, item)) g.note(`Item: ${item.nome}`, `item r-${item.raridade}`);
  else g.note(`Mochila cheia — ${item.nome} ficou para trás.`, 'dano');
  if (['raro', 'lendario'].includes(item.raridade)) g.diary(`Encontrei ${item.nome}.`);
  return item;
}

// ---------- Tempo e clima ----------
export function sortearClima(g) {
  const pesos = g.c.biome(g.s).clima || { limpo: 1 };
  g.s.clima = g.rng.weighted(Object.entries(pesos), ([, p]) => p)[0];
}
export function avancarTempo(g, n = 1) {
  for (let i = 0; i < n; i++) {
    const idx = PERIODOS.indexOf(g.s.periodo) + 1;
    if (idx >= PERIODOS.length) {
      g.s.periodo = 'manha'; g.s.dia++;
      sortearClima(g);
      g.say('{novo_dia}');
    } else g.s.periodo = PERIODOS[idx];
  }
}
function ateAmanhecer(g) {
  const idx = PERIODOS.indexOf(g.s.periodo);
  avancarTempo(g, PERIODOS.length - idx);
}

// ---------- Efeitos declarativos ----------
const EFFECTS = {
  dano: (g, v) => dano(g, g.rng.roll(v)),
  cura: (g, v) => cura(g, g.rng.roll(v)),
  energia: (g, v) => energia(g, g.rng.roll(v)),
  exaustao: (g, v) => exaustao(g, g.rng.roll(v)),
  ouro: (g, v) => {
    const n = g.rng.roll(v), h = g.s.heroi, antes = h.ouro;
    h.ouro = Math.max(0, h.ouro + n);
    if (h.ouro !== antes) g.note(`${n > 0 ? '+' : '−'}${Math.abs(h.ouro - antes)} ouro`, 'ouro');
  },
  xp: (g, v) => ganharXp(g, g.rng.roll(v)),
  item: (g, v) => darItem(g, v || {}),
  perder_item_tag: (g, v) => {
    const it = g.s.heroi.inventario.find((i) => i.tags?.includes(v));
    if (it) { removeItem(g.s.heroi, it.uid); g.note(`Perdeu: ${it.nome}`, 'dano'); }
  },
  combate: (g, v) => { g.pendingCombat = v; },
  fio: (g, v) => {
    if (g.s.fios.some((f) => f.id === v)) return;
    const t = g.c.threads[v];
    g.s.fios.push({ id: v, pressao: t.pressao ?? 1, desde: g.s.dia });
    g.note('Novo fio solto', 'fio');
    g.diary(g.text(t.texto));
  },
  resolver_fio: (g, v) => {
    const n = g.s.fios.length;
    g.s.fios = g.s.fios.filter((f) => f.id !== v);
    if (g.s.fios.length < n) { g.note('Fio resolvido', 'fio'); g.diary(`Fechei uma ponta solta: ${g.text(g.c.threads[v].texto)}`); }
  },
  tempo: (g, v) => avancarTempo(g, g.rng.roll(v)),
  flag: (g, v) => { g.s.flags[v] = true; },
  remover_flag: (g, v) => { delete g.s.flags[v]; },
  traco: (g, v) => {
    const h = g.s.heroi;
    if (h.tracos.includes(v)) return;
    h.tracos.push(v);
    syncMax(h, g.c);
    g.note(`Traço: ${g.c.traits[v]?.nome || v}`, 'fio');
    g.diary(`Ganhei o traço ${g.c.traits[v]?.nome || v}.`);
  },
  diario: (g, v) => g.diary(g.text(v)),
  cena: (g, v) => { g.pendingScene = v; },
  disposicao: (g, v) => mudarDisposicao(g, g.s.npcs?.[g.s.evento?.npc], g.rng.roll(v)),
};
export const EFFECT_KEYS = Object.keys(EFFECTS);

export function aplicarEfeitos(g, efeitos = []) {
  for (const e of efeitos) {
    for (const [k, v] of Object.entries(e)) {
      if (g.s.morto) return;
      EFFECTS[k]?.(g, v);
    }
  }
}

// ---------- Combate ----------
export function iniciarCombate(g, inimigoId) {
  const e = g.c.enemies[inimigoId];
  g.s.combate = { id: e.id, hp: e.hp, hpMax: e.hp };
  g.vars.inimigo = gvar(e.nome, e.genero);
  g.say('{combate_inicio}');
}

function golpeHeroi(g, e, mult = 1) {
  const st = stats(g.s.heroi, g.c);
  const n = Math.max(1, g.rng.roll(st.arma?.dano || '1d3') + st.danoBonus - (e.defesa || 0)) * mult;
  g.s.combate.hp = Math.max(0, g.s.combate.hp - n);
  g.note(`${g.vars.inimigo.Nome} −${n}${mult > 1 ? ' (crítico)' : ''}`, mult > 1 ? 'golpe critico' : 'golpe');
}
function golpeInimigo(g, e) { dano(g, g.rng.roll(e.dano), { reduzir: true }); }

/** acao: 'atacar' | 'fugir' | 'negociar'. Retorna 'continua'|'vitoria'|'fuga'|'acordo'|'morte'. */
export function rodadaCombate(g, acao) {
  const e = g.c.enemies[g.s.combate.id];
  g.vars.inimigo = gvar(e.nome, e.genero);
  if (acao === 'atacar') {
    const attr = stats(g.s.heroi, g.c).arma?.atributo || 'forca';
    const { resultado: r, especial } = teste(g, attr);
    if (especial === 'critico') { g.say('{ataque_critico}'); golpeHeroi(g, e, 2); }
    else if (especial === 'desastre') { g.say('{ataque_desastre}'); golpeInimigo(g, e); exaustao(g, 1); }
    else if (r === 'sucesso') { g.say('{ataque_acerto}'); golpeHeroi(g, e); }
    else if (r === 'parcial') { g.say('{ataque_parcial}'); golpeHeroi(g, e); if (g.s.combate.hp > 0) golpeInimigo(g, e); }
    else { g.say('{ataque_falha}'); golpeInimigo(g, e); }
  } else if (acao === 'fugir') {
    const r = teste(g, 'agilidade').resultado;
    if (r === 'falha') { g.say('{fuga_falha}'); golpeInimigo(g, e); }
    else {
      g.say('{fuga_sucesso}');
      if (r === 'parcial') golpeInimigo(g, e);
      if (!g.s.morto) { g.s.combate = null; return 'fuga'; }
    }
  } else if (acao === 'negociar') {
    const r = teste(g, 'presenca', { dificuldade: e.tier > 2 ? 1 : 0 }).resultado;
    const preco = g.rng.roll('1d6') + e.tier * 2;
    if (r === 'sucesso' || (r === 'parcial' && g.s.heroi.ouro >= preco)) {
      if (r === 'parcial') EFFECTS.ouro(g, -preco);
      g.say('{negociar_sucesso}');
      g.s.combate = null;
      return 'acordo';
    }
    g.say('{negociar_falha}'); golpeInimigo(g, e);
  }
  if (g.s.morto) return 'morte';
  if (g.s.combate.hp <= 0) {
    g.ultimoVencido = e.id;
    g.say('{vitoria}');
    g.s.combate = null;
    ganharXp(g, e.xp || 1);
    EFFECTS.ouro(g, e.ouro || 0);
    if (g.rng.chance(e.saque || 0)) darItem(g, { tier: e.tier });
    return 'vitoria';
  }
  return 'continua';
}

// ---------- Descanso ----------
function chanceEmboscada(g, fator) {
  if (g.c.location(g.s).tags?.includes('seguro')) return false;
  const noite = ['noite', 'madrugada'].includes(g.s.periodo) ? 0.1 : 0;
  return oraculo(g, (g.c.biome(g.s).perigo || 0) * fator + noite);
}
function emboscada(g) {
  const lista = g.c.biome(g.s).inimigos || [];
  if (!lista.length) return null;
  const id = g.rng.pick(lista);
  g.vars.inimigo = gvar(g.c.enemies[id].nome, g.c.enemies[id].genero);
  g.say('{emboscada}');
  return id;
}

/** Retorna id de inimigo se houve emboscada, senão null. */
export function descansoCurto(g) {
  g.say('{descanso_curto}');
  avancarTempo(g, 1);
  energia(g, 2);
  cura(g, g.rng.roll('1d3'));
  return chanceEmboscada(g, 0.07) ? emboscada(g) : null;
}

export function acampar(g) {
  const h = g.s.heroi;
  const racao = h.inventario.find((i) => i.tags?.includes('racao'));
  g.say('{acampamento}');
  ateAmanhecer(g);
  if (racao) {
    removeItem(h, racao.uid);
    g.note(`Consumiu: ${racao.nome}`, '');
    cura(g, Math.ceil(h.hpMax * 0.5));
    exaustao(g, -2);
    energia(g, h.energiaMax);
  } else {
    g.note('Dormiu com fome', 'dano');
    cura(g, Math.ceil(h.hpMax * 0.2));
    exaustao(g, 1);
    energia(g, Math.ceil(h.energiaMax / 2));
  }
  return chanceEmboscada(g, 0.1) ? emboscada(g) : null;
}

export const PRECO_ESTALAGEM = 5;
export function estalagem(g) {
  const h = g.s.heroi;
  EFFECTS.ouro(g, -PRECO_ESTALAGEM);
  g.say('{estalagem}');
  ateAmanhecer(g);
  cura(g, Math.ceil(h.hpMax * 0.6));
  exaustao(g, -MAX_EXAUSTAO);
  energia(g, h.energiaMax);
}
