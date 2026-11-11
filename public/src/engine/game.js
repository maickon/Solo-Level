// Orquestrador: estado → cena (texto + opções) → escolha → novo estado.
// Sem DOM: a UI só lê `game.s.cena` e chama `choose(i)` / ações de inventário e missões.
import { Rng, hashSeed } from './rng.js';
import { expand, gvar, novaCena, polir } from './grammar.js';
import { check } from './conditions.js';
import { generateItem } from './items.js';
import { addItem, removeItem, equip, syncMax, SLOTS_EQUIP, stats, LIMITE_INVENTARIO } from './hero.js';
import { START_LOCATION } from './content.js';
import { loc, conexoes, marcarVisita, descobrirPoi } from './world.js';
import { vincularNpc, npcVar, registrarNpc, mudarDisposicao } from './npcs.js';
import { ofertas, textoMissao, varsMissao, contratante, MAX_ATIVAS } from './quests.js';
import * as R from './rules.js';

export const SAVE_VERSION = 2;
const RECENTES = 6;
const ESTOQUE_FIXO = ['racao', 'pocao_menor', 'pocao', 'tocha', 'corda'];

export function newState(content, { classe, nome, genero = 'm', seed = String(Date.now()) }) {
  const cls = content.classes.find((c) => c.id === classe) || content.classes[0];
  const s = {
    versao: SAVE_VERSION, seed, rng: hashSeed(seed), dia: 1, periodo: 'manha', clima: 'limpo',
    local: START_LOCATION, fios: [], flags: {}, diario: [], memoria: {}, recentes: [],
    caos: 5, uid: 0, mercados: {}, cena: null, combate: null, evento: null, morto: false,
    visitados: [START_LOCATION], locais: {}, conexoesExtra: {}, npcs: {}, missoes: [], ofertas: {},
    aposCombate: null, combateMissao: null,
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

  loc(id) { return loc(this, id); }

  // ---------- Saída de texto ----------
  ctxTags() {
    const s = this.s, h = s.heroi, l = this.c.location(s);
    const t = new Set([l.bioma, ...(l.tags || []), s.periodo, s.clima]);
    if (s.combate) t.add('combate');
    if (h.hp <= h.hpMax / 2) t.add('ferido');
    if (h.exaustao >= 3) t.add('exausto');
    // NPC do evento atual, ou um contexto temporário (ex.: contratante de missão).
    const npc = this.npcCtx?.npc || s.npcs[s.evento?.npc];
    if (npc) {
      t.add((this.npcCtx ? this.npcCtx.novo : s.evento.npcNovo) ? 'npc_novo' : 'npc_conhecido');
      if (npc.disposicao >= 2) t.add('npc_amigo');
      if (npc.disposicao <= -2) t.add('npc_hostil');
      t.add(`oficio_${npc.oficio}`);
      if (npc.temperamento) t.add(`temp_${npc.temperamento}`);
    }
    return t;
  }
  refreshVars() {
    const s = this.s, l = this.c.location(s), b = this.c.biome(s);
    this.vars.heroi = gvar(s.heroi.nome, s.heroi.genero, { art: false });
    this.vars.local = gvar(l.nome, l.genero, { art: l.artigo ?? true, plural: !!l.plural });
    this.vars.bioma = gvar(b.nome || '', b.genero);
    const npc = this.npcCtx?.npc || s.npcs[s.evento?.npc];
    if (npc) this.vars.npc = npcVar(this, npc);
  }
  text(tpl) {
    this.refreshVars();
    this.cenaCtx ||= novaCena();
    return expand(tpl, { rng: this.rng, tables: this.c.grammar, vars: this.vars, tags: this.ctxTags(), memory: this.s.memoria, cena: this.cenaCtx });
  }
  /** Texto de rótulo/título: não conta como fala da cena (não marca fatos nem palavras usadas). */
  label(tpl) {
    const salvo = this.cenaCtx;
    this.cenaCtx = novaCena();
    const t = polir(this.text(tpl));
    this.cenaCtx = salvo;
    return t;
  }
  say(tpl) { const t = polir(this.text(tpl)); if (t) this.out.push({ tipo: 'texto', texto: t }); }
  note(texto, classe = '') { this.out.push({ tipo: 'nota', texto, classe }); }
  roll(texto, classe) { this.out.push({ tipo: 'rolagem', texto, classe }); }
  diary(texto) { this.s.diario.push({ dia: this.s.dia, periodo: this.s.periodo, texto }); }

  begin() { this.out = []; this.pendingCombat = null; this.pendingScene = null; this.cenaCtx = novaCena(); }
  commit(modo, opcoes) {
    if (this.s.morto) { modo = 'morte'; opcoes = []; this.say('{epitafio}'); }
    this.s.cena = { modo, blocos: this.out, opcoes };
    this.s.rng = this.rng.s;
  }
  opt(rotulo, acao, extra = {}) { return { rotulo: this.label(rotulo), acao, ...extra }; }

  // ---------- Cenas ----------
  hub() {
    const s = this.s, l = this.c.location(s), h = s.heroi;
    s.evento = null;
    const ops = [this.opt('Explorar {$local.o} {$local.nome}', { tipo: 'explorar' })];
    // Missões que podem ser cumpridas ou entregues aqui vêm logo no topo.
    for (const m of s.missoes) {
      if (m.estado === 'ativa' && m.destino === s.local && m.objetivo !== 'chegar') {
        ops.push(this.opt(`${m.objetivo === 'vencer' ? 'Cumprir' : 'Investigar'}: ${m.titulo}`, { tipo: 'missao_cumprir', uid: m.uid }, { dica: 'missão', destaque: true }));
      }
      if (m.estado === 'cumprida' && m.origem === s.local) {
        ops.push(this.opt(`Entregar a missão a ${contratante(this, m)?.nome}`, { tipo: 'missao_entregar', uid: m.uid }, { dica: `${m.ouro} ouro`, destaque: true }));
      }
    }
    for (const cx of conexoes(this, s.local)) {
      const d = this.loc(cx.para);
      if (!d) continue;
      const v = gvar(d.nome, d.genero, { art: d.artigo ?? true, plural: !!d.plural });
      const novo = !s.visitados.includes(d.id);
      ops.push(this.opt(`Viajar para ${v.o} ${d.nome}`, { tipo: 'viajar', para: d.id }, { dica: `${cx.tempo || 1} período(s)${novo ? ' · inexplorado' : ''}` }));
    }
    ops.push(this.opt('Descansar um pouco', { tipo: 'descansar' }, { dica: 'curto' }));
    if (!l.tags?.includes('seguro')) {
      const temRacao = h.inventario.some((i) => i.tags?.includes('racao'));
      ops.push(this.opt(temRacao ? 'Acampar até o amanhecer' : 'Acampar sem comida', { tipo: 'acampar' }, { dica: temRacao ? 'gasta 1 ração' : 'arriscado' }));
    }
    if (l.tags?.includes('estalagem')) {
      ops.push(this.opt('Dormir na estalagem', { tipo: 'estalagem' }, { dica: `${R.PRECO_ESTALAGEM} ouro`, desativada: h.ouro < R.PRECO_ESTALAGEM }));
    }
    if (l.tags?.includes('mercado')) ops.push(this.opt('Visitar o mercado', { tipo: 'mercado' }));
    if (l.tags?.includes('seguro') && this.c.quests.length) ops.push(this.opt('Procurar trabalho', { tipo: 'trabalho' }, { dica: `${s.missoes.length}/${MAX_ATIVAS} missões` }));
    this.commit('local', ops);
  }

  /** Abre um evento. `herdar` mantém o NPC do passo anterior de uma cadeia. */
  eventScene(ev, herdar = null) {
    let npc = null, npcNovo = false;
    if (ev.npc) { const r = vincularNpc(this, ev.npc); npc = r.npc.id; npcNovo = r.novo; }
    else if (herdar?.npc) { npc = herdar.npc; npcNovo = herdar.npcNovo; }
    this.s.evento = { id: ev.id, npc, npcNovo };
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
      if (Object.values(h.equipado).includes(it.uid) || it.tags?.includes('missao')) continue;
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

  workScene() {
    const s = this.s, cheio = s.missoes.length >= MAX_ATIVAS;
    const ops = ofertas(this).map((m) => {
      const d = this.loc(m.destino);
      const semEspaco = m.objetivo === 'chegar' && s.heroi.inventario.length >= LIMITE_INVENTARIO;
      return this.opt(`Aceitar: ${m.titulo}`, { tipo: 'aceitar', uid: m.uid },
        { dica: `${d?.nome} · ${m.ouro} ouro`, desativada: cheio || semEspaco });
    });
    if (!ops.length) this.say('{trabalho_vazio}');
    if (cheio) this.note(`Limite de ${MAX_ATIVAS} missões ativas.`, '');
    ops.push(this.opt('Voltar', { tipo: 'sair' }));
    this.commit('trabalho', ops);
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

  /** Após resolver algo: combate pendente, próxima cena da cadeia, morte ou volta ao local. */
  afterResolve() {
    if (this.s.morto) return this.commit('morte', []);
    const herdar = this.s.evento;
    if (this.pendingCombat) {
      this.s.aposCombate = this.pendingScene ? { id: this.pendingScene, npc: herdar?.npc, npcNovo: false } : null;
      R.iniciarCombate(this, this.pendingCombat);
      return this.combatScene();
    }
    if (this.pendingScene && this.c.eventMap[this.pendingScene]) {
      return this.eventScene(this.c.eventMap[this.pendingScene], herdar && { ...herdar, npcNovo: false });
    }
    this.say('{local_retorno}');
    this.hub();
  }

  act_explorar() {
    this.gastarEnergia(1);
    R.avancarTempo(this, 1);
    this.tickFios();
    if (this.s.morto) return this.commit('morte', []);
    const poi = descobrirPoi(this);
    if (poi) {
      this.say('{poi_descoberta}');
      this.note(`Novo local no mapa: ${poi.nome}`, 'fio');
      this.diary(`Descobri ${gvar(poi.nome, poi.genero).o_nome}.`);
      return this.hub();
    }
    const ev = this.emergirFio() || this.sortearEvento('exploracao');
    if (!ev) { this.say('{local_retorno}'); return this.hub(); }
    this.eventScene(ev);
  }

  act_viajar({ para }) {
    const origem = this.c.location(this.s);
    const cx = conexoes(this, origem.id).find((x) => x.para === para);
    const destino = this.loc(para);
    if (!cx || !destino) return this.hub();
    const tempo = cx.tempo || 1;
    this.vars.destino = gvar(destino.nome, destino.genero, { art: destino.artigo ?? true, plural: !!destino.plural });
    this.gastarEnergia(tempo);
    R.avancarTempo(this, tempo);
    if (this.s.morto) return this.commit('morte', []);
    const mudouBioma = origem.bioma !== destino.bioma;
    this.s.local = para;
    const primeiraVez = !this.s.visitados.includes(para);
    marcarVisita(this.s, para);
    if (primeiraVez) R.ganharXp(this, 1);
    if (mudouBioma) R.sortearClima(this);
    this.tickFios();
    this.say('{chegada}');
    this.entregasNaChegada();
    if (this.s.morto) return this.commit('morte', []);
    const ev = this.emergirFio() || (this.rng.chance(mudouBioma ? 0.6 : 0.25) ? this.sortearEvento('viagem') : null);
    if (ev) return this.eventScene(ev);
    this.say('{local_desc}');
    this.hub();
  }

  act_opcao({ idx }) {
    const ev = this.c.eventMap[this.s.evento?.id];
    const o = ev?.opcoes[idx];
    if (!o) return this.hub();
    let saida = o.resultado, bonusCritico = false;
    if (o.teste) {
      const t = R.teste(this, o.teste, { dificuldade: o.dificuldade || 0, bonusTag: o.bonus_tag });
      if (t.especial === 'critico') { saida = o.critico || o.sucesso; bonusCritico = !o.critico; }
      else if (t.especial === 'desastre') saida = o.desastre || o.falha;
      else saida = o[t.resultado];
    }
    if (saida?.texto) this.say(saida.texto);
    R.aplicarEfeitos(this, saida?.efeitos);
    if (bonusCritico && !this.s.morto) R.ganharXp(this, 1);
    this.afterResolve();
  }

  act_atacar() { this.combatTurn('atacar'); }
  act_fugir() { this.combatTurn('fugir'); }
  act_negociar() { this.combatTurn('negociar'); }
  combatTurn(acao) {
    const r = R.rodadaCombate(this, acao);
    if (r === 'continua') return this.combatScene();
    const s = this.s;
    const missao = s.missoes.find((m) => m.uid === s.combateMissao);
    s.combateMissao = null;
    if (r === 'vitoria' && missao) {
      missao.estado = 'cumprida';
      this.note(`Missão cumprida: volte a ${contratante(this, missao)?.nome}`, 'fio');
    }
    const apos = s.aposCombate;
    s.aposCombate = null;
    if (r === 'vitoria' && apos && this.c.eventMap[apos.id]) return this.eventScene(this.c.eventMap[apos.id], apos);
    if (s.morto) return this.commit('morte', []);
    this.say('{local_retorno}');
    this.hub();
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

  act_mercado() { this.say('{mercado_intro}'); this.marketScene(); }
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

  // ---------- Missões ----------
  act_trabalho() { this.say('{trabalho_intro}'); this.workScene(); }

  act_aceitar({ uid }) {
    const s = this.s, lista = ofertas(this), i = lista.findIndex((m) => m.uid === uid);
    if (i < 0 || s.missoes.length >= MAX_ATIVAS) return this.workScene();
    const m = lista.splice(i, 1)[0];
    if (!m.npcId) { m.npcId = registrarNpc(this, m.npc).id; m.npc = null; }
    const npc = s.npcs[m.npcId];
    npc.encontros++;
    m.estado = 'ativa';
    m.aceita = s.dia;
    if (m.objetivo === 'chegar') {
      const d = this.loc(m.destino);
      s.uid++;
      const pacote = { uid: s.uid, base: 'pacote', nome: `Pacote para ${d.nome}`, genero: 'm', slot: 'ferramenta',
        raridade: 'comum', atributo: null, dano: null, defesa: 0, efeitos: null, tags: ['missao'], mods: {}, valor: 0, missao: m.uid };
      if (!addItem(s.heroi, pacote)) return this.workScene();
      this.note(`Recebeu: ${pacote.nome}`, 'item');
    }
    s.missoes.push(m);
    this.say(textoMissao(this, m, 'pedido'));
    this.note(`Nova missão: ${m.titulo}`, 'fio');
    this.diary(`Aceitei uma missão de ${npc.nome}: ${m.titulo}.`);
    this.workScene();
  }

  act_missao_cumprir({ uid }) {
    const s = this.s, m = s.missoes.find((x) => x.uid === uid);
    if (!m || m.estado !== 'ativa') return this.hub();
    varsMissao(this, m);
    if (m.objetivo === 'vencer') {
      s.combateMissao = uid;
      R.iniciarCombate(this, m.alvo);
      return this.combatScene();
    }
    // explorar: investigação com teste de mente; falha machuca, mas permite tentar de novo.
    this.gastarEnergia(1);
    R.avancarTempo(this, 1);
    const t = R.teste(this, 'mente', { dificuldade: m.tier > 2 ? 1 : 0, bonusTag: { tocha: 1, mapa: 1 } });
    if (t.resultado === 'falha') { this.say('{missao_investigar_falha}'); R.dano(this, this.rng.roll(t.especial ? '2d4' : '1d6')); }
    else {
      this.say(t.resultado === 'sucesso' ? '{missao_investigar_sucesso}' : '{missao_investigar_parcial}');
      if (t.resultado === 'parcial') R.dano(this, this.rng.roll('1d4'));
      if (!s.morto) { m.estado = 'cumprida'; this.note(`Missão cumprida: volte a ${contratante(this, m)?.nome}`, 'fio'); }
    }
    this.afterResolve();
  }

  act_missao_entregar({ uid }) {
    const m = this.s.missoes.find((x) => x.uid === uid);
    if (!m || m.estado !== 'cumprida') return this.hub();
    this.concluirMissao(m);
    this.say('{local_retorno}');
    this.hub();
  }

  concluirMissao(m) {
    const s = this.s, npc = contratante(this, m);
    this.say(textoMissao(this, m, 'conclusao'));
    this.say('{missao_entregue}');
    R.aplicarEfeitos(this, [{ ouro: m.ouro }, { xp: m.xp }]);
    if (m.item && !s.morto) R.darItem(this, { tier: m.tier });
    mudarDisposicao(this, npc, 2);
    s.missoes = s.missoes.filter((x) => x.uid !== m.uid);
    this.diary(`Missão concluída: ${m.titulo}.`);
  }

  /** Missões "chegar": entrega automática ao alcançar o destino. */
  entregasNaChegada() {
    const s = this.s;
    for (const m of [...s.missoes]) {
      if (m.objetivo !== 'chegar' || m.destino !== s.local) continue;
      const pacote = s.heroi.inventario.find((i) => i.missao === m.uid);
      if (!pacote) {
        s.missoes = s.missoes.filter((x) => x.uid !== m.uid);
        mudarDisposicao(this, contratante(this, m), -2);
        this.note(`Missão falhou: o pacote se perdeu (${m.titulo})`, 'dano');
        this.diary(`Falhei com ${contratante(this, m)?.nome}: ${m.titulo}.`);
        continue;
      }
      removeItem(s.heroi, pacote.uid);
      this.concluirMissao(m);
    }
  }

  abandonarMissao(uid) {
    const s = this.s, m = s.missoes.find((x) => x.uid === uid);
    if (!m || s.morto) return;
    this.out = [];
    s.missoes = s.missoes.filter((x) => x.uid !== uid);
    const pacote = s.heroi.inventario.find((i) => i.missao === uid);
    if (pacote) removeItem(s.heroi, pacote.uid);
    mudarDisposicao(this, contratante(this, m), -1);
    this.note(`Missão abandonada: ${m.titulo}`, 'dano');
    this.diary(`Desisti de uma missão: ${m.titulo}.`);
    this.refreshOptions(this.out);
  }

  // ---------- Inventário (fora do fluxo de escolhas) ----------
  /** Reconstrói só as opções da cena atual (ex.: após usar/equipar item). */
  refreshOptions(extraBlocos = []) {
    const blocos = [...(this.s.cena?.blocos || []), ...extraBlocos];
    const modo = this.s.cena?.modo;
    this.out = [];
    if (modo === 'evento') this.commit('evento', this.eventOptions(this.c.eventMap[this.s.evento.id]));
    else if (modo === 'combate') this.combatScene();
    else if (modo === 'mercado') this.marketScene();
    else if (modo === 'trabalho') this.workScene();
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
