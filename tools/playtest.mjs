// Playtest em massa: vários "jogadores" robôs com estilos diferentes jogam muitas partidas e o script
// procura erros, textos estranhos, becos sem saída, laços e desequilíbrios. Gera relatórios em reports/.
//   npm run playtest                 → 120 partidas × 400 turnos
//   npm run playtest -- --partidas 400 --turnos 800 --semente x
// Sai com código 1 se houver PROBLEMAS (erros duros). Avisos de estilo/semântica só entram no relatório.
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { loadNodeContent } from './node-content.mjs';
import { validate } from '../public/src/engine/content.js';
import { newState, Game } from '../public/src/engine/game.js';
import { Rng } from '../public/src/engine/rng.js';
import { estiloDetalhado, cenaDetalhada } from './estilo.mjs';

const arg = (k, d) => { const i = process.argv.indexOf(`--${k}`); return i > 0 ? process.argv[i + 1] : d; };
const PARTIDAS = +arg('partidas', 120), TURNOS = +arg('turnos', 400), SEMENTE = arg('semente', 'playtest');
const OUT = 'reports';

// Estilos de jogador: escolhem a opção pela "preferência" no rótulo/ação (o resto, ao acaso).
const ESTILOS = {
  aleatorio: () => 0,
  cauteloso: (o) => (/descans|dormir|acampar|voltar|fugir|seguir adiante|despedir|sair/i.test(o.rotulo) ? 3 : 0),
  explorador: (o) => (o.acao.tipo === 'desbravar' ? 6 : o.acao.tipo === 'explorar' ? 3 : o.acao.tipo === 'viajar' && /inexplorado/.test(o.dica || '') ? 4 : 0),
  desbravador: (o) => (o.acao.tipo === 'desbravar' ? 8 : o.acao.tipo === 'viajar' && /inexplorado/.test(o.dica || '') ? 5 : /descans|acampar|dormir/i.test(o.rotulo) ? 1 : 0),
  social: (o) => (o.atividade ? 4 : /conversar|perguntar|ouvir|ajudar|aceitar|oferta|trabalho/i.test(o.rotulo) ? 2 : 0),
  guerreiro: (o) => (o.acao.tipo === 'atacar' ? 4 : /lutar|atacar|enfrentar|duelo/i.test(o.rotulo) ? 3 : 0),
  missoes: (o) => (o.destaque ? 5 : /trabalho|ouvir:|aceitar/i.test(o.rotulo) ? 3 : 0),
};

const content = await loadNodeContent();
const { errors } = validate(content);
if (errors.length) { console.log(`${errors.length} erro(s) de conteúdo; rode npm run validate.`); process.exit(1); }

const r = {
  turnos: 0, mortes: 0, diasMorte: [], nivelMax: 1, problemas: new Map(), avisos: new Map(), textos: new Map(),
  eventos: new Map(), atividades: new Map(), estilos: {}, amostras: [], lacos: 0, ouroFinal: [],
  regioes: new Map(), biomas: new Set(), masmorras: 0, regioesPorPartida: [],
};
const conta = (map, k, ex) => { const v = map.get(k) || { n: 0, ex }; v.n++; map.set(k, v); };
const escolha = new Rng(SEMENTE);

