// Testes do gerador da Semente do Mundo (Fase A do Mundo Autoral).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { gerarSemente } from '../tools/semente/gerar.mjs';
import { validarSemente, relatorioConstrucao } from '../tools/semente/validar.mjs';
import { desenharMapa } from '../tools/semente/mapa.mjs';

const mundos = new Map();
const mundo = (s) => mundos.get(s) || mundos.set(s, gerarSemente(s)).get(s);

test('semente: mesma semente gera exatamente o mesmo mundo', () => {
  const a = JSON.stringify(gerarSemente('determinismo')), b = JSON.stringify(gerarSemente('determinismo'));
  assert.equal(a, b);
  assert.notEqual(a, JSON.stringify(mundo('outra')));
});

for (const s of ['aerath', 'kholar', 'valdor']) {
  test(`semente "${s}": mundo válido, alcançável e na escala decidida`, () => {
    const m = mundo(s);
    const { erros } = validarSemente(m);
    assert.deepEqual(erros, []);
    const reinos = m.reinos.filter((r) => r.tipo === 'reino');
    assert.ok(reinos.length >= 14 && reinos.length <= 18, `${reinos.length} reinos`);
    // Variedade de povos: além de humanos, ao menos 4 povos diferentes têm reino.
    const povos = new Set(reinos.map((r) => r.povo));
    assert.ok(povos.has('humanos') && povos.size >= 5, [...povos].join(','));
    // Três continentes de tamanho razoável e mares entre eles.
    assert.equal(m.indice.continentes.length, 3);
    const lugares = [...m.reinos.flatMap((r) => r.lugares), ...m.indice.ermos];
    assert.ok(lugares.length >= 250, `${lugares.length} lugares`);
    assert.ok(lugares.filter((l) => l.categoria === 'povoado').length >= 60);
    assert.ok(lugares.every((l) => l.nivel === 0 && !/\d/.test(l.nome)), 'tudo começa em esboço e sem numerais no nome');
    assert.ok([...m.reinos.flatMap((r) => r.rotas), ...m.indice.rotasEntreReinos].some((r) => r.tipo === 'mar'), 'há rotas marítimas');
    // Lore essencial presente.
    assert.equal(m.indice.grandeCrise.atos.length, 4);
    assert.ok(m.indice.grandeCrise.pistas.length >= 3);
    assert.ok(m.indice.mundo.linhaDoTempo.at(-1).ano === 0 && m.indice.mundo.linhaDoTempo[0].ano < 0);
    assert.equal(m.indice.pontosDePartida.length, 3);
    assert.ok(m.indice.planos.length >= 5);
  });
}

test('semente: relatório de construção e mapa', () => {
  const m = mundo('aerath');
  const r = relatorioConstrucao(m);
  assert.equal(r.pct, 0);
  assert.match(r.texto, /% construído/);
  // Subir um lugar para o nível 3 aumenta o percentual do mundo.
  const copia = JSON.parse(JSON.stringify(m));
  copia.reinos[0].lugares.forEach((l) => { l.nivel = 3; });
  assert.ok(relatorioConstrucao(copia).pct > 0);
  const svg = desenharMapa(m);
  assert.match(svg, /^<svg/);
  assert.ok(svg.length > 50000);
});

test('semente: validador acusa referências quebradas', () => {
  const m = JSON.parse(JSON.stringify(mundo('aerath')));
  m.reinos[0].rotas.push({ de: 'nao_existe', para: m.reinos[0].lugares[0].id, tipo: 'estrada', tempo: 1 });
  m.indice.grandeCrise.origem = 'sumiu';
  const { erros } = validarSemente(m);
  assert.ok(erros.some((e) => e.includes('ponta inexistente')));
  assert.ok(erros.some((e) => e.includes('Grande Crise')));
});
