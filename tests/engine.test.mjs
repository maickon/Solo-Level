import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { Rng } from '../public/src/engine/rng.js';
import { expand, gvar } from '../public/src/engine/grammar.js';
import { markovName } from '../public/src/engine/names.js';
import { buildContent, validate, REQUIRED_TABLES } from '../public/src/engine/content.js';
import { generateItem } from '../public/src/engine/items.js';
import { newState, Game } from '../public/src/engine/game.js';
import { stats } from '../public/src/engine/hero.js';
import * as R from '../public/src/engine/rules.js';
import { loadNodeContent, PACKS_DIR } from '../tools/node-content.mjs';
import { simulate } from '../tools/simulate.mjs';

// ---------- Fixture mínima ----------
const T = (s) => [s];
const grammar = Object.fromEntries(REQUIRED_TABLES.map((k) => [k, T(`${k}.`)]));
const fixture = () => buildContent({
  classes: [{ id: 'g', nome: { m: 'G', f: 'G' }, atributos: { forca: 2, agilidade: 0, mente: 0, presenca: 0 },
    hp: 10, energia: 5, inicial: [{ base: 'espada' }, { base: 'racao', qtd: 2 }], tracos: ['forte'] }],
  traits: [{ id: 'forte', nome: 'Forte', mods: { forca: 1 } }],
  biomes: [{ id: 'vila', nome: 'Vila', perigo: 0, clima: { limpo: 1 }, inimigos: [] },
    { id: 'mata', nome: 'Mata', perigo: 3, clima: { chuva: 1 }, inimigos: ['lobo'] }],
  locations: [{ id: 'vila_bruma', nome: 'Vila', genero: 'f', bioma: 'vila', tags: ['seguro', 'mercado', 'estalagem'], x: 50, y: 80, conexoes: [{ para: 'mata1', tempo: 1 }] },
    { id: 'mata1', nome: 'Mata', genero: 'f', bioma: 'mata', tags: [], x: 50, y: 40, conexoes: [{ para: 'vila_bruma', tempo: 1 }, { para: 'vila2', tempo: 1 }] },
    { id: 'vila2', nome: 'Porto', genero: 'm', bioma: 'vila', tags: ['seguro'], x: 80, y: 40, conexoes: [{ para: 'mata1', tempo: 1 }] }],
  enemies: [{ id: 'lobo', nome: 'lobo', genero: 'm', hp: 4, dano: '1d2', tier: 1, xp: 9, ouro: '1d2', saque: 1 }],
  events: [{ id: 'e1', tipo: 'exploracao', texto: 'Algo.', opcoes: [
    { rotulo: 'Testar', teste: 'forca', sucesso: { texto: 'ok', efeitos: [{ xp: 1 }] }, parcial: { texto: 'meh', efeitos: [] }, falha: { texto: 'ai', efeitos: [{ dano: '1' }] } },
    { rotulo: 'Lutar', resultado: { texto: 'Vem!', efeitos: [{ combate: 'lobo' }] } },
    { rotulo: 'Corda', requer: { item_tag: 'corda' }, resultado: { texto: 'x', efeitos: [] } },
    { rotulo: 'Seguir', resultado: { texto: 'Você segue.', efeitos: [{ cena: 'e2' }] } }] },
    { id: 'e2', tipo: 'cadeia', npc: { oficios: ['ferreiro'] }, texto: '{$npc.Nome}, {$npc.um} {$npc.oficio}.', opcoes: [
      { rotulo: 'Ajudar', resultado: { texto: 'ok', efeitos: [{ disposicao: 2 }] } },
      { rotulo: 'Lutar e seguir', resultado: { texto: 'luta', efeitos: [{ combate: 'lobo' }, { cena: 'e3' }] } }] },
    { id: 'e3', tipo: 'cadeia', texto: 'Fim da cadeia com {$npc.nome}.', opcoes: [{ rotulo: 'Fim', resultado: { texto: 'fim', efeitos: [] } }] },
    { id: 'p1', tipo: 'exploracao', requer: { local_tags: ['caverna'] }, texto: 'Caverna.', opcoes: [{ rotulo: 'Ok', resultado: { texto: 'ok' } }] },
    { id: 'p2', tipo: 'exploracao', requer: { local_tags: ['caverna'] }, texto: 'Caverna 2.', opcoes: [{ rotulo: 'Ok', resultado: { texto: 'ok' } }] }],
  npcs: { oficios: [{ id: 'ferreiro', m: 'ferreiro', f: 'ferreira' }, { id: 'guarda', m: 'guarda', f: 'guarda' }],
    temperamentos: [{ id: 'calmo', m: 'calmo', f: 'calma' }] },
  pois: [{ id: 'caverna', nome: 'Caverna Funda', genero: 'f', biomas: ['mata'], tags: ['caverna'] }],
  quests: [
    { id: 'cacar', objetivo: 'vencer', oficios: ['guarda'], titulo: 'Caçar {$alvo.nome}', pedido: '{$npc.nome} pede.', conclusao: 'Feito.', recompensa: { ouro: '5', xp: 2 } },
    { id: 'entregar', objetivo: 'chegar', oficios: ['ferreiro'], titulo: 'Levar a {$destino.nome}', pedido: 'Leve.', conclusao: 'Entregue.', recompensa: { ouro: '3', xp: 1 } }],
  threads: [],
  items: {
    raridades: [{ id: 'comum', peso: 60, afixos: 0, mult: 1 }, { id: 'raro', peso: 10, afixos: 2, mult: 4 }, { id: 'lendario', peso: 1, afixos: 3, mult: 10 }],
    bases: [{ id: 'espada', nome: 'espada', genero: 'f', slot: 'arma', atributo: 'forca', dano: '1d6', valor: 10 },
      { id: 'racao', nome: 'ração', genero: 'f', slot: 'consumivel', valor: 2, tags: ['racao'], efeitos: [{ energia: 1 }] },
      { id: 'pocao', nome: 'poção', genero: 'f', slot: 'consumivel', valor: 8, efeitos: [{ cura: '4' }] }],
    qualidades: [{ m: 'velho', f: 'velha', slots: ['arma'], mods: { dano: -1 } }],
    afixos: [{ texto: 'do Lobo', slots: ['arma'], mods: { agilidade: 1 } }, { texto: 'da Lua', slots: ['arma'], mods: { mente: 1 } }, { texto: 'do Rei', slots: ['arma'], mods: { forca: 1 } }],
  },
  grammar: { ...grammar, x: [{ m: 'cansado', f: 'cansada' }], tg: ['genérico', { t: 'chuvoso', tags: ['chuva'] }] },
  names: { pessoas: ['Aldric', 'Brenna', 'Cedric', 'Doran'], lugares: ['Valdor'], itens: ['Gram', 'Durin', 'Galdor', 'Morgul'] },
});