for (let p = 0; p < PARTIDAS; p++) {
  const nomes = Object.keys(ESTILOS), estilo = nomes[p % nomes.length];
  const cls = content.classes[p % content.classes.length], genero = p % 2 ? 'f' : 'm';
  const s = newState(content, { classe: cls.id, nome: genero === 'f' ? 'Ilsa' : 'Doran', genero, seed: `${SEMENTE}-${p}` });
  const g = new Game(content, s);
  const ultimas = [];
  let cenaAnt = null;
  for (let t = 0; t < TURNOS && !s.morto; t++) {
    const cena = s.cena;
    // Inspeção da cena nova (uma vez por cena).
    if (cena !== cenaAnt) {
      const inicioEvento = cena.modo === 'evento' && cenaAnt?.modo !== 'evento';
      for (const b of cena.blocos) {
        if (/\[[a-z_]+\]/.test(b.texto)) conta(r.problemas, `tabela ausente: ${b.texto.match(/\[[a-z_]+\]/)[0]}`, b.texto);
        if (/[{}]/.test(b.texto)) conta(r.problemas, 'token não expandido', b.texto);
        if (/undefined|NaN|null/.test(b.texto)) conta(r.problemas, 'valor inválido no texto', b.texto);
        if (b.tipo !== 'texto') continue;
        conta(r.textos, b.texto, b.texto);
        for (const a of estiloDetalhado(b.texto, { genero })) conta(r.avisos, `${a.cod}: ${a.msg}`, `${b.texto}  [evento: ${s.evento?.id || cena.modo}]`);
      }
      for (const a of cenaDetalhada(cena, { inicioEvento })) conta(r.avisos, `${a.cod}: ${a.msg}`, `[evento: ${s.evento?.id || cena.modo}] ${cena.blocos.map((b) => b.texto).join(' / ').slice(0, 200)}`);
      for (const o of cena.opcoes) if (/[{}[\]]|undefined|NaN/.test(o.rotulo)) conta(r.problemas, 'rótulo quebrado', o.rotulo);
      if (s.evento?.id) conta(r.eventos, s.evento.id);
      if (escolha.chance(0.02) && r.amostras.length < 60) {
        r.amostras.push({ estilo, genero, local: content.location(s).nome, dia: s.dia, periodo: s.periodo, evento: s.evento?.id || cena.modo,
          blocos: cena.blocos.map((b) => (b.tipo === 'texto' ? b.texto : `[${b.texto}]`)), opcoes: cena.opcoes.map((o) => o.rotulo + (o.desativada ? ' (desativada)' : '')) });
      }
      cenaAnt = cena;
    }
    // Estado inválido.
    const h = s.heroi;
    if (h.hp > h.hpMax || h.hp < 0) conta(r.problemas, 'vida fora dos limites');
    if (h.energia > h.energiaMax || h.energia < 0) conta(r.problemas, 'energia fora dos limites');
    if (h.ouro < 0 || Number.isNaN(h.ouro)) conta(r.problemas, 'ouro inválido');
    const ok = cena.opcoes.map((o, i) => (o.desativada ? -1 : i)).filter((i) => i >= 0);
    if (!ok.length) { conta(r.problemas, `beco sem saída no modo ${cena.modo}`, s.evento?.id); break; }
    // Laço: a mesma cena (texto + opções) repetida 6 vezes seguidas.
    const assinatura = cena.modo + cena.opcoes.map((o) => o.rotulo).join('|');
    ultimas.push(assinatura); if (ultimas.length > 6) ultimas.shift();
    if (ultimas.length === 6 && ultimas.every((x) => x === assinatura) && cena.modo !== 'combate') { r.lacos++; conta(r.avisos, `laco: mesma cena 6× seguidas (${cena.modo})`, assinatura.slice(0, 120)); }
    // Cura quando ferido (como um jogador sensato); senão, escolhe pelo estilo.
    const pocao = h.inventario.find((i) => i.efeitos?.some((e) => e.cura));
    if (h.hp <= h.hpMax / 3 && pocao && !s.morto) { g.usarItem(pocao.uid); continue; }
    const pesos = ok.map((i) => 1 + ESTILOS[estilo](cena.opcoes[i]));
    let sorteio = escolha.next() * pesos.reduce((a, b) => a + b, 0), idx = ok[0];
    for (let k = 0; k < ok.length; k++) { sorteio -= pesos[k]; if (sorteio <= 0) { idx = ok[k]; break; } }
    const op = cena.opcoes[idx];
    if (op.acao.tipo === 'atividade') conta(r.atividades, op.acao.id);
    try { g.choose(idx); } catch (e) { conta(r.problemas, `exceção: ${e.message}`, `${cena.modo} / ${s.evento?.id} / ${op.rotulo}`); break; }
    r.turnos++;
  }
  const e = (r.estilos[estilo] ||= { partidas: 0, mortes: 0, nivel: 0, dias: 0 });
  e.partidas++; e.nivel += s.heroi.nivel; e.dias += s.dia;
  if (s.morto) { r.mortes++; e.mortes++; r.diasMorte.push(s.dia); }
  r.nivelMax = Math.max(r.nivelMax, s.heroi.nivel);
  r.ouroFinal.push(s.heroi.ouro);
  for (const reg of Object.values(s.regioes || {})) conta(r.regioes, reg.modelo);
  r.masmorras += Object.keys(s.masmorras || {}).length;
  r.regioesPorPartida.push(Object.keys(s.regioes || {}).length);
  for (const id of s.visitados) { const l = s.locais[id] || content.locations[id]; if (l) r.biomas.add(l.bioma); }
  try { JSON.parse(JSON.stringify(s)); } catch { conta(r.problemas, 'estado não serializável'); }
}

