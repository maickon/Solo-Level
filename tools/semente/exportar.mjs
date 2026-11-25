// Exporta a Semente (mundo/) para o jogo (public/data/mundo/), com o ponto de partida e a região jogável.
// Uso: npm run mundo:exportar [-- --partida cornvale]
// A região jogável provisória = reino da partida + reinos ligados a ele por terra (até as bíblias existirem,
// é ela que o jogador pode visitar; o resto aparece no mapa como "terras ainda não mapeadas").
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { carregarMundo, desenharMapa } from './mapa.mjs';

export function prepararExportacao(mundo, partidaPedida) {
  const { indice, terreno, reinos } = mundo;
  const todos = [...reinos.flatMap((r) => r.lugares), ...indice.ermos];
  const partida = partidaPedida || indice.partida || indice.pontosDePartida[0]?.lugar;
  const inicial = todos.find((l) => l.id === partida);
  if (!inicial) throw new Error(`ponto de partida "${partida}" não existe`);
  const reinoDe = new Map(todos.map((l) => [l.id, l.reino]));
  const vizinhos = new Set([inicial.reino]);
  for (const r of indice.rotasEntreReinos) {
    if (!['estrada', 'trilha', 'passo'].includes(r.tipo)) continue;
    const a = reinoDe.get(r.de), b = reinoDe.get(r.para);
    if (a === inicial.reino && b) vizinhos.add(b);
    if (b === inicial.reino && a) vizinhos.add(a);
  }
  const regiaoInicial = [...vizinhos];
  return {
    indice: { ...indice, partida, regiaoInicial, mapa: { largura: terreno.largura, altura: terreno.altura, celula: 6 }, culturas: indice.culturas.map(({ nomesPessoas, nomesLugares, ...c }) => c) },
    terreno, reinos,
  };
}

if (process.argv[1] && process.argv[1].replace(/\\/g, '/').endsWith('tools/semente/exportar.mjs')) {
  const arg = (k, d) => { const i = process.argv.indexOf(`--${k}`); return i > 0 ? process.argv[i + 1] : d; };
  const origem = arg('pasta', 'mundo'), destino = arg('saida', 'public/data/mundo');
  const exp = prepararExportacao(carregarMundo(origem), arg('partida'));
  rmSync(destino, { recursive: true, force: true });
  mkdirSync(join(destino, 'reinos'), { recursive: true });
  writeFileSync(join(destino, 'indice.json'), JSON.stringify(exp.indice));
  writeFileSync(join(destino, 'terreno.json'), JSON.stringify(exp.terreno));
  for (const r of exp.reinos) writeFileSync(join(destino, 'reinos', `${r.id}.json`), JSON.stringify(r));
  // Fundo do mapa-múndi no jogo (o jogo desenha por cima os lugares, onde você está e o que já visitou).
  writeFileSync(join(destino, 'mapa.svg'), desenharMapa(exp, { base: true }));
  const jog = exp.reinos.filter((r) => exp.indice.regiaoInicial.includes(r.id));
  console.log(`Exportado para ${destino}/: partida ${exp.indice.partida}; região jogável: ${jog.map((r) => r.nome).join(', ')} ` +
    `(${jog.reduce((a, r) => a + r.lugares.length, 0)} lugares).`);
}
