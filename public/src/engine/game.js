// Orquestrador: estado → cena (texto + opções) → escolha → novo estado.
// Sem DOM: a UI só lê `game.s.cena` e chama `choose(i)` / ações de inventário.
import { Rng, hashSeed } from './rng.js';
import { expand, gvar } from './grammar.js';
import { check } from './conditions.js';
import { generateItem } from './items.js';
import { addItem, removeItem, equip, syncMax, SLOTS_EQUIP, stats } from './hero.js';
import { START_LOCATION } from './content.js';
import * as R from './rules.js';

export const SAVE_VERSION = 1;
const RECENTES = 6;
const ESTOQUE_FIXO = ['racao', 'pocao_menor', 'pocao', 'tocha', 'corda'];

export function newState(content, { classe, nome, genero = 'm', seed = String(Date.now()) }) {
  const cls = content.classes.find((c) => c.id === classe) || content.classes[0];
  const s = {
    versao: SAVE_VERSION, seed, rng: hashSeed(seed), dia: 1, periodo: 'manha', clima: 'limpo',
    local: START_LOCATION, fios: [], flags: {}, diario: [], memoria: {}, recentes: [],
    caos: 5, uid: 0, mercados: {}, cena: null, combate: null, evento: null, morto: false,
    heroi: {
      nome, genero, classe: cls.id, atributos: { ...cls.atributos },
      hpBase: cls.hp, energiaBase: cls.energia, hp: cls.hp, hpMax: cls.hp,
      energia: cls.energia, energiaMax: cls.energia, exaustao: 0, ouro: 10, xp: 0, nivel: 1,
      tracos: [...(cls.tracos || [])], inventario: [], equipado: { arma: null, armadura: null, amuleto: null },
    },
  };
  const g = new Game(content, s);
  for (const it of cls.inicial || []) {
    for (let i = 0; i < (it.qtd || 1); i++) {
      const item = generateItem(content, g.rng, s, { base: it.base, raridade: 'comum', tier: 1 });
      addItem(s.heroi, item);
      if (SLOTS_EQUIP.includes(item.slot) && !s.heroi.equipado[item.slot]) s.heroi.equipado[item.slot] = item.uid;
    }
  }
  syncMax(s.heroi, content);
  s.heroi.hp = s.heroi.hpMax; s.heroi.energia = s.heroi.energiaMax;
  R.sortearClima(g);
  g.diary(`${nome} parte ${content.location(s).genero === 'f' ? 'da' : 'do'} ${content.location(s).nome} em busca de seu destino.`);
  g.begin();
  g.say('{local_desc}');
  g.hub();
  return s;
}

export class Game {
  constructor(content, state) {
    this.c = content;
    this.s = state;
    this.rng = new Rng(state.rng);
    this.vars = {};
    this.out = [];
  }

  // ---------- Saída de texto ----------
  ctxTags() {
    const s = this.s, h = s.heroi, loc = this.c.location(s);
    const t = new Set([loc.bioma, ...(loc.tags || []), s.periodo, s.clima]);
    if (s.combate) t.add('combate');
    if (h.hp <= h.hpMax / 2) t.add('ferido');
    if (h.exaustao >= 3) t.add('exausto');
    return t;
  }
  refreshVars() {
    const s = this.s, loc = this.c.location(s), b = this.c.biome(s);
    this.vars.heroi = gvar(s.heroi.nome, s.heroi.genero);
    this.vars.local = gvar(loc.nome, loc.genero);
    this.vars.bioma = gvar(b.nome || '', b.genero);
  }
  text(tpl) {
    this.refreshVars();
    return expand(tpl, { rng: this.rng, tables: this.c.grammar, vars: this.vars, tags: this.ctxTags(), memory: this.s.memoria });
  }
  say(tpl) { const t = this.text(tpl).trim(); if (t) this.out.push({ tipo: 'texto', texto: t }); }
  note(texto, classe = '') { this.out.push({ tipo: 'nota', texto, classe }); }
  roll(texto, classe) { this.out.push({ tipo: 'rolagem', texto, classe }); }
  diary(texto) { this.s.diario.push({ dia: this.s.dia, periodo: this.s.periodo, texto }); }