// ---------- Relatório ----------
const totalTextos = [...r.textos.values()].reduce((a, v) => a + v.n, 0);
const media = (l) => (l.length ? (l.reduce((a, b) => a + b, 0) / l.length).toFixed(1) : '—');
const nuncaEventos = content.events.filter((ev) => !r.eventos.has(ev.id) && ev.tipo !== 'fio').map((ev) => `${ev.id} (${ev.tipo})`);
const atvs = content.events.filter((ev) => ev.tipo === 'atividade');
const top = (map, n) => [...map].sort((a, b) => b[1].n - a[1].n).slice(0, n);
const linhas = [
  `# Playtest — ${PARTIDAS} partidas × até ${TURNOS} turnos (semente "${SEMENTE}")`, '',
  `- Turnos jogados: ${r.turnos} · mortes: ${r.mortes}/${PARTIDAS} · dia médio da morte: ${media(r.diasMorte)} · nível máx: ${r.nivelMax}`,
  `- Ouro final médio: ${media(r.ouroFinal)} · laços detectados: ${r.lacos}`,
  `- Variedade: ${r.textos.size} textos distintos de ${totalTextos} (${totalTextos ? Math.round((r.textos.size / totalTextos) * 100) : 0}%)`,
  `- Eventos alcançados: ${r.eventos.size}/${content.events.length} · atividades escolhidas: ${[...r.atividades.keys()].length}/${atvs.length}`,
  `- Mundo: ${media(r.regioesPorPartida)} regiões geradas por partida · modelos vistos ${r.regioes.size}/${(content.regioes || []).length} · masmorras achadas ${r.masmorras} · biomas visitados ${r.biomas.size}/${Object.keys(content.biomes).length}`,
  `- Modelos de região nunca gerados: ${(content.regioes || []).filter((m) => !r.regioes.has(m.id)).map((m) => m.id).join(', ') || 'nenhum'}`, '',
  '## Por estilo de jogador', '| estilo | partidas | mortes | nível médio | dia médio |', '|---|---|---|---|---|',
  ...Object.entries(r.estilos).map(([k, v]) => `| ${k} | ${v.partidas} | ${v.mortes} | ${(v.nivel / v.partidas).toFixed(1)} | ${(v.dias / v.partidas).toFixed(1)} |`), '',
  `## PROBLEMAS (${r.problemas.size})`, ...(r.problemas.size ? top(r.problemas, 50).map(([k, v]) => `- **${k}** ×${v.n}${v.ex ? ` — \`${String(v.ex).slice(0, 160)}\`` : ''}`) : ['Nenhum.']), '',
  `## Avisos de texto e semântica (${r.avisos.size} distintos)`, ...top(r.avisos, 80).map(([k, v]) => `- ${k} ×${v.n} — "${String(v.ex).slice(0, 220)}"`), '',
  `## Textos mais repetidos`, ...top(r.textos, 12).map(([k, v]) => `- ${v.n}× ${k.slice(0, 140)}`), '',
  `## Nunca alcançados (${nuncaEventos.length})`, nuncaEventos.slice(0, 80).join(', ') || 'Todos alcançados.', '',
];
mkdirSync(OUT, { recursive: true });
writeFileSync(join(OUT, 'playtest.md'), linhas.join('\n'));
writeFileSync(join(OUT, 'amostras.md'), [`# Amostras de cenas para revisão humana/IA (${r.amostras.length})`, '',
  ...r.amostras.map((a, i) => [`### ${i + 1}. ${a.local} · dia ${a.dia} · ${a.periodo} · herói ${a.genero === 'f' ? 'feminino' : 'masculino'} · ${a.estilo} · [${a.evento}]`,
    ...a.blocos.map((b) => `> ${b}`), '', ...a.opcoes.map((o, j) => `${j + 1}. ${o}`), ''].join('\n'))].join('\n'));
console.log(linhas.slice(0, 7).join('\n'));
console.log(`PROBLEMAS: ${r.problemas.size} · avisos distintos: ${r.avisos.size} · relatório: ${OUT}/playtest.md · amostras: ${OUT}/amostras.md`);
process.exit(r.problemas.size ? 1 : 0);
