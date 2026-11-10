// npm run validate — integridade dos pacotes + simulação curta de jogo.
import { loadNodeContent } from './node-content.mjs';
import { validate } from '../public/src/engine/content.js';
import { simulate } from './simulate.mjs';

const content = await loadNodeContent();
const { errors, warnings } = validate(content);
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
if (sim.problems.length) {
  [...new Set(sim.problems)].slice(0, 20).forEach((p) => console.log('  PROBLEMA:', p));
  process.exit(1);
}
console.log('OK');