  begin() { this.out = []; this.pendingCombat = null; }
  commit(modo, opcoes) {
    if (this.s.morto) { modo = 'morte'; opcoes = []; this.say('{epitafio}'); }
    this.s.cena = { modo, blocos: this.out, opcoes };
    this.s.rng = this.rng.s;
  }
  opt(rotulo, acao, extra = {}) { return { rotulo: this.text(rotulo), acao, ...extra }; }

  // ---------- Cenas ----------
  hub() {
    const s = this.s, loc = this.c.location(s), h = s.heroi;
    const ops = [this.opt('Explorar {$local.o} {$local.nome}', { tipo: 'explorar' })];
    for (const cx of loc.conexoes || []) {
      const d = this.c.locations[cx.para];
      if (!d) continue;
      const v = gvar(d.nome, d.genero);
      ops.push(this.opt(`Viajar para ${v.o} ${d.nome}`, { tipo: 'viajar', para: d.id }, { dica: `${cx.tempo || 1} período(s)` }));
    }
    ops.push(this.opt('Descansar um pouco', { tipo: 'descansar' }, { dica: 'curto' }));
    if (!loc.tags?.includes('seguro')) {
      const temRacao = h.inventario.some((i) => i.tags?.includes('racao'));
      ops.push(this.opt(temRacao ? 'Acampar até o amanhecer' : 'Acampar sem comida', { tipo: 'acampar' }, { dica: temRacao ? 'gasta 1 ração' : 'arriscado' }));
    }
    if (loc.tags?.includes('estalagem')) {
      ops.push(this.opt('Dormir na estalagem', { tipo: 'estalagem' }, { dica: `${R.PRECO_ESTALAGEM} ouro`, desativada: h.ouro < R.PRECO_ESTALAGEM }));
    }
    if (loc.tags?.includes('mercado')) ops.push(this.opt('Visitar o mercado', { tipo: 'mercado' }));
    this.commit('local', ops);
  }

  eventScene(ev) {
    this.s.evento = { id: ev.id };
    this.say(ev.texto);
    this.commit('evento', this.eventOptions(ev));
  }
  eventOptions(ev) {
    return ev.opcoes
      .map((o, i) => ({ o, i }))
      .filter(({ o }) => check(o.requer, this.s, this.c))
      .map(({ o, i }) => this.opt(o.rotulo, { tipo: 'opcao', idx: i }, o.teste ? { dica: `teste: ${o.teste}` } : {}));
  }

  combatScene() {
    const e = this.c.enemies[this.s.combate.id];
    const ops = [this.opt('Atacar', { tipo: 'atacar' }), this.opt('Fugir', { tipo: 'fugir' }, { dica: 'agilidade' })];
    if (e.tags?.includes('inteligente')) ops.push(this.opt('Negociar', { tipo: 'negociar' }, { dica: 'presença' }));
    this.commit('combate', ops);
  }

  marketScene() {
    const st = this.estoque();
    const h = this.s.heroi;
    const ops = st.map((it, i) => this.opt(`Comprar ${it.nome}`, { tipo: 'comprar', idx: i },
      { dica: `${precoCompra(it)} ouro`, desativada: h.ouro < precoCompra(it), item: it }));
    for (const it of h.inventario) {
      if (Object.values(h.equipado).includes(it.uid)) continue;
      ops.push(this.opt(`Vender ${it.nome}`, { tipo: 'vender', uid: it.uid }, { dica: `+${precoVenda(it)} ouro`, item: it }));
    }
    ops.push(this.opt('Sair do mercado', { tipo: 'sair' }));
    this.commit('mercado', ops);
  }