// ---------- Unidades ----------
test('rng é determinístico e rola notação de dados', () => {
  const a = new Rng('x'), b = new Rng('x');
  assert.deepEqual([a.next(), a.next()], [b.next(), b.next()]);
  for (let i = 0; i < 200; i++) { const v = a.roll('2d6+1'); assert.ok(v >= 3 && v <= 13); }
  assert.equal(a.roll(5), 5);
});

test('gramática: concordância, variáveis, tags e tabela ausente', () => {
  const c = fixture(), rng = new Rng(1);
  const ctx = (tags = []) => ({ rng, tables: c.grammar, vars: { heroi: gvar('Ana', 'f') }, tags: new Set(tags), memory: {} });
  assert.equal(expand('{$heroi.O} {$heroi.nome} está {x@heroi}.', ctx()), 'A Ana está cansada.');
  assert.equal(expand('{=lindo/linda@heroi}', ctx()), 'linda');
  assert.equal(expand('{tg}', ctx(['chuva'])), 'chuvoso');
  assert.equal(expand('{tg}', ctx()), 'genérico');
  assert.equal(expand('{nada}', ctx()), '[nada]');
});

test('markov gera nomes novos', () => {
  const n = markovName(new Rng(3), ['Aldric', 'Aldren', 'Baldric', 'Cedric', 'Edric', 'Garric']);
  assert.match(n, /^[A-Z][a-z]+$/);
});

test('gerador de itens respeita raridade e soma mods', () => {
  const c = fixture(), rng = new Rng(9), st = {};
  const it = generateItem(c, rng, st, { base: 'espada', raridade: 'raro' });
  assert.equal(it.slot, 'arma');
  assert.equal(it.raridade, 'raro');
  assert.ok(it.nome.startsWith('Espada'));
  const lend = generateItem(c, rng, st, { base: 'espada', raridade: 'lendario' });
  assert.match(lend.nome, /^[A-Z][a-z]+, Espada/);
  const pot = generateItem(c, rng, st, { base: 'pocao', raridade: 'raro' });
  assert.equal(pot.raridade, 'comum'); // consumível não recebe raridade
  assert.notEqual(it.uid, lend.uid);
});

