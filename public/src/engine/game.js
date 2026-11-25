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
import { fronteirasLivres, modelosPara, gerarRegiao, TEMPO_DESBRAVAR, CHANCE_MASMORRA } from './regioes.js';
import { MOTIVO_BLOQUEIO } from './mundo.js';
import { pessoasFixas, presente } from './npcs.js';
import { estabelecimentos, atividadesDoMomento, estabDaAtividade, varEstab, concluirAtividade } from './atividades.js';
import * as R from './rules.js';

const PESO_AUTORAL = 12;
// Como dizer ao jogador o que falta para uma opção trancada.
const FALTA = { item_tag: (v) => `precisa: ${String(v).replace(/_/g, ' ')}`, ouro_min: (v) => `precisa de ${v} ouro`,
  nivel_min: (v) => `nível ${v}`, ferido: (v) => (v ? 'só ferido' : 'só sem ferimentos') };
export const SAVE_VERSION = 3; // v3: mundo autoral (Semente do Mundo); saves anteriores são zerados
const RECENTES = 6;
const NOME_ATRIBUTO = { forca: 'força', agilidade: 'agilidade', mente: 'mente', presenca: 'presença' };
const ESTOQUE_FIXO = ['racao', 'pocao_menor', 'pocao', 'tocha', 'corda'];

