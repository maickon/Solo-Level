import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { Rng } from '../public/src/engine/rng.js';
import { expand, gvar } from '../public/src/engine/grammar.js';
import { markovName } from '../public/src/engine/names.js';
import { buildContent, validate } from '../public/src/engine/content.js';
import { generateItem } from '../public/src/engine/items.js';
import { newState, Game } from '../public/src/engine/game.js';
import { stats } from '../public/src/engine/hero.js';
import * as R from '../public/src/engine/rules.js';
import { loadNodeContent, PACKS_DIR } from '../tools/node-content.mjs';
import { simulate } from '../tools/simulate.mjs';

// ---------- Fixture mínima ----------
const T = (s) => [s];
const grammar = Object.fromEntries(['local_desc', 'local_retorno', 'chegada', 'viagem_sem_evento', 'descanso_curto',
  'acampamento', 'estalagem', 'emboscada', 'combate_inicio', 'ataque_acerto', 'ataque_parcial', 'ataque_falha',
  'vitoria', 'fuga_sucesso', 'fuga_falha', 'negociar_sucesso', 'negociar_falha', 'epitafio', 'subir_nivel',
  'item_encontrado', 'novo_dia'].map((k) => [k, T(`${k}.`)]));
const fixture = () => buildContent({
  classes: [{ id: 'g', nome: { m: 'G', f: 'G' }, atributos: { forca: 2, agilidade: 0, mente: 0, presenca: 0 },
    hp: 10, energia: 5, inicial: [{ base: 'espada' }, { base: 'racao', qtd: 2 }], tracos: ['forte'] }],
  traits: [{ id: 'forte', nome: 'Forte', mods: { forca: 1 } }],
  biomes: [{ id: 'vila', nome: 'Vila', perigo: 0, clima: { limpo: 1 }, inimigos: [] },
    { id: 'mata', nome: 'Mata', perigo: 3, clima: { chuva: 1 }, inimigos: ['lobo'] }],
  locations: [{ id: 'vila_bruma', nome: 'Vila', genero: 'f', bioma: 'vila', tags: ['seguro', 'mercado', 'estalagem'], conexoes: [{ para: 'mata1', tempo: 1 }] },
    { id: 'mata1', nome: 'Mata', genero: 'f', bioma: 'mata', tags: [], conexoes: [{ para: 'vila_bruma', tempo: 1 }] }],
  enemies: [{ id: 'lobo', nome: 'lobo', genero: 'm', hp: 4, dano: '1d2', tier: 1, xp: 9, ouro: '1d2', saque: 1 }],
  events: [{ id: 'e1', tipo: 'exploracao', texto: 'Algo.', opcoes: [
    { rotulo: 'Testar', teste: 'forca', sucesso: { texto: 'ok', efeitos: [{ xp: 1 }] }, parcial: { texto: 'meh', efeitos: [] }, falha: { texto: 'ai', efeitos: [{ dano: '1' }] } },
    { rotulo: 'Lutar', resultado: { texto: 'Vem!', efeitos: [{ combate: 'lobo' }] } },
    { rotulo: 'Corda', requer: { item_tag: 'corda' }, resultado: { texto: 'x', efeitos: [] } }] }],
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
  assert.equal(s.cena.opcoes.length, 2);
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

// ---------- Pacote real ----------
const hasPack = existsSync(join(PACKS_DIR, 'index.json'));
test('pacote core: válido e jogável por simulação', { skip: !hasPack && 'pacote ausente' }, async () => {
  const c = await loadNodeContent();
  const { errors } = validate(c);
  assert.deepEqual(errors, []);
  const sim = simulate(c, { runs: 12, maxTurns: 250 });
  assert.deepEqual([...new Set(sim.problems)], []);
});