  estoque() {
    const s = this.s, m = s.mercados[s.local];
    if (m && m.dia === s.dia) return m.itens;
    const itens = ESTOQUE_FIXO.filter((id) => this.c.items.bases.some((b) => b.id === id))
      .map((id) => generateItem(this.c, this.rng, s, { base: id, raridade: 'comum' }));
    for (let i = 0; i < 3; i++) itens.push(generateItem(this.c, this.rng, s, { tier: Math.min(3, 1 + Math.floor(s.heroi.nivel / 2)), slot: this.rng.pick(SLOTS_EQUIP) }));
    s.mercados[s.local] = { dia: s.dia, itens };
    return itens;
  }

  // ---------- Fios soltos ----------
  tickFios() {
    for (const f of this.s.fios) f.pressao += this.c.threads[f.id]?.incremento ?? 1;
  }
  emergirFio() {
    for (const f of this.s.fios) {
      const t = this.c.threads[f.id];
      if (!t || !check(t.requer, this.s, this.c)) continue;
      if (this.rng.chance(Math.min(0.8, f.pressao * 0.1))) {
        f.pressao = 0;
        this.vars.fio = gvar(t.texto, 'm');
        return this.c.eventMap[t.evento];
      }
    }
    return null;
  }

  sortearEvento(tipo) {
    const pool = this.c.events.filter((e) => e.tipo === tipo && check(e.requer, this.s, this.c));
    const fresh = pool.filter((e) => !this.s.recentes.includes(e.id));
    const ev = this.rng.weighted(fresh.length ? fresh : pool);
    if (ev) { this.s.recentes.push(ev.id); while (this.s.recentes.length > RECENTES) this.s.recentes.shift(); }
    return ev;
  }

  gastarEnergia(n) {
    for (let i = 0; i < n; i++) {
      if (this.s.heroi.energia > 0) R.energia(this, -1);
      else R.exaustao(this, 1);
    }
  }

  // ---------- Escolhas ----------
  choose(index) {
    const op = this.s.cena?.opcoes?.[index];
    if (!op || op.desativada || this.s.morto) return;
    this.begin();
    const a = op.acao;
    const handler = this[`act_${a.tipo}`];
    if (!handler) throw new Error(`Ação desconhecida: ${a.tipo}`);
    handler.call(this, a);
    this.s.turno = (this.s.turno || 0) + 1;
  }

  /** Após resolver algo: combate pendente, morte ou volta ao local. */
  afterResolve() {
    if (this.s.morto) return this.commit('morte', []);
    if (this.pendingCombat) { R.iniciarCombate(this, this.pendingCombat); return this.combatScene(); }
    this.s.evento = null;
    this.say('{local_retorno}');
    this.hub();
  }

  act_explorar() {
    this.gastarEnergia(1);
    R.avancarTempo(this, 1);
    this.tickFios();
    const ev = this.emergirFio() || this.sortearEvento('exploracao');
    if (this.s.morto) return this.commit('morte', []);
    if (!ev) { this.say('{local_retorno}'); return this.hub(); }
    this.eventScene(ev);
  }

  act_viajar({ para }) {
    const origem = this.c.location(this.s);
    const cx = origem.conexoes.find((x) => x.para === para);
    const destino = this.c.locations[para];
    const tempo = cx?.tempo || 1;
    this.vars.destino = gvar(destino.nome, destino.genero);
    this.gastarEnergia(tempo);
    R.avancarTempo(this, tempo);
    if (this.s.morto) return this.commit('morte', []);
    const mudouBioma = origem.bioma !== destino.bioma;
    this.s.local = para;
    if (mudouBioma) R.sortearClima(this);
    this.tickFios();
    this.say('{chegada}');
    const ev = this.emergirFio() || (this.rng.chance(mudouBioma ? 0.6 : 0.25) ? this.sortearEvento('viagem') : null);
    if (ev) return this.eventScene(ev);
    this.say('{local_desc}');
    this.hub();
  }