test('novo jogo: equipa itens iniciais, aplica traço, cena válida', () => {
  const c = fixture();
  const s = newState(c, { classe: 'g', nome: 'Ana', genero: 'f', seed: 's1' });
  const st = stats(s.heroi, c);
  assert.equal(st.attrs.forca, 3); // 2 + traço
  assert.ok(st.arma);
  assert.equal(s.heroi.inventario.length, 3);
  assert.equal(s.cena.modo, 'local');
  assert.ok(s.cena.opcoes.some((o) => o.acao.tipo === 'viajar'));
  assert.ok(!s.cena.opcoes.some((o) => o.acao.tipo === 'acampar')); // vila é segura
});

test('opções com requer só aparecem quando a condição passa', () => {
  const c = fixture();
  const s = newState(c, { classe: 'g', nome: 'Ana', seed: 's2' });
  const g = new Game(c, s);
  g.begin(); g.eventScene(c.eventMap.e1);
  assert.equal(s.cena.opcoes.length, 3);
});

test('combate leva a vitória com xp, ouro e saque; morte encerra o jogo', () => {
  const c = fixture();
  const s = newState(c, { classe: 'g', nome: 'Ana', seed: 's3' });
  const g = new Game(c, s);
  g.begin(); g.eventScene(c.eventMap.e1);
  g.choose(s.cena.opcoes.findIndex((o) => o.rotulo === 'Lutar'));
  assert.equal(s.cena.modo, 'combate');
  for (let i = 0; i < 30 && s.cena.modo === 'combate'; i++) g.choose(0);
  assert.ok(s.morto || s.heroi.nivel >= 2);
  // morte
  g.begin(); R.dano(g, 999); g.commit('local', []);
  assert.equal(s.cena.modo, 'morte');
  assert.equal(s.heroi.hp, 0);
});

test('acampar consome ração, cura e avança para a manhã', () => {
  const c = fixture();
  const s = newState(c, { classe: 'g', nome: 'Ana', seed: 's4' });
  const g = new Game(c, s);
  s.local = 'mata1'; s.periodo = 'noite'; s.heroi.hp = 2; s.caos = 1;
  const racoes = s.heroi.inventario.filter((i) => i.tags.includes('racao')).length;
  g.begin(); R.acampar(g);
  assert.equal(s.periodo, 'manha');
  assert.equal(s.dia, 2);
  assert.ok(s.heroi.hp > 2);
  assert.equal(s.heroi.inventario.filter((i) => i.tags.includes('racao')).length, racoes - 1);
});

test('exaustão penaliza testes; energia zerada gera exaustão ao explorar', () => {
  const c = fixture();
  const s = newState(c, { classe: 'g', nome: 'Ana', seed: 's5' });
  const g = new Game(c, s);
  s.heroi.energia = 0;
  g.choose(s.cena.opcoes.findIndex((o) => o.acao.tipo === 'explorar'));
  assert.equal(s.heroi.exaustao, 1);
  s.heroi.exaustao = 3;
  assert.equal(stats(s.heroi, c).penalidade, 1);
});

test('fixture passa na validação', () => {
  const { errors } = validate(fixture());
  assert.deepEqual(errors, []);
});

test('crítico (6+6) e desastre (1+1) independem do total', () => {
  const c = fixture();
  const s = newState(c, { classe: 'g', nome: 'Ana', seed: 'c1' });
  const g = new Game(c, s);
  let crit = 0, des = 0;
  for (let i = 0; i < 2000; i++) {
    const t = R.teste(g, 'mente', { dificuldade: i % 2 ? 20 : -20 });
    if (t.especial === 'critico') { crit++; assert.equal(t.resultado, 'sucesso'); }
    if (t.especial === 'desastre') { des++; assert.equal(t.resultado, 'falha'); }
  }
  assert.ok(crit > 20 && des > 20);
});

test('cadeia: cena leva ao próximo evento, vincula NPC e continua após vencer combate', () => {
  const c = fixture();
  const s = newState(c, { classe: 'g', nome: 'Ana', seed: 'ch1' });
  const g = new Game(c, s);
  s.heroi.hpBase = 99; s.heroi.hp = 99; s.heroi.hpMax = 99;
  g.begin(); g.eventScene(c.eventMap.e1);
  g.choose(s.cena.opcoes.findIndex((o) => o.rotulo === 'Seguir'));
  assert.equal(s.evento.id, 'e2');
  const npc = s.npcs[s.evento.npc];
  assert.ok(npc && npc.oficio === 'ferreiro');
  assert.match(s.cena.blocos.at(-1).texto, /ferreir[oa]\.$/);
  g.choose(s.cena.opcoes.findIndex((o) => o.rotulo === 'Lutar e seguir'));
  assert.equal(s.cena.modo, 'combate');
  for (let i = 0; i < 40 && s.cena.modo === 'combate'; i++) g.choose(0);
  assert.equal(s.evento?.id, 'e3');
  assert.ok(s.cena.blocos.some((b) => b.texto.includes(npc.nome)));
});