export function newState(content, { classe, nome, genero = 'm', seed = String(Date.now()) }) {
  const cls = content.classes.find((c) => c.id === classe) || content.classes[0];
  const s = {
    versao: SAVE_VERSION, seed, rng: hashSeed(seed), dia: 1, periodo: 'manha', clima: 'limpo',
    local: content.inicio || START_LOCATION, fios: [], flags: {}, diario: [], memoria: {}, recentes: [],
    caos: 5, uid: 0, mercados: {}, cena: null, combate: null, evento: null, morto: false,
    visitados: [content.inicio || START_LOCATION], locais: {}, conexoesExtra: {}, npcs: {}, missoes: [], ofertas: {},
    aposCombate: null, combateMissao: null, estabs: {}, estabsVistos: {}, atvOferta: {}, atvFeitas: {}, regioes: {}, fronteirasUsadas: {}, masmorras: {},
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
  const ini = content.location(s);
  g.diary(`${nome} parte ${gvar(ini.nome, ini.genero, { art: ini.artigo ?? true, plural: !!ini.plural }).do_nome} em busca de seu destino.`);
  g.begin();
  g.descreverLocal();
  g.hub();
  return s;
}

export class Game {
  constructor(content, state) {
    this.c = content;
    this.s = state;
    // Campos adicionados depois da v2 (saves antigos continuam válidos).
    state.estabs ||= {}; state.estabsVistos ||= {}; state.atvOferta ||= {}; state.atvFeitas ||= {};
    state.regioes ||= {}; state.fronteirasUsadas ||= {}; state.masmorras ||= {};
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
    for (const x of this.tagsExtra || []) t.add(x);
    if (h.hp <= h.hpMax / 2) t.add('ferido');
    if (h.exaustao >= 3) t.add('exausto');
    for (const e of s.estabs?.[s.local] || []) t.add(`estab_${e.id}`);
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
    if (s.evento?.estab) this.vars.estab = varEstab(this, s.evento.estab);
    // Fatos da bíblia do lugar para os textos: {$lugar.problema}, {$lugar.governante}, {$lugar.rumor}…
    this.vars.lugar = l.biblia?.fatos || {};
  }

  /** Descrição do lugar: a da bíblia (escrita para ele) ou a genérica por bioma. */
  descreverLocal() {
    const l = this.c.location(this.s);
    this.say(l.biblia?.descricoes?.length ? this.rng.pick(l.biblia.descricoes) : '{local_desc}');
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
  /** dados = { d1, d2, mod, total, atributo } (opcional; a UI desenha os dados). */
  roll(texto, classe, dados = null) { this.out.push({ tipo: 'rolagem', texto, classe, ...(dados || {}) }); }
  diary(texto) { this.s.diario.push({ dia: this.s.dia, periodo: this.s.periodo, texto }); }

  begin() { this.out = []; this.pendingCombat = null; this.pendingScene = null; this.pendingPortal = null; this.semSair = false; this.cenaCtx = novaCena(); }
  commit(modo, opcoes) {
    if (this.s.morto) { modo = 'morte'; opcoes = []; this.say('{epitafio}'); }
    else {
      const livres = opcoes.filter((o) => !o.desativada);
      if (livres.length === 1 && !(modo === 'evento' && /^(seguir|deixar|ir embora|partir|sair)/i.test(livres[0].rotulo) && opcoes.length > 1))
        opcoes = [...opcoes, ...this.segundaOpcao(modo, livres[0])];
    }
    this.s.cena = { modo, blocos: this.out, opcoes };
    this.s.rng = this.rng.s;
  }
  opt(rotulo, acao, extra = {}) { return { rotulo: this.label(rotulo), acao, ...extra }; }

  /** Nunca uma opção só: sempre há uma alternativa real (deixar a cena, ir a outro canto, voltar ao lugar). */
  segundaOpcao(modo, unica) {
    const t = unica.acao?.tipo;
    if (modo === 'evento') return [this.opt('Deixar para lá', { tipo: 'deixar' }, { dica: 'sem consequências' })];
    if (modo === 'local') {
      if (t === 'menu' && (this.s.lugarOpcoes || []).some((o) => o.grupo === 'ir')) return [this.opt('Ir a outro canto {$local.do_nome}', { tipo: 'menu', grupo: 'ir' })];
      return [this.opt('Explorar {$local.o_nome}', { tipo: 'explorar' })];
    }
    if (t !== 'sair') return [this.opt('Voltar {$local.ao_nome}', { tipo: 'sair' })];
    return [this.opt('Explorar {$local.o_nome}', { tipo: 'explorar' })];
  }
  act_deixar() {
    this.say(this.rng.pick(['Você deixa a coisa como está e segue.', 'Nem toda porta precisa ser aberta. Você se afasta.', 'Você respira fundo e decide não se meter.']));
    this.s.evento = null;
    this.retorno(true); this.hub();
  }

  // ---------- Cenas ----------
  hub() {
    const s = this.s, l = this.c.location(s), h = s.heroi;
    s.evento = null;
    const todas = []; // todas as ações do lugar, cada uma num grupo; a tela mostra no máximo 4 por vez
    const add = (grupo, op) => todas.push({ ...op, grupo });
    add('topo', this.opt('Explorar {$local.o_nome}', { tipo: 'explorar' }));
    // Missões que podem ser cumpridas ou entregues aqui.
    for (const m of s.missoes) {
      if (m.estado === 'ativa' && m.destino === s.local && m.objetivo !== 'chegar') {
        add('ir', this.opt(`${m.objetivo === 'vencer' ? 'Cumprir' : 'Investigar'}: ${m.titulo}`, { tipo: 'missao_cumprir', uid: m.uid }, { dica: 'missão', destaque: true }));
      }
      if (m.estado === 'cumprida' && m.origem === s.local) {
        add('ir', this.opt(`Entregar a missão a ${contratante(this, m)?.nome}`, { tipo: 'missao_entregar', uid: m.uid }, { dica: `${m.ouro} ouro`, destaque: true }));
      }
    }
    // Sub-lugares escritos (nível ≥ 2): cada um é um destino dentro do lugar, com pessoas e atividades próprias.
    estabelecimentos(this, l);
    const comSub = l.sublugares?.length > 0;
    if (comSub) { pessoasFixas(this, l); for (const sub of l.sublugares) add('ir', this.opt(`Ir ${sub.ao || 'a'} ${sub.nome}`, { tipo: 'sublugar', id: sub.id }, { dica: sub.dica || '' })); }
    // Atividades do momento (storylets sorteados pelo contexto); com sub-lugares, só as que não dependem de um.
    for (const id of atividadesDoMomento(this).filter((x) => !comSub || !this.c.eventMap[x]?.requer?.estab)) {
      const ev = this.c.eventMap[id], estab = estabDaAtividade(s, ev);
      this.vars.estab = estab ? varEstab(this, estab) : null;
      const tempo = ev.tempo ?? 1;
      add('ir', this.opt(ev.rotulo, { tipo: 'atividade', id }, { dica: ev.dica || (tempo ? `${tempo} período(s)` : ''), atividade: true }));
    }
    // Mercado e trabalho fecham na madrugada.
    const fechado = s.periodo === 'madrugada';
    if (l.tags?.includes('mercado')) add('ir', this.opt('Visitar o mercado', { tipo: 'mercado' }, fechado ? { dica: 'fechado até de manhã', desativada: true } : {}));
    if (l.tags?.includes('seguro') && this.c.quests.length) add('ir', this.opt('Procurar trabalho', { tipo: 'trabalho' }, fechado ? { dica: 'ninguém contrata de madrugada', desativada: true } : { dica: `${s.missoes.length}/${MAX_ATIVAS} missões` }));
    // Viagem: rotas do lugar; no mundo autoral, destinos ainda não construídos aparecem bloqueados.
    const MEIO = { mar: ' · de barco', magia: ' · magia' };
    for (const cx of conexoes(this, s.local)) {
      const d = this.loc(cx.para);
      if (!d) continue;
      const v = gvar(d.nome, d.genero, { art: d.artigo ?? true, plural: !!d.plural });
      const novo = !s.visitados.includes(d.id);
      const bloqueado = d.autoral && !d.jogavel;
      const tempo = cx.tempo ?? 1;
      add('viajar', this.opt(`Viajar para ${v.o_nome}`, { tipo: 'viajar', para: d.id }, bloqueado
        ? { dica: MOTIVO_BLOQUEIO[cx.tipo] || 'ainda inacessível', desativada: true }
        : { dica: `${tempo ? `${tempo} período(s)` : 'perto'}${MEIO[cx.tipo] || ''}${novo ? ' · inexplorado' : ''}` }));
    }
    // Fronteira (mundo procedural clássico): caminho para terras ainda não geradas.
    if (fronteirasLivres(this, l) && modelosPara(this, l).length) {
      add('viajar', this.opt('Desbravar as terras além {$local.do_nome}', { tipo: 'desbravar' }, { dica: `desconhecido · ${TEMPO_DESBRAVAR} período(s)` }));
    }
    if (h.prestigioPendente) add('descansar', this.opt('Refletir sobre o seu caminho', { tipo: 'prestigio' }, { dica: 'classe de prestígio', destaque: true }));
    add('descansar', this.opt('Descansar um pouco', { tipo: 'descansar' }, { dica: 'curto' }));
    if (!l.tags?.includes('seguro')) {
      const temRacao = h.inventario.some((i) => i.tags?.includes('racao'));
      add('descansar', this.opt('Acampar até o amanhecer', { tipo: 'acampar' }, { dica: temRacao ? 'gasta 1 ração' : 'sem ração: descanso ruim' }));
    }
    if (l.tags?.includes('estalagem')) {
      add('descansar', this.opt('Dormir na estalagem', { tipo: 'estalagem' }, { dica: h.ouro < R.PRECO_ESTALAGEM ? `${R.PRECO_ESTALAGEM} ouro · faltam ${R.PRECO_ESTALAGEM - h.ouro}` : `${R.PRECO_ESTALAGEM} ouro`, desativada: h.ouro < R.PRECO_ESTALAGEM }));
    }
    s.lugarOpcoes = todas;
    this.commit('local', this.menuTopo(todas));
  }

  /** Dentro de um sub-lugar: descrição, quem está lá agora e o que dá para fazer (no máximo 4 opções). */
  act_sublugar({ id }) {
    const s = this.s, l = this.c.location(s), sub = l.sublugares?.find((x) => x.id === id);
    if (!sub) return this.hub();
    s.sublugar = id;
    estabelecimentos(this, l);
    const descr = sub.descricoes?.length ? this.rng.pick(sub.descricoes) : sub.descricao || '';
    if (descr) { this.vars.estab = sub.estab ? varEstab(this, sub.estab) : null; this.say(descr); }
    const ops = [];
    const aqui = pessoasFixas(this, l).filter((n) => n.sublugar === id && presente(n, s.periodo));
    for (const n of aqui.slice(0, 1)) {
      const p = l.biblia.pessoas.find((x) => `fixo_${l.id}_${x.id}` === n.id);
      if (p?.evento && this.c.eventMap[p.evento]) ops.push(this.opt(`Falar com ${n.nome}`, { tipo: 'conversa', id: p.evento, npc: n.id }, { dica: p.papel || '' }));
      else this.note(`${n.nome} está aqui.`, '');
    }
    // Atividades deste sub-lugar: as escritas para o lugar primeiro, depois as genéricas do estabelecimento.
    const atv = sub.estab ? this.c.events.filter((ev) => ev.tipo === 'atividade' && [ev.requer?.estab].flat().includes(sub.estab)
      && !(s.atvFeitas[ev.id] != null && s.dia - s.atvFeitas[ev.id] < (ev.recarga ?? 2)) && check(ev.requer, s, this.c)) : [];
    const autorais = atv.filter((ev) => ev.requer?.local), genericas = atv.filter((ev) => !ev.requer?.local);
    if (genericas.length) autorais.push(this.rng.pick(genericas));
    atv.length = 0; atv.push(...autorais);
    for (const ev of atv.slice(0, 3 - ops.length)) {
      this.vars.estab = varEstab(this, sub.estab);
      ops.push(this.opt(ev.rotulo, { tipo: 'atividade', id: ev.id }, { dica: ev.dica || `${ev.tempo ?? 1} período(s)`, atividade: true }));
    }
    if (!ops.length) this.say(sub.vazio || 'Nada chama sua atenção por aqui agora.');
    ops.push(this.opt('Voltar', { tipo: 'menu', grupo: null }));
    this.commit('local', ops);
  }

  /** Classe de prestígio: até 3 caminhos possíveis (fixos até a escolha) e "decidir depois". */
  act_prestigio() {
    const s = this.s, h = s.heroi;
    const poss = R.prestigiosPossiveis(this);
    if (!h.prestigioPendente || !poss.length) return this.hub();
    if (!h.prestigioOpcoes?.every((id) => poss.some((p) => p.id === id))) {
      const resto = [...poss]; h.prestigioOpcoes = [];
      while (resto.length && h.prestigioOpcoes.length < 3) h.prestigioOpcoes.push(resto.splice(Math.floor(this.rng.next() * resto.length), 1)[0].id);
    }
    this.say('Você se senta longe do barulho e pensa no que tem sido, e no que pode vir a ser. Alguns caminhos se mostram.');
    const ops = h.prestigioOpcoes.map((id) => this.c.prestigios.find((p) => p.id === id)).map((p) =>
      this.opt(`Tornar-se ${p.nome[h.genero] || p.nome.m}`, { tipo: 'virar_prestigio', id: p.id }, { dica: `${p.descricao} ${this.c.traits[p.traco]?.descricao || ''}`.trim() }));
    ops.push(this.opt('Decidir mais tarde', { tipo: 'menu', grupo: null }));
    this.commit('local', ops);
  }
  act_virar_prestigio({ id }) {
    const h = this.s.heroi, p = this.c.prestigios.find((x) => x.id === id);
    if (!p || !h.prestigioPendente) return this.hub();
    R.tornarPrestigio(this, p);
    const nome = p.nome[h.genero] || p.nome.m;
    this.say(`${p.descricao} A partir de hoje, você é ${nome}.`);
    this.note(nome, 'xp nivel');
    this.diary(`Tornei-me ${nome}.`);
    this.hub();
  }

  /** Conversa com uma pessoa fixa: abre o evento escrito para ela, com ela como $npc. */
  act_conversa({ id, npc }) {
    const ev = this.c.eventMap[id];
    if (!ev) return this.hub();
    const n = this.s.npcs[npc];
    if (n) { n.encontros++; n.visto = this.s.dia; }
    this.eventScene({ ...ev, npc: undefined }, n ? { npc: n.id, npcNovo: n.encontros <= 1 } : null);
  }

  /** Tela principal do lugar: no máximo 4 opções (grupos de uma ação só aparecem direto). */
  menuTopo(todas) {
    const grupo = (g) => todas.filter((o) => o.grupo === g);
    const ops = grupo('topo');
    const TITULO = { ir: 'Ir a algum lugar {$local.no_nome}', viajar: 'Viajar…', descansar: 'Descansar…' };
    for (const g of ['ir', 'viajar', 'descansar']) {
      const lista = grupo(g);
      if (!lista.length) continue;
      if (lista.length === 1) { ops.push(lista[0]); continue; }
      const livres = lista.filter((o) => !o.desativada).length;
      const destaque = lista.some((o) => o.destaque);
      const dica = g === 'viajar' ? `${livres} ${livres === 1 ? 'caminho' : 'caminhos'}` : destaque ? (g === 'descansar' ? 'novo caminho!' : 'missão aqui') : `${livres} ${livres === 1 ? 'opção' : 'opções'}`;
      ops.push(this.opt(g === 'ir' && !this.c.location(this.s).tags?.includes('seguro') ? 'Fazer algo por aqui…' : TITULO[g], { tipo: 'menu', grupo: g }, { dica, destaque, desativada: !livres }));
    }
    return ops;
  }

  /** Submenu de um grupo, paginado para nunca passar de 4 opções. */
  act_menu({ grupo = null, pagina = 0 }) {
    const blocos = this.s.cena?.blocos || [];
    if (!grupo) { this.out = [...blocos]; this.hub(); this.s.cena.navegacao = true; return; }
    const lista = (this.s.lugarOpcoes || []).filter((o) => o.grupo === grupo);
    const porPagina = lista.length <= 3 ? 3 : 2;
    const total = Math.max(1, Math.ceil(lista.length / porPagina));
    const p = pagina % total;
    const ops = lista.slice(p * porPagina, p * porPagina + porPagina);
    if (total > 1) ops.push(this.opt('Ver outras opções…', { tipo: 'menu', grupo, pagina: p + 1 }, { dica: `${p + 1}/${total}` }));
    ops.push(this.opt('Voltar', { tipo: 'menu', grupo: null }));
    this.out = [...blocos];
    this.commit('local', ops);
    this.s.cena.navegacao = true; // só navegação de menu: a interface não trata como cena nova
  }

  /** Executa uma ação do lugar diretamente (mapa, atalhos, testes), se ela estiver disponível agora. */
  agir(acao) {
    const s = this.s;
    const igual = (a) => a.tipo === acao.tipo && (a.para ?? a.id ?? a.uid ?? null) === (acao.para ?? acao.id ?? acao.uid ?? null);
    const op = [...(s.cena?.opcoes || []), ...(s.cena?.modo === 'local' ? s.lugarOpcoes || [] : [])].find((o) => igual(o.acao));
    if (!op || op.desativada || s.morto) return false;
    this.begin();
    const handler = this[`act_${op.acao.tipo}`];
    if (!handler) throw new Error(`Ação desconhecida: ${op.acao.tipo}`);
    handler.call(this, op.acao);
    s.turno = (s.turno || 0) + 1;
    return true;
  }

  /** Abre um evento. `herdar` mantém o NPC do passo anterior de uma cadeia. */
  eventScene(ev, herdar = null, extra = {}) {
    let npc = null, npcNovo = false;
    if (ev.npc) { const r = vincularNpc(this, ev.npc); npc = r.npc.id; npcNovo = r.novo; }
    else if (herdar?.npc) { npc = herdar.npc; npcNovo = herdar.npcNovo; }
    this.s.evento = { id: ev.id, npc, npcNovo, ...extra };
    this.say(ev.texto);
    this.commit('evento', this.eventOptions(ev));
  }
  eventOptions(ev) {
    const dicaTeste = (o) => (o.teste ? { dica: `teste: ${NOME_ATRIBUTO[o.teste] || o.teste}`, teste: o.teste } : {});
    const todas = ev.opcoes.map((o, i) => ({ o, i }));
    const ops = todas.filter(({ o }) => check(o.requer, this.s, this.c)).map(({ o, i }) => this.opt(o.rotulo, { tipo: 'opcao', idx: i }, dicaTeste(o)));
    // Poucas saídas? Mostra as que exigem algo visível (item, ouro, nível), trancadas, para o jogador saber o que falta.
    if (ops.length < 2) {
      for (const { o, i } of todas) {
        if (!o.requer || check(o.requer, this.s, this.c)) continue;
        const falta = Object.keys(o.requer).filter((k) => !check({ [k]: o.requer[k] }, this.s, this.c));
        if (!falta.every((k) => FALTA[k])) continue;
        ops.push(this.opt(o.rotulo, { tipo: 'opcao', idx: i }, { desativada: true, dica: falta.map((k) => FALTA[k](o.requer[k])).join(' · ') }));
        if (ops.length >= 4) break;
      }
    }
    return ops;
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
      { dica: h.ouro < precoCompra(it) ? `${precoCompra(it)} ouro · faltam ${precoCompra(it) - h.ouro}` : `${precoCompra(it)} ouro`, desativada: h.ouro < precoCompra(it), item: it }));
    // Itens iguais (mesmo nome e valor) viram uma opção só: "Vender Mapa rabiscado (3)".
    const grupos = new Map();
    for (const it of h.inventario) {
      if (Object.values(h.equipado).includes(it.uid) || it.tags?.includes('missao')) continue;
      const k = `${it.nome}|${it.valor}`;
      if (grupos.has(k)) grupos.get(k).n++; else grupos.set(k, { it, n: 1 });
    }
    for (const { it, n } of grupos.values()) {
      ops.push(this.opt(`Vender ${it.nome}${n > 1 ? ` (${n})` : ''}`, { tipo: 'vender', uid: it.uid }, { dica: `+${precoVenda(it)} ouro`, item: it }));
    }
    ops.push(this.opt('Sair do mercado', { tipo: 'sair' }));
    this.commit('mercado', ops);
  }

  estoque() {
    const s = this.s, m = s.mercados[s.local];
    if (m && m.dia === s.dia) return m.itens;
    const itens = ESTOQUE_FIXO.filter((id) => this.c.items.bases.some((b) => b.id === id))
      .map((id) => generateItem(this.c, this.rng, s, { base: id, raridade: 'comum' }));
    for (let i = 0, tent = 0; i < 3 && tent < 9; tent++) {
      const it = generateItem(this.c, this.rng, s, { tier: Math.min(3, 1 + Math.floor(s.heroi.nivel / 2)), slot: this.rng.pick(SLOTS_EQUIP) });
      if (!itens.some((x) => x.nome === it.nome)) { itens.push(it); i++; } // sem repetidos na banca
    }
    s.mercados[s.local] = { dia: s.dia, itens };
    return itens;
  }

  workScene() {
    const s = this.s, cheio = s.missoes.length >= MAX_ATIVAS;
    const ops = ofertas(this).map((m) => {
      const d = this.loc(m.destino);
      const semEspaco = m.objetivo === 'chegar' && s.heroi.inventario.length >= LIMITE_INVENTARIO;
      return this.opt(`Ouvir: ${m.titulo}`, { tipo: 'oferta', uid: m.uid },
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
    // Eventos escritos para este lugar (requer.local) pesam muito mais que os genéricos.
    const ev = this.rng.weighted(fresh.length ? fresh : pool, (e) => (e.peso ?? 1) * (e.requer?.local ? PESO_AUTORAL : 1));
    if (ev) { this.s.recentes.push(ev.id); while (this.s.recentes.length > RECENTES) this.s.recentes.shift(); }
    return ev;
  }

  /** Gasta n de energia; o que faltar vira exaustão. Uma nota só para cada recurso ("−2 energia"). */
  gastarEnergia(n) {
    const h = this.s.heroi, deEnergia = Math.min(n, h.energia);
    if (deEnergia) R.energia(this, -deEnergia);
    if (n - deEnergia) R.exaustao(this, n - deEnergia);
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

  /** Texto de volta ao menu do lugar: chegada (se a viagem foi interrompida por um evento no caminho),
   *  fechamento curto (algo feito dentro do povoado) ou retorno de uma exploração. */
  retorno(dentro = false) {
    if (this.s.chegadaPendente) { this.s.chegadaPendente = false; this.say('{chegada}'); return; }
    this.say(dentro ? '{apos_atividade}' : '{local_retorno}');
  }

  /** Após resolver algo: combate pendente, próxima cena da cadeia, morte ou volta ao local. */
  afterResolve() {
    if (this.s.morto) return this.commit('morte', []);
    const herdar = this.s.evento;
    if (this.pendingPortal && !this.pendingCombat) return this.atravessarPortal(this.pendingPortal);
    if (this.pendingCombat) {
      // O que vem depois da luta (próxima cena da cadeia e/ou portal) fica no estado: só acontece se vencer.
      this.s.aposCombate = this.pendingScene || this.pendingPortal
        ? { id: this.pendingScene || null, npc: herdar?.npc, npcNovo: false, portal: this.pendingPortal || null } : null;
      this.pendingPortal = null;
      R.iniciarCombate(this, this.pendingCombat);
      return this.combatScene();
    }
    if (this.pendingScene && this.c.eventMap[this.pendingScene]) {
      return this.eventScene(this.c.eventMap[this.pendingScene], herdar && { ...herdar, npcNovo: false });
    }
    this.retorno(this.semSair || this.c.eventMap[herdar?.id]?.tipo === 'atividade');
    this.hub();
  }

  /** Atividade do lugar: gasta o tempo dela e abre a mini-cena (evento tipo "atividade"). */
  act_atividade({ id }) {
    const ev = this.c.eventMap[id];
    if (!ev || !(this.s.atvOferta[this.s.local]?.ids || []).includes(id)) return this.hub();
    concluirAtividade(this.s, id);
    const conhecido = estabDaAtividade(this.s, ev);
    if (conhecido) ((this.s.estabsVistos[this.s.local] ||= []).includes(conhecido) || this.s.estabsVistos[this.s.local].push(conhecido));
    if (ev.tempo ?? 1) R.avancarTempo(this, ev.tempo ?? 1);
    const estab = estabDaAtividade(this.s, ev);
    this.eventScene(ev, null, { estab });
  }

  /** Desbravar: gera uma região nova a partir da fronteira e chega à entrada dela. */
  act_desbravar() {
    const s = this.s, origem = this.c.location(s);
    const pool = modelosPara(this, origem);
    if (!fronteirasLivres(this, origem) || !pool.length) return this.hub();
    this.gastarEnergia(TEMPO_DESBRAVAR);
    R.avancarTempo(this, TEMPO_DESBRAVAR);
    if (s.morto) return this.commit('morte', []);
    const modelo = this.rng.weighted(pool);
    s.fronteirasUsadas[origem.id] = (s.fronteirasUsadas[origem.id] || 0) + 1;
    const entrada = gerarRegiao(this, origem, modelo);
    this.chegarEmRegiao(entrada, modelo, '{regiao_descoberta}');
  }

  /** Efeito `portal`: abre outro plano de existência e leva o herói até ele. */
  atravessarPortal(alvo) {
    this.pendingPortal = null;
    const origem = this.c.location(this.s);
    const planos = modelosPara(this, origem, { plano: true }).filter((m) => alvo === '*' || alvo === true || m.id === alvo);
    if (!planos.length) { this.retorno(); return this.hub(); }
    const modelo = this.rng.weighted(planos);
    const entrada = gerarRegiao(this, origem, modelo, { portal: true });
    this.chegarEmRegiao(entrada, modelo, '{portal_travessia}');
  }

  chegarEmRegiao(entrada, modelo, texto) {
    const s = this.s, bioma0 = this.c.location(s).bioma;
    s.local = entrada.id;
    marcarVisita(s, entrada.id);
    if (entrada.bioma !== bioma0) R.sortearClima(this);
    this.vars.destino = gvar(entrada.nome, entrada.genero, { art: entrada.artigo ?? true, plural: !!entrada.plural });
    this.say(texto);
    if (modelo.descricao) this.say(modelo.descricao);
    this.note(`Nova região: ${s.regioes[entrada.regiao].nome}`, 'fio');
    this.diary(`Cheguei a terras novas: ${s.regioes[entrada.regiao].nome}.`);
    R.ganharXp(this, 2);
    if (s.morto) return this.commit('morte', []);
    this.hub();
  }

  act_explorar() {
    this.gastarEnergia(1);
    R.avancarTempo(this, 1);
    this.tickFios();
    if (this.s.morto) return this.commit('morte', []);
    // Entrada de masmorra escondida (no máximo uma por local).
    const aqui = this.c.location(this.s);
    if (this.c.modo !== 'autoral' && !aqui.tags?.includes('seguro') && !aqui.tags?.includes('masmorra') && !this.s.masmorras[aqui.id] && this.rng.chance(CHANCE_MASMORRA)) {
      const pool = modelosPara(this, aqui, { masmorra: true });
      if (pool.length) {
        const entrada = gerarRegiao(this, aqui, this.rng.weighted(pool));
        this.s.masmorras[aqui.id] = entrada.regiao;
        this.vars.poi = gvar(entrada.nome, entrada.genero, { art: entrada.artigo ?? true });
        this.say('{masmorra_descoberta}');
        this.note(`Novo local no mapa: ${entrada.nome}`, 'fio');
        this.diary(`Encontrei a entrada ${gvar(entrada.nome, entrada.genero).do_nome}.`);
        return this.hub();
      }
    }
    const poi = descobrirPoi(this);
    if (poi) {
      this.say('{poi_descoberta}');
      this.note(`Novo local no mapa: ${poi.nome}`, 'fio');
      this.diary(`Descobri ${gvar(poi.nome, poi.genero).o_nome}.`);
      return this.hub();
    }
    const ev = this.emergirFio() || this.sortearEvento('exploracao');
    if (!ev) { this.retorno(); return this.hub(); }
    this.eventScene(ev);
  }

  act_viajar({ para }) {
    const origem = this.c.location(this.s);
    const cx = conexoes(this, origem.id).find((x) => x.para === para);
    const destino = this.loc(para);
    if (!cx || !destino || (destino.autoral && !destino.jogavel)) return this.hub();
    const tempo = cx.tempo ?? 1; // 0 = salas de masmorra e portais
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
    // Um encontro no caminho acontece antes da chegada; a chegada é narrada quando ele termina.
    const ev = this.emergirFio() || (this.rng.chance(mudouBioma ? 0.6 : 0.25) ? this.sortearEvento('viagem') : null);
    if (ev) { this.s.chegadaPendente = true; this.entregasNaChegada(); if (this.s.morto) return this.commit('morte', []); return this.eventScene(ev); }
    this.say('{chegada}');
    this.entregasNaChegada();
    if (this.s.morto) return this.commit('morte', []);
    this.descreverLocal();
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
    if (r === 'vitoria' && apos?.portal && !s.morto) return this.atravessarPortal(apos.portal);
    if (r === 'vitoria' && apos && this.c.eventMap[apos.id]) return this.eventScene(this.c.eventMap[apos.id], apos);
    if (s.morto) return this.commit('morte', []);
    this.retorno();
    this.hub();
  }

  act_descansar() {
    this.semSair = true; // descansou no lugar: nada de "você volta a…"
    const emb = R.descansoCurto(this);
    if (emb) this.pendingCombat = emb;
    this.afterResolve();
  }
  act_acampar() {
    this.semSair = true;
    const emb = R.acampar(this);
    if (emb) this.pendingCombat = emb;
    this.afterResolve();
  }
  act_estalagem() { this.semSair = true; R.estalagem(this); this.afterResolve(); }

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
  act_sair() { this.retorno(true); this.hub(); }

  // ---------- Missões ----------
  act_trabalho() { this.say('{trabalho_intro}'); this.workScene(); }

  /** Proposta: o contratante explica o serviço antes de você decidir. */
  act_oferta({ uid }) {
    const s = this.s, m = ofertas(this).find((x) => x.uid === uid);
    if (!m || s.missoes.length >= MAX_ATIVAS) return this.workScene();
    this.say(textoMissao(this, m, 'pedido'));
    this.note(`Recompensa: ${m.ouro} ouro · ${m.xp} XP`, 'ouro');
    const semEspaco = m.objetivo === 'chegar' && s.heroi.inventario.length >= LIMITE_INVENTARIO;
    this.commit('trabalho', [
      this.opt('Aceitar o serviço', { tipo: 'aceitar', uid }, { destaque: true, desativada: semEspaco, dica: semEspaco ? 'mochila cheia' : '' }),
      this.opt('Recusar e ouvir outras propostas', { tipo: 'recusar', uid }),
      this.opt('Voltar', { tipo: 'sair' }),
    ]);
  }
  act_recusar({ uid }) {
    const m = ofertas(this).find((x) => x.uid === uid);
    if (m) { varsMissao(this, m); this.npcCtx = { npc: contratante(this, m), novo: true }; this.say('{missao_recusada}'); this.npcCtx = null; }
    this.workScene();
  }

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
    varsMissao(this, m);
    this.npcCtx = { npc, novo: false };
    this.say('{missao_aceita}');
    this.npcCtx = null;
    this.note(`Nova missão: ${m.titulo}`, 'fio');
    this.diary(`Aceitei uma missão de ${npc.nome}: ${m.titulo}.`);
    this.retorno(true);
    this.hub();
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
    this.retorno(true);
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
