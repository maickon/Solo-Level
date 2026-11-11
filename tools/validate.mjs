// npm run validate — integridade dos pacotes + simulação curta de jogo.
import { loadNodeContent } from './node-content.mjs';
import { validate } from '../public/src/engine/content.js';
import { simulate, variedade } from './simulate.mjs';
import { BIOMAS_VISUAIS, FORMAS_VISUAIS, PARTICULAS } from '../public/src/visual/cenario.js';
import { PERFIS_SOM, VOZES_SOM } from '../public/src/audio/ambience.js';

const content = await loadNodeContent();
const { errors, warnings } = validate(content);
// Perfis de cenário e som dos biomas (módulos de UI, por isso conferidos aqui e não no motor).
for (const b of Object.values(content.biomes)) {
  const v = b.visual, so = b.som, w = `biome ${b.id}`;
  if (!v && !BIOMAS_VISUAIS.includes(b.audio)) warnings.push(`${w}: sem "visual" e "audio" sem perfil visual embutido (usa o padrão)`);
  if (v?.base && !BIOMAS_VISUAIS.includes(v.base)) errors.push(`${w}: visual.base "${v.base}" não existe (${BIOMAS_VISUAIS.join(', ')})`);
  for (const c of v?.camadas || []) if (!FORMAS_VISUAIS.includes(c[0])) errors.push(`${w}: forma "${c[0]}" não existe (${FORMAS_VISUAIS.join(', ')})`);
  for (const p of v?.particulas || []) if (!PARTICULAS.includes(p[0])) errors.push(`${w}: partícula "${p[0]}" não existe`);
  if (!PERFIS_SOM.includes(so?.base || b.audio)) errors.push(`${w}: perfil de som "${so?.base || b.audio}" não existe (${PERFIS_SOM.join(', ')})`);
  for (const vz of [...(so?.vozes?.dia || []), ...(so?.vozes?.noite || [])]) if (!VOZES_SOM.includes(vz)) errors.push(`${w}: voz de ambiente "${vz}" não existe (${VOZES_SOM.join(', ')})`);
}
warnings.forEach((w) => console.log('  aviso:', w));
errors.forEach((e) => console.log('  ERRO:', e));
const n = (o) => Object.keys(o).length;
console.log(`Conteúdo: ${content.classes.length} classes, ${n(content.biomes)} biomas, ${n(content.locations)} locais, ` +
  `${n(content.enemies)} inimigos, ${content.events.length} eventos, ${n(content.threads)} fios, ` +
  `${content.items.bases.length} bases de item, ${n(content.grammar)} tabelas de gramática.`);
if (errors.length) { console.log(`\n${errors.length} erro(s).`); process.exit(1); }

const sim = simulate(content, { runs: 40, maxTurns: 300 });
console.log(`Simulação: ${sim.runs} partidas, ${sim.turns} turnos, ${sim.deaths} mortes, nível máx ${sim.maxLevel}, ` +
  `fios abertos ${sim.threadsOpened}, resolvidos ${sim.threadsResolved}.`);
const v = variedade(sim);
console.log(`Variedade: ${v.distintos} textos distintos de ${v.total} (${v.pct}%). Mais repetidos:`);
v.rank.forEach(([t, n]) => console.log(`  ${n}× ${t.length > 90 ? t.slice(0, 90) + '…' : t}`));
const atvs = content.events.filter((e) => e.tipo === 'atividade');
if (atvs.length) {
  const nunca = atvs.filter((e) => !sim.eventos.has(e.id)).map((e) => e.id);
  console.log(`Atividades: ${atvs.length - nunca.length} de ${atvs.length} apareceram na simulação.`);
  if (nunca.length) console.log(`  nunca vistas: ${nunca.slice(0, 12).join(', ')}${nunca.length > 12 ? '…' : ''}`);
}
if (sim.estilo.size) {
  console.log(`Estilo: ${sim.estilo.size} aviso(s) distintos.`);
  [...sim.estilo].slice(0, process.argv.includes('--estilo') ? 200 : 8).forEach(([a, t]) => console.log(`  estilo: ${a} — "${t.length > 110 ? t.slice(0, 110) + '…' : t}"`));
}
if (sim.problems.length) {
  [...new Set(sim.problems)].slice(0, 20).forEach((p) => console.log('  PROBLEMA:', p));
  process.exit(1);
}
console.log('OK');