test('NPC recorrente: reencontro marca npc_conhecido e guarda disposição', () => {
  const c = fixture();
  const s = newState(c, { classe: 'g', nome: 'Ana', seed: 'n1' });
  const g = new Game(c, s);
  let reencontro = false;
  for (let i = 0; i < 20 && !reencontro; i++) {
    g.begin(); g.eventScene(c.eventMap.e2);
    if (!s.evento.npcNovo) reencontro = true;
    g.choose(0); // Ajudar: +2 disposição
  }
  assert.ok(reencontro);
  assert.ok(Object.values(s.npcs).some((n) => n.disposicao >= 2 && n.encontros >= 2));
});

test('POI: explorar descobre local novo, conectado e com coordenadas', () => {
  const c = fixture();
  const s = newState(c, { classe: 'g', nome: 'Ana', seed: 'poi1' });
  const g = new Game(c, s);
  s.local = 'mata1';
  for (let i = 0; i < 80 && !Object.keys(s.locais).length && !s.morto; i++) {
    s.heroi.energia = 5; s.heroi.hp = s.heroi.hpMax;
    g.begin(); g.act_explorar();
    if (s.cena.modo !== 'local') { s.combate = null; g.begin(); g.hub(); }
  }
  const poi = Object.values(s.locais)[0];
  assert.ok(poi, 'nenhum POI descoberto');
  assert.ok(poi.tags.includes('poi') && poi.pai === 'mata1' && poi.x >= 3);
  assert.ok(s.cena.opcoes.some((o) => o.acao.para === poi.id));
  g.choose(s.cena.opcoes.findIndex((o) => o.acao.para === poi.id));
  assert.equal(s.local, poi.id);
  assert.ok(s.visitados.includes(poi.id));
});

test('missões: aceitar, cumprir (vencer) e entregar; entrega por chegada', () => {
  const c = fixture();
  const s = newState(c, { classe: 'g', nome: 'Ana', seed: 'q1' });
  const g = new Game(c, s);
  s.heroi.hpBase = 99; s.heroi.hp = 99; s.heroi.hpMax = 99;
  g.choose(s.cena.opcoes.findIndex((o) => o.acao.tipo === 'trabalho'));
  assert.equal(s.cena.modo, 'trabalho');
  assert.ok(s.cena.opcoes.some((o) => o.acao.tipo === 'aceitar'));
  const livre = () => s.cena.opcoes.findIndex((o) => o.acao.tipo === 'aceitar' && !o.desativada);
  while (livre() >= 0) g.choose(livre());
  assert.ok(s.missoes.length >= 1 && s.missoes.every((m) => s.npcs[m.npcId]));
  const ouro0 = s.heroi.ouro;
  const cacar = s.missoes.find((m) => m.objetivo === 'vencer');
  const entregar = s.missoes.find((m) => m.objetivo === 'chegar');
  assert.ok(cacar || entregar);
  if (cacar) {
    s.local = cacar.destino; g.begin(); g.hub();
    g.choose(s.cena.opcoes.findIndex((o) => o.acao.tipo === 'missao_cumprir'));
    for (let i = 0; i < 40 && s.cena.modo === 'combate'; i++) g.choose(0);
    assert.equal(cacar.estado, 'cumprida');
    s.local = cacar.origem; g.begin(); g.hub();
    g.choose(s.cena.opcoes.findIndex((o) => o.acao.tipo === 'missao_entregar'));
    assert.ok(!s.missoes.includes(cacar));
    assert.ok(s.heroi.ouro > ouro0);
  }
  if (entregar) {
    assert.ok(s.heroi.inventario.some((i) => i.missao === entregar.uid));
    s.local = 'mata1'; g.begin(); g.hub();
    g.choose(s.cena.opcoes.findIndex((o) => o.acao.para === entregar.destino));
    assert.ok(!s.missoes.includes(entregar));
    assert.ok(!s.heroi.inventario.some((i) => i.missao === entregar.uid));
  }
});

// ---------- Pacote real ----------
const hasPack = existsSync(join(PACKS_DIR, 'index.json'));
test('pacote core: válido e jogável por simulação', { skip: !hasPack && 'pacote ausente' }, async () => {
  const c = await loadNodeContent();
  const { errors } = validate(c);
  assert.deepEqual(errors, []);
  const sim = simulate(c, { runs: 12, maxTurns: 250 });
  assert.deepEqual([...new Set(sim.problems)], []);
});
