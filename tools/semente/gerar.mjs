// Gera o RASCUNHO da Semente do Mundo e grava em mundo/ (índice, terreno, um arquivo por reino).
// Uso: npm run mundo:gerar -- --semente minha-semente [--saida mundo] [--forcar]
// A Semente curada é a verdade: o gerador recusa sobrescrever uma pasta existente sem --forcar.
import { mkdirSync, writeFileSync, existsSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { Rng } from '../../public/src/engine/rng.js';
import { gerarGeografia, compactar, CODIGO_BIOMA } from './geo.mjs';
import { gerarPolitica } from './politica.mjs';
import { gerarLore } from './lore.mjs';
import { CULTURAS, BIOMAS, BIOMA_JOGO } from './tabelas.mjs';

export const VERSAO_SEMENTE = 1;

/** Gera a Semente completa em memória (puro e determinístico). */
export function gerarSemente(semente) {
  // Tenta variações determinísticas até os 3 continentes terem tamanho razoável (≥ 15% da terra cada).
  let rng, geo;
  for (let t = 0; t < 8; t++) {
    rng = new Rng(`semente:${semente}${t ? `#${t}` : ''}`);
    geo = gerarGeografia(rng);
    const terra = geo.bioma.filter((b) => b !== 'mar').length;
    if (geo.massas.filter((m) => m.tipo === 'continente').every((m) => m.tamanho >= terra * 0.15)) break;
  }
  const pol = gerarPolitica(rng, geo);
  const lore = gerarLore(rng, geo, pol);
  const { reinos, lugares, rotas, dono } = pol;

  // Grade de territórios (uma letra por reino) para desenhar fronteiras.
  const letras = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const letraDe = new Map(reinos.map((r, k) => [r.k, letras[k]]));
  const territorio = [];
  for (let y = 0; y < geo.H; y++) { let l = ''; for (let x = 0; x < geo.W; x++) { const d = dono[geo.idx(x, y)]; l += d >= 0 ? letraDe.get(d) : '.'; } territorio.push(l); }

  const ehRota = (r) => (k) => lugares.find((l) => l.id === k)?.reino === r.id;
  const arquivosReino = reinos.map((r, k) => {
    const meus = lugares.filter((l) => l.reino === r.id);
    const internas = rotas.filter((x) => ehRota(r)(x.de) && ehRota(r)(x.para));
    return {
      id: r.id, nome: r.nome, letra: letras[k], tipo: r.selvagem ? (r.ilhas ? 'ilhas' : 'selvagem') : 'reino',
      governo: r.governo, cultura: r.cultura?.id || null, povo: r.cultura?.povo || null, capital: r.capitalId || null,
      descricao: r.descricao, tensao: r.tensao, relacoes: r.relacoes || {}, economia: r.economia,
      territorio: { celulas: r.tamanho, centro: { x: Math.round(r.centro.x), y: Math.round(r.centro.y) } },
      nivel: 0, revisado: false,
      lugares: meus.map(limparLugar), rotas: internas,
    };
  });
  const semReino = lugares.filter((l) => !l.reino).map(limparLugar);
  const rotasEntre = rotas.filter((x) => !arquivosReino.some((r) => r.rotas.includes(x)));

  const indice = {
    versao: VERSAO_SEMENTE, semente, status: 'rascunho',
    mundo: { ...lore.mundo, dimensoes: { largura: geo.W, altura: geo.H } },
    continentes: lore.continentes.map(({ massa, ...c }) => c), mares: lore.mares,
    culturas: CULTURAS.filter((c) => reinos.some((r) => r.cultura?.id === c.id)).map(({ pessoas, lugares: lg, ...c }) => ({ ...c, nomesPessoas: pessoas, nomesLugares: lg })),
    faccoes: lore.faccoes, grandeCrise: lore.grandeCrise, planos: lore.planos, pontosDePartida: lore.pontosDePartida,
    reinos: arquivosReino.map((r) => ({ id: r.id, nome: r.nome, tipo: r.tipo, arquivo: `reinos/${r.id}.json` })),
    ermos: semReino, rotasEntreReinos: rotasEntre,
    biomas: BIOMAS, biomaNoJogo: BIOMA_JOGO,
  };
  const terreno = { largura: geo.W, altura: geo.H, legenda: CODIGO_BIOMA, linhas: compactar(geo), territorio,
    rios: geo.rios.map((rio) => rio.map((i) => [i % geo.W, (i / geo.W) | 0])) };
  return { indice, terreno, reinos: arquivosReino };
}

function limparLugar(l) {
  const { semAcessoTerrestre, ...resto } = l;
  return { ...resto, nivel: 0, revisado: false };
}

export function gravarSemente(s, pasta) {
  mkdirSync(join(pasta, 'reinos'), { recursive: true });
  const json = (o) => JSON.stringify(o, null, 2) + '\n';
  writeFileSync(join(pasta, 'indice.json'), json(s.indice));
  writeFileSync(join(pasta, 'terreno.json'), JSON.stringify(s.terreno) + '\n');
  for (const r of s.reinos) writeFileSync(join(pasta, 'reinos', `${r.id}.json`), json(r));
}

// CLI
if (process.argv[1] && process.argv[1].replace(/\\/g, '/').endsWith('tools/semente/gerar.mjs')) {
  const arg = (k, d) => { const i = process.argv.indexOf(`--${k}`); return i > 0 ? process.argv[i + 1] : d; };
  const semente = arg('semente', 'aerath'), pasta = arg('saida', 'mundo');
  if (existsSync(join(pasta, 'indice.json')) && !process.argv.includes('--forcar')) {
    console.log(`"${pasta}" já tem uma Semente. Ela pode estar curada: use --forcar para substituir, ou --saida outra-pasta.`);
    process.exit(1);
  }
  if (process.argv.includes('--forcar')) rmSync(join(pasta, 'reinos'), { recursive: true, force: true });
  const s = gerarSemente(semente);
  gravarSemente(s, pasta);
  const n = s.reinos.reduce((a, r) => a + r.lugares.length, 0) + s.indice.ermos.length;
  console.log(`Semente "${semente}" → ${pasta}/: ${s.indice.mundo.nome}, ${s.reinos.filter((r) => r.tipo === 'reino').length} reinos, ` +
    `${s.reinos.filter((r) => r.tipo !== 'reino').length} territórios sem governo, ${n} lugares, crise: ${s.indice.grandeCrise.nome}.`);
}
