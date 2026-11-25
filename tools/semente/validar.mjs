// Validação da Semente do Mundo e relatório de construção.
// Uso: npm run mundo:validar   (sai com erro se a Semente estiver inconsistente)
//      npm run mundo:relatorio (grava mundo/CONSTRUCAO.md)
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { carregarMundo } from './mapa.mjs';

const TIPOS_ROTA = ['estrada', 'trilha', 'passo', 'mar', 'magia'];
const NIVEIS = [0, 1, 2, 3];

/** Retorna { erros, avisos }. */
export function validarSemente({ indice, terreno, reinos }) {
  const erros = [], avisos = [];
  const err = (m) => erros.push(m), av = (m) => avisos.push(m);
  const W = terreno.largura, H = terreno.altura;
  const todos = [...reinos.flatMap((r) => r.lugares), ...indice.ermos];
  const ids = new Map();
  for (const l of todos) { if (ids.has(l.id)) err(`lugar com id repetido: ${l.id}`); ids.set(l.id, l); }
  const reinoIds = new Set(reinos.map((r) => r.id));
  if (reinoIds.size !== reinos.length) err('reinos com id repetido');
  const nomes = new Map();
  for (const l of todos) { if (nomes.has(l.nome)) av(`nome repetido: "${l.nome}" (${nomes.get(l.nome)} e ${l.id})`); nomes.set(l.nome, l.id); }

  for (const r of reinos) {
    if (r.tipo === 'reino') {
      if (!r.capital || !ids.has(r.capital)) err(`${r.id}: capital "${r.capital}" não existe`);
      else if (ids.get(r.capital).reino !== r.id) err(`${r.id}: a capital pertence a outro reino`);
      if (!indice.culturas.some((c) => c.id === r.cultura)) err(`${r.id}: cultura "${r.cultura}" não existe`);
    }
    for (const k of Object.keys(r.relacoes || {})) if (!reinoIds.has(k)) err(`${r.id}: relação com reino inexistente "${k}"`);
    if (!NIVEIS.includes(r.nivel)) err(`${r.id}: nível inválido`);
    for (const l of r.lugares) if (l.reino !== r.id) err(`${l.id}: está no arquivo de ${r.id} mas diz pertencer a ${l.reino}`);
  }
  for (const l of todos) {
    if (!NIVEIS.includes(l.nivel)) err(`${l.id}: nível inválido (${l.nivel})`);
    if (!(l.x >= 0 && l.x < W && l.y >= 0 && l.y < H)) err(`${l.id}: fora do mapa`);
    else if (terreno.linhas[l.y][l.x] === '~') err(`${l.id}: está no mar`);
    if (!l.nome || !l.tipo || !l.categoria) err(`${l.id}: falta nome, tipo ou categoria`);
    if (l.nivel >= 1 && !l.biblia) av(`${l.id}: nível ${l.nivel} sem "biblia"`);
  }

  const rotas = [...reinos.flatMap((r) => r.rotas), ...indice.rotasEntreReinos];
  for (const r of rotas) {
    if (!ids.has(r.de) || !ids.has(r.para)) err(`rota ${r.de} → ${r.para}: ponta inexistente`);
    if (!TIPOS_ROTA.includes(r.tipo)) err(`rota ${r.de} → ${r.para}: tipo "${r.tipo}" inválido`);
  }
  // Alcance: tudo deve ser alcançável a partir do primeiro ponto de partida (por qualquer meio).
  const partida = indice.pontosDePartida[0]?.lugar;
  if (!partida || !ids.has(partida)) err('sem ponto de partida válido');
  else {
    const viz = new Map(); for (const r of rotas) { (viz.get(r.de) || viz.set(r.de, []).get(r.de)).push(r.para); (viz.get(r.para) || viz.set(r.para, []).get(r.para)).push(r.de); }
    const visto = new Set([partida]), fila = [partida];
    while (fila.length) for (const o of viz.get(fila.pop()) || []) if (!visto.has(o)) { visto.add(o); fila.push(o); }
    const fora = todos.filter((l) => !visto.has(l.id));
    if (fora.length) err(`${fora.length} lugar(es) inalcançável(is): ${fora.slice(0, 5).map((l) => l.id).join(', ')}`);
  }
  const C = indice.grandeCrise;
  if (!ids.has(C.origem)) err(`Grande Crise: origem "${C.origem}" não existe`);
  for (const p of C.pistas) if (!ids.has(p)) err(`Grande Crise: pista "${p}" não existe`);
  if (!reinoIds.has(C.reinoAfetado)) err(`Grande Crise: reino "${C.reinoAfetado}" não existe`);
  for (const f of indice.faccoes) { if (!ids.has(f.sede)) err(`facção ${f.id}: sede inexistente`); for (const r of f.atuacao) if (!reinoIds.has(r)) err(`facção ${f.id}: atua em reino inexistente ${r}`); }
  for (const p of indice.planos) if (p.portal && !ids.has(p.portal)) err(`plano ${p.id}: portal inexistente`);
  const nReinos = reinos.filter((r) => r.tipo === 'reino').length;
  if (nReinos < 14) av(`só ${nReinos} reinos (a decisão de design pede 14–18)`);
  return { erros, avisos };
}

/** Relatório de construção: % construído por reino e no mundo. */
export function relatorioConstrucao({ indice, reinos }) {
  const peso = (n) => n / 3; // nível 3 = 100%
  const pct = (ls) => (ls.length ? Math.round((ls.reduce((a, l) => a + peso(l.nivel), 0) / ls.length) * 100) : 0);
  const todos = [...reinos.flatMap((r) => r.lugares), ...indice.ermos];
  const linhas = [`# Construção do mundo: ${indice.mundo.nome}`, '',
    `Mundo: **${pct(todos)}% construído** · ${todos.length} lugares · status da Semente: ${indice.status}`, '',
    '| Reino / território | Lugares | Nível 0 | Nível 1 | Nível 2 | Nível 3 | Construído |', '|---|---|---|---|---|---|---|'];
  for (const r of reinos) {
    const c = [0, 1, 2, 3].map((n) => r.lugares.filter((l) => l.nivel === n).length);
    linhas.push(`| ${r.nome} | ${r.lugares.length} | ${c.join(' | ')} | ${pct(r.lugares)}% |`);
  }
  linhas.push('', 'Níveis: 0 esboço · 1 bíblia · 2 sub-lugares · 3 autoral (ver docs/MUNDO_AUTORAL.md).');
  return { texto: linhas.join('\n'), pct: pct(todos) };
}

if (process.argv[1] && process.argv[1].replace(/\\/g, '/').endsWith('tools/semente/validar.mjs')) {
  const i = process.argv.indexOf('--pasta'), pasta = i > 0 ? process.argv[i + 1] : 'mundo';
  const mundo = carregarMundo(pasta);
  if (process.argv.includes('--relatorio')) {
    const r = relatorioConstrucao(mundo);
    writeFileSync(join(pasta, 'CONSTRUCAO.md'), r.texto + '\n');
    console.log(`Mundo ${r.pct}% construído. Relatório em ${pasta}/CONSTRUCAO.md`);
  }
  const { erros, avisos } = validarSemente(mundo);
  avisos.slice(0, 30).forEach((a) => console.log('  aviso:', a));
  erros.forEach((e) => console.log('  ERRO:', e));
  console.log(erros.length ? `${erros.length} erro(s) na Semente.` : 'Semente válida.');
  process.exit(erros.length ? 1 : 0);
}