  act_opcao({ idx }) {
    const ev = this.c.eventMap[this.s.evento?.id];
    const o = ev?.opcoes[idx];
    if (!o) return this.hub();
    let saida = o.resultado;
    if (o.teste) saida = o[R.teste(this, o.teste, { dificuldade: o.dificuldade || 0, bonusTag: o.bonus_tag }).resultado];
    if (saida?.texto) this.say(saida.texto);
    R.aplicarEfeitos(this, saida?.efeitos);
    this.afterResolve();
  }

  act_atacar() { this.combatTurn('atacar'); }
  act_fugir() { this.combatTurn('fugir'); }
  act_negociar() { this.combatTurn('negociar'); }
  combatTurn(acao) {
    const r = R.rodadaCombate(this, acao);
    if (r === 'continua') return this.combatScene();
    this.afterResolve();
  }

  act_descansar() {
    const emb = R.descansoCurto(this);
    if (emb) this.pendingCombat = emb;
    this.afterResolve();
  }
  act_acampar() {
    const emb = R.acampar(this);
    if (emb) this.pendingCombat = emb;
    this.afterResolve();
  }
  act_estalagem() { R.estalagem(this); this.afterResolve(); }

  act_mercado() { this.say('Mercadores anunciam suas mercadorias sob toldos remendados.'); this.marketScene(); }
  act_comprar({ idx }) {
    const st = this.estoque(), it = st[idx], h = this.s.heroi;
    if (!it || h.ouro < precoCompra(it)) return this.marketScene();
    if (!addItem(h, it)) { this.note('Mochila cheia.', 'dano'); return this.marketScene(); }
    h.ouro -= precoCompra(it);
    st.splice(idx, 1);
    this.note(`Comprou: ${it.nome} (−${precoCompra(it)} ouro)`, 'ouro');
    this.marketScene();
  }
  act_vender({ uid }) {
    const it = removeItem(this.s.heroi, uid);
    if (it) { this.s.heroi.ouro += precoVenda(it); this.note(`Vendeu: ${it.nome} (+${precoVenda(it)} ouro)`, 'ouro'); }
    this.marketScene();
  }
  act_sair() { this.say('{local_retorno}'); this.hub(); }

  // ---------- Inventário (fora do fluxo de escolhas) ----------
  /** Reconstrói só as opções da cena atual (ex.: após usar/equipar item). */
  refreshOptions(extraBlocos = []) {
    const blocos = [...(this.s.cena?.blocos || []), ...extraBlocos];
    const modo = this.s.cena?.modo;
    this.out = [];
    if (modo === 'evento') this.commit('evento', this.eventOptions(this.c.eventMap[this.s.evento.id]));
    else if (modo === 'combate') this.combatScene();
    else if (modo === 'mercado') this.marketScene();
    else if (modo === 'local') this.hub();
    else return;
    this.s.cena.blocos = blocos;
  }

  usarItem(uid) {
    const h = this.s.heroi, it = h.inventario.find((i) => i.uid === uid);
    if (!it || it.slot !== 'consumivel' || this.s.morto) return;
    this.begin();
    removeItem(h, uid);
    this.note(`Usou: ${it.nome}`, '');
    R.aplicarEfeitos(this, it.efeitos);
    const notas = this.out;
    if (this.s.morto) { this.out = notas; return this.commit('morte', []); }
    this.refreshOptions(notas);
  }
  equiparItem(uid) {
    if (this.s.morto) return;
    equip(this.s.heroi, uid, this.c);
    this.refreshOptions();
  }
  descartarItem(uid) {
    if (this.s.morto) return;
    const it = removeItem(this.s.heroi, uid);
    syncMax(this.s.heroi, this.c);
    this.refreshOptions(it ? [{ tipo: 'nota', texto: `Descartou: ${it.nome}`, classe: '' }] : []);
  }
  stats() { return stats(this.s.heroi, this.c); }
}

export const precoCompra = (it) => Math.ceil(it.valor * 1.5);
export const precoVenda = (it) => Math.max(1, Math.floor(it.valor / 2));
