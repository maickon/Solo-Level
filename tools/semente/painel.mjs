// Painel do mundo: o que já foi construído de Vandor e o tamanho do que falta (HTML autocontido).
// Uso: node tools/semente/painel.mjs [--saida mundo/painel.html]
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { carregarMundo, desenharMapa } from './mapa.mjs';

const CEL = 6;
// Meta de um mundo "completo" por categoria de lugar (o que o nível 3 pede).
export const META = {
  povoado: { subs: 6, pessoas: 5, eventos: 12 },
  natureza: { subs: 0, pessoas: 0, eventos: 4 },
  ruina: { subs: 0, pessoas: 0, eventos: 5 },
  masmorra: { subs: 0, pessoas: 0, eventos: 8 },
};
const esc = (t) => String(t ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export function dadosPainel(mundo, eventos) {
  const { indice, reinos } = mundo;
  const todos = [...reinos.flatMap((r) => r.lugares), ...indice.ermos];
  const porLocal = new Map();
  for (const e of eventos) for (const id of [e.requer?.local].flat().filter(Boolean)) porLocal.set(id, (porLocal.get(id) || 0) + 1);
  const conversas = new Set(todos.flatMap((l) => (l.biblia?.pessoas || []).map((p) => p.evento).filter(Boolean)));
  const soma = (f) => todos.reduce((a, l) => a + f(l), 0);
  const metaSoma = (k) => soma((l) => META[l.categoria]?.[k] || 0);
  const linhas = [
    { nome: 'Bíblias de lugar', feito: soma((l) => (l.biblia ? 1 : 0)), meta: todos.length, dica: 'aparência, poder, situação, segredo, descrições, fatos' },
    { nome: 'Bíblias de reino', feito: reinos.filter((r) => r.biblia).length, meta: reinos.length, dica: 'governante, história recente, conflito' },
    { nome: 'Sub-lugares', feito: soma((l) => l.sublugares?.length || 0), meta: metaSoma('subs'), dica: 'tavernas, templos, forjas… com nome próprio' },
    { nome: 'Pessoas com nome', feito: soma((l) => l.biblia?.pessoas?.length || 0), meta: metaSoma('pessoas') + reinos.length * 2, dica: 'rostos fixos, rotina, voz própria' },
    { nome: 'Conversas escritas', feito: conversas.size, meta: metaSoma('pessoas'), dica: 'uma árvore de diálogo por pessoa' },
    { nome: 'Eventos de lugar', feito: soma((l) => porLocal.get(l.id) || 0), meta: metaSoma('eventos'), dica: 'atividades e explorações exclusivas' },
    { nome: 'Arcos de facção', feito: 0, meta: (indice.faccoes?.length || 0) * 5, dica: `${indice.faccoes?.length || 0} facções × 5 capítulos` },
    { nome: 'Grande Crise', feito: 0, meta: (indice.grandeCrise?.atos?.length || 4) * 10, dica: `${indice.grandeCrise?.nome || ''}: 4 atos × ~10 cenas` },
    { nome: 'Planos e mistérios', feito: 0, meta: (indice.planos?.length || 0) * 8 + (indice.mundo?.misterios?.length || 6) * 5, dica: 'outros planos e os mistérios do mundo' },
  ];
  const nivel = (l) => l.nivel || 0;
  const pct = (l) => [0, 33, 66, 100][nivel(l)] || 0;
  const reinosTab = reinos.map((r) => ({ nome: r.nome, povo: r.povo || '—', n: r.lugares.length,
    niveis: [0, 1, 2, 3].map((n) => r.lugares.filter((l) => nivel(l) === n).length),
    pct: Math.round(r.lugares.reduce((a, l) => a + pct(l), 0) / Math.max(1, r.lugares.length)) }))
    .sort((a, b) => b.pct - a.pct || b.n - a.n);
  const total = Math.round(todos.reduce((a, l) => a + pct(l), 0) / todos.length);
  const cats = Object.fromEntries(['povoado', 'natureza', 'ruina', 'masmorra'].map((c) => [c, todos.filter((l) => l.categoria === c).length]));
  return { indice, reinos, todos, linhas, reinosTab, total, cats };
}

export function paginaPainel(mundo, eventos) {
  const d = dadosPainel(mundo, eventos);
  const { indice } = d;
  const W = mundo.terreno.largura * CEL, H = mundo.terreno.altura * CEL;
  const base = desenharMapa(mundo, { base: true }).replace(/^<svg[^>]*>/, '').replace(/<\/svg>$/, '');
  const COR = ['nv0', 'nv1', 'nv2', 'nv3'];
  const pontos = d.todos.map((l) => `<circle cx="${l.x * CEL + 3}" cy="${l.y * CEL + 3}" r="${(l.nivel || 0) ? 4 + l.nivel : 2.6}" class="${COR[l.nivel || 0]}"><title>${esc(l.nome)} · nível ${l.nivel || 0}</title></circle>`).join('');
  const partida = d.todos.find((l) => l.id === indice.partida);
  const marcaPartida = partida ? `<circle cx="${partida.x * CEL + 3}" cy="${partida.y * CEL + 3}" r="16" class="partida"/>` : '';
  const barra = (f, m) => { const p = m ? Math.min(100, (f / m) * 100) : 0; return `<div class="barra"><i style="width:${p.toFixed(1)}%"></i></div><span class="num">${f.toLocaleString('pt-BR')} / ${m.toLocaleString('pt-BR')}</span>`; };
  const totalFeito = d.linhas.reduce((a, l) => a + Math.min(l.feito, l.meta), 0), totalMeta = d.linhas.reduce((a, l) => a + l.meta, 0);
  const pedidos = [
    ['Construir um lugar a fundo', 'Construa Valmont até o nível 3: sub-lugares com nome, 4 pessoas com rotina e conversa, 12 eventos exclusivos. Ligue pelo menos 3 ganchos a lugares que já existem.'],
    ['Abrir uma região nova', 'Abra o Condado de Tolva: bíblia do reino, nível 1 em todos os lugares, e a capital no nível 2. Rotas e tensões coerentes com Aldwick e Lindartmor.'],
    ['Escrever um arco de facção', 'Escreva o arco da facção [nome] em 5 capítulos espalhados por Aldwick e Lindartmor, com uma escolha que muda o fim, flags que outros eventos possam ler e uma recompensa única.'],
    ['Avançar a Grande Crise', 'Escreva o ato 1 da Maré Morta: 10 cenas nos portos e na costa, pistas que se confirmam em lugares diferentes e uma virada no fim que abre o ato 2.'],
    ['Multiplicar variações', 'Dê 4 versões a cada texto dos eventos de Forte Tholt e crie tabelas de gramática por período e clima para o forte.'],
    ['Costurar o que existe', 'Revise as ligações entre Cornvale, Valmont e Forte Tholt: liste contradições, fatos soltos e pistas sem resposta, e corrija.'],
  ];
  return `<title>Atlas de Vandor</title>
<meta name="claude:viewport-fit-sides" content="cover">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@500;600;700&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
<style>
/* Sala de mapas: pergaminho e tinta de dia, couro e ouro velho à noite. Uma coluna larga, mapa como abertura. */
:root { --bg: #efe6d2; --papel: #f8f1e1; --tinta: #2a2118; --suave: #6f604c; --linha: #d4c5a6; --ouro: #9a6b1c; --ouro2: #c9952f; --ok: #3f7a4a;
  --serif: 'Cormorant Garamond', Georgia, serif; --sans: Inter, system-ui, sans-serif; }
@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) { --bg: #14110e; --papel: #1d1915; --tinta: #ece3d3; --suave: #a3957f; --linha: #3a3229; --ouro: #d9a64a; --ouro2: #f0c36a; --ok: #79c08a; color-scheme: dark; } }
:root[data-theme="dark"] { --bg: #14110e; --papel: #1d1915; --tinta: #ece3d3; --suave: #a3957f; --linha: #3a3229; --ouro: #d9a64a; --ouro2: #f0c36a; --ok: #79c08a; color-scheme: dark; }
body { background: var(--bg); color: var(--tinta); font: 15px/1.6 var(--sans); padding-left: max(16px, env(safe-area-inset-left, 0px)); padding-right: max(16px, env(safe-area-inset-right, 0px)); padding-block: 28px 64px; }
main { max-width: 1120px; margin: 0 auto; display: grid; gap: 44px; }
h1, h2 { font-family: var(--serif); text-wrap: balance; margin: 0; line-height: 1.1; }
h1 { font-size: clamp(2.2rem, 6vw, 3.6rem); }
h2 { font-size: 1.9rem; margin-bottom: 6px; }
.eyebrow { font: 600 .72rem var(--sans); letter-spacing: .14em; text-transform: uppercase; color: var(--ouro); }
.lead { color: var(--suave); max-width: 68ch; margin: 8px 0 0; }
.mapa { width: 100%; max-width: 100%; height: auto; border-radius: 10px; border: 1px solid var(--linha); display: block; }
.mapa text { font-family: var(--serif); }
.nv0 { fill: #1b1206; opacity: .35; } .nv1 { fill: #ffe9a8; stroke: #1b1206; stroke-width: 1.2; } .nv2 { fill: #f0b23a; stroke: #1b1206; stroke-width: 1.4; } .nv3 { fill: #ff6a2c; stroke: #fff; stroke-width: 2; }
.partida { fill: none; stroke: #3cf0a0; stroke-width: 2.5; }
.legenda { display: flex; flex-wrap: wrap; gap: 6px 18px; font-size: .85rem; color: var(--suave); margin-top: 10px; }
.legenda span { display: inline-flex; align-items: center; gap: 6px; }
.legenda i { width: 11px; height: 11px; border-radius: 50%; display: inline-block; border: 1px solid #1b1206; }
.grande { display: flex; flex-wrap: wrap; align-items: baseline; gap: 10px 28px; }
.grande b { font: 700 clamp(3rem, 9vw, 5.2rem)/1 var(--serif); color: var(--ouro); font-variant-numeric: tabular-nums; }
.fatos { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 1px; background: var(--linha); border: 1px solid var(--linha); border-radius: 10px; overflow: hidden; }
.fatos div { background: var(--papel); padding: 14px 16px; }
.fatos b { display: block; font: 700 1.9rem/1.1 var(--serif); font-variant-numeric: tabular-nums; }
.fatos small { color: var(--suave); }
.linhas { display: grid; gap: 14px; }
.linha { display: grid; grid-template-columns: minmax(0, 220px) minmax(0, 1fr) auto; gap: 4px 16px; align-items: center; }
.linha .n { font-weight: 600; } .linha .d { grid-column: 1 / -1; color: var(--suave); font-size: .82rem; margin-top: -4px; }
.barra { height: 10px; background: var(--linha); border-radius: 6px; overflow: hidden; } .barra i { display: block; height: 100%; min-width: 2px; background: linear-gradient(90deg, var(--ouro), var(--ouro2)); }
.num { font-variant-numeric: tabular-nums; color: var(--suave); font-size: .85rem; white-space: nowrap; }
.tabela { overflow-x: auto; border: 1px solid var(--linha); border-radius: 10px; }
table { border-collapse: collapse; width: 100%; min-width: 620px; font-size: .9rem; }
th, td { padding: 9px 12px; text-align: left; border-bottom: 1px solid var(--linha); font-variant-numeric: tabular-nums; }
th { font: 600 .72rem var(--sans); letter-spacing: .1em; text-transform: uppercase; color: var(--suave); background: var(--papel); }
td.pct { width: 34%; } td.pct .barra { display: inline-block; width: calc(100% - 48px); vertical-align: middle; margin-right: 8px; }
.pedidos { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 14px; }
.pedido { background: var(--papel); border: 1px solid var(--linha); border-radius: 10px; padding: 16px; display: grid; gap: 10px; align-content: start; min-width: 0; }
.pedido h3 { margin: 0; font: 600 1.25rem var(--serif); }
.pedido p { margin: 0; font-size: .9rem; }
.pedido button { justify-self: start; font: 600 .8rem var(--sans); color: var(--ouro); background: none; border: 1px solid var(--ouro); border-radius: 6px; padding: 5px 10px; cursor: pointer; }
.pedido button:focus-visible { outline: 2px solid var(--ouro2); outline-offset: 2px; }
.regras { columns: 2 300px; gap: 28px; padding-left: 18px; margin: 0; } .regras li { margin-bottom: 8px; break-inside: avoid; }
</style>
<main>
  <header>
    <div class="eyebrow">${esc(indice.mundo?.era || '')} · semente “${esc(indice.semente)}”</div>
    <h1>${esc(indice.mundo?.nome || 'Vandor')}</h1>
    <p class="lead">${esc(indice.mundo?.magia || 'Um mundo de reinos, ruínas e mares, construído lugar por lugar.')}</p>
  </header>

  <section>
    <svg class="mapa" viewBox="0 0 ${W} ${H}" role="img" aria-label="Mapa de ${esc(indice.mundo?.nome || 'Vandor')} com o nível de construção de cada lugar">${base}${pontos}${marcaPartida}</svg>
    <div class="legenda"><span><i class="nv0" style="background:#1b1206;opacity:.4"></i>nível 0 · só esboço</span><span><i style="background:#ffe9a8"></i>nível 1 · bíblia</span>
      <span><i style="background:#f0b23a"></i>nível 2 · sub-lugares</span><span><i style="background:#ff6a2c"></i>nível 3 · autoral</span><span><i style="background:none;border:2px solid #3cf0a0"></i>ponto de partida</span></div>
  </section>

  <section>
    <div class="grande"><b>${d.total}%</b><div><h2>do mundo construído</h2><p class="lead" style="margin:0">Medido pelos níveis dos ${d.todos.length} lugares. Em peças de conteúdo, são ${totalFeito.toLocaleString('pt-BR')} de ~${totalMeta.toLocaleString('pt-BR')}.</p></div></div>
  </section>

  <section>
    <div class="eyebrow">A imensidão</div><h2>O que existe no mapa</h2>
    <div class="fatos" style="margin-top:14px">
      <div><b>${d.reinos.filter((r) => r.governo && !/sem lei|selvagem/i.test(r.governo)).length}</b><small>reinos</small></div>
      <div><b>${d.reinos.filter((r) => /sem lei|selvagem/i.test(r.governo || '')).length}</b><small>terras sem governo</small></div>
      <div><b>${d.cats.povoado}</b><small>cidades, vilas e fortes</small></div>
      <div><b>${d.cats.natureza}</b><small>lugares selvagens</small></div>
      <div><b>${d.cats.ruina}</b><small>ruínas</small></div>
      <div><b>${d.cats.masmorra}</b><small>masmorras</small></div>
      <div><b>${indice.faccoes?.length || 0}</b><small>facções</small></div>
      <div><b>${indice.planos?.length || 0}</b><small>outros planos</small></div>
    </div>
  </section>

  <section>
    <div class="eyebrow">Feito e a fazer</div><h2>Peças de um mundo completo</h2>
    <p class="lead">Meta estimada: cada povoado com ${META.povoado.subs} sub-lugares, ${META.povoado.pessoas} pessoas e ${META.povoado.eventos} eventos; lugares selvagens com ${META.natureza.eventos}, ruínas com ${META.ruina.eventos}, masmorras com ${META.masmorra.eventos}.</p>
    <div class="linhas" style="margin-top:18px">
      ${d.linhas.map((l) => `<div class="linha"><span class="n">${esc(l.nome)}</span>${barra(l.feito, l.meta)}<span class="d">${esc(l.dica)}</span></div>`).join('')}
    </div>
  </section>

  <section>
    <div class="eyebrow">Reino a reino</div><h2>Construção por território</h2>
    <div class="tabela" style="margin-top:14px"><table>
      <thead><tr><th>Reino / território</th><th>Povo</th><th>Lugares</th><th>Nv 0</th><th>Nv 1</th><th>Nv 2</th><th>Nv 3</th><th>Construído</th></tr></thead>
      <tbody>${d.reinosTab.map((r) => `<tr><td>${esc(r.nome)}</td><td>${esc(r.povo)}</td><td>${r.n}</td>${r.niveis.map((n) => `<td>${n || '·'}</td>`).join('')}<td class="pct"><div class="barra"><i style="width:${r.pct}%"></i></div>${r.pct}%</td></tr>`).join('')}</tbody>
    </table></div>
  </section>

  <section>
    <div class="eyebrow">Como pedir</div><h2>Construindo de pouco em pouco</h2>
    <p class="lead">Peça uma peça de cada vez, sempre com lugar, nível e ligações. O guia completo está em docs/GUIA_AUTORIA.md.</p>
    <div class="pedidos" style="margin-top:16px">
      ${pedidos.map(([t, p], i) => `<div class="pedido"><h3>${esc(t)}</h3><p id="p${i}">${esc(p)}</p><button type="button" data-copiar="p${i}">Copiar pedido</button></div>`).join('')}
    </div>
  </section>

  <section>
    <div class="eyebrow">Regras da casa</div><h2>Para cada pedaço novo</h2>
    <ul class="regras">
      <li>Todo segredo novo precisa de pelo menos duas pistas em lugares diferentes.</li>
      <li>Toda pessoa sabe algo de outro lugar: é assim que o mundo se costura.</li>
      <li>Fatos ficam na bíblia; os eventos só citam fatos que existem.</li>
      <li>Cada texto ganha de 3 a 4 versões, e as tabelas variam por hora e clima.</li>
      <li>Escolhas têm custo. A vida é preciosa, e a cura é rara.</li>
      <li>No máximo 4 opções por cena, sempre com uma saída livre.</li>
      <li>Depois de escrever: validação, playtest e revisão de texto.</li>
      <li>A Semente em mundo/ é a fonte da verdade; o jogo recebe uma cópia.</li>
    </ul>
  </section>
</main>
<script>
document.querySelectorAll('[data-copiar]').forEach((b) => b.addEventListener('click', () => {
  const el = document.getElementById(b.dataset.copiar), txt = el.textContent;
  const ok = () => { b.textContent = 'Copiado'; setTimeout(() => (b.textContent = 'Copiar pedido'), 1500); };
  try { navigator.clipboard.writeText(txt).then(ok, () => { getSelection().selectAllChildren(el); }); } catch { getSelection().selectAllChildren(el); }
}));
</script>
`;
}

if (process.argv[1] && process.argv[1].replace(/\\/g, '/').endsWith('tools/semente/painel.mjs')) {
  const i = process.argv.indexOf('--saida'), saida = i > 0 ? process.argv[i + 1] : 'mundo/painel.html';
  const mundo = carregarMundo('mundo');
  const evs = ['core', 'vandor'].map((p) => `public/data/packs/${p}/events.json`).filter(existsSync).flatMap((f) => JSON.parse(readFileSync(f, 'utf8')));
  writeFileSync(saida, paginaPainel(mundo, evs));
  const d = dadosPainel(mundo, evs);
  console.log(`Painel gravado em ${saida} (${d.total}% construído).`);
}
