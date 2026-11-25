// Desenha o mapa da Semente (SVG) e monta a página de revisão (HTML autocontido) a partir dos arquivos de mundo/.
// Uso: npm run mundo:mapa [-- --pasta mundo]
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const CELULA = 6;
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export function carregarMundo(pasta) {
  const indice = JSON.parse(readFileSync(join(pasta, 'indice.json'), 'utf8'));
  const terreno = JSON.parse(readFileSync(join(pasta, 'terreno.json'), 'utf8'));
  const reinos = indice.reinos.map((r) => JSON.parse(readFileSync(join(pasta, r.arquivo), 'utf8')));
  return { indice, terreno, reinos };
}

/** SVG do mapa: biomas, rios, fronteiras, rotas, povoados e lugares. */
/** base: true = só terreno, rios, fronteiras, rotas e nomes de reinos (camada de fundo do mapa-múndi do jogo). */
export function desenharMapa({ indice, terreno, reinos }, { base = false } = {}) {
  const { largura: W, altura: H, linhas, territorio, legenda } = terreno;
  const corDe = Object.fromEntries(Object.entries(legenda).map(([b, ch]) => [ch, indice.biomas[b]?.cor || '#000']));
  const partes = [];
  // Biomas: retângulos agrupados por sequência na linha (bem menos elementos).
  for (let y = 0; y < H; y++) {
    let x0 = 0;
    for (let x = 1; x <= W; x++) {
      if (x === W || linhas[y][x] !== linhas[y][x0]) {
        partes.push(`<rect x="${x0 * CELULA}" y="${y * CELULA}" width="${(x - x0) * CELULA}" height="${CELULA + 0.5}" fill="${corDe[linhas[y][x0]]}" shape-rendering="crispEdges"/>`);
        x0 = x;
      }
    }
  }
  // Rios.
  for (const rio of terreno.rios) partes.push(`<polyline points="${rio.map(([x, y]) => `${x * CELULA + 3},${y * CELULA + 3}`).join(' ')}" fill="none" stroke="#5b8fc7" stroke-width="1.6" stroke-linejoin="round" opacity=".9"/>`);
  // Fronteiras entre territórios.
  let d = '';
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const a = territorio[y][x]; if (a === '.') continue;
    if (x + 1 < W && territorio[y][x + 1] !== a && territorio[y][x + 1] !== '.') d += `M${(x + 1) * CELULA} ${y * CELULA}v${CELULA}`;
    if (y + 1 < H && territorio[y + 1][x] !== a && territorio[y + 1][x] !== '.') d += `M${x * CELULA} ${(y + 1) * CELULA}h${CELULA}`;
  }
  partes.push(`<path d="${d}" stroke="#1b1206" stroke-width="1.4" stroke-dasharray="3 2" opacity=".75" fill="none"/>`);
  // Rotas.
  const todos = [...reinos.flatMap((r) => r.lugares), ...indice.ermos];
  const pos = new Map(todos.map((l) => [l.id, l]));
  const ESTILO = { estrada: 'stroke="#f0dca8" stroke-width="1.6"', trilha: 'stroke="#e8d7b0" stroke-width="1" stroke-dasharray="2 2"',
    passo: 'stroke="#ffb48a" stroke-width="1.2" stroke-dasharray="4 2"', mar: 'stroke="#bfe3ff" stroke-width="1" stroke-dasharray="1 3"',
    magia: 'stroke="#d6a6ff" stroke-width="1.2" stroke-dasharray="1 4"' };
  const rotas = [...reinos.flatMap((r) => r.rotas), ...indice.rotasEntreReinos];
  for (const r of rotas) {
    const a = pos.get(r.de), b = pos.get(r.para); if (!a || !b) continue;
    partes.push(`<line x1="${a.x * CELULA + 3}" y1="${a.y * CELULA + 3}" x2="${b.x * CELULA + 3}" y2="${b.y * CELULA + 3}" ${ESTILO[r.tipo] || ''} opacity=".85"/>`);
  }
  // Lugares e povoados.
  const COR_CAT = { natureza: '#9fe08a', ruina: '#d0c6b4', masmorra: '#ff6b5a' };
  for (const l of base ? [] : todos) {
    const cx = l.x * CELULA + 3, cy = l.y * CELULA + 3, t = `<title>${esc(l.nome)} · ${esc(l.tipo)}${l.conceito ? ' — ' + esc(l.conceito) : ''}</title>`;
    if (l.categoria === 'povoado') {
      if (l.tipo === 'capital') partes.push(`<g>${t}<circle cx="${cx}" cy="${cy}" r="6" fill="#ffd36b" stroke="#1b1206" stroke-width="1.5"/><circle cx="${cx}" cy="${cy}" r="2.2" fill="#1b1206"/></g>`);
      else if (l.tipo === 'forte') partes.push(`<g>${t}<path d="M${cx} ${cy - 5}l4.5 8h-9z" fill="#e7e1d6" stroke="#1b1206"/></g>`);
      else if (l.tipo === 'mosteiro') partes.push(`<g>${t}<path d="M${cx - 1.2} ${cy - 5}h2.4v3h3v2.4h-3v4.6h-2.4v-4.6h-3v-2.4h3z" fill="#fff" stroke="#1b1206" stroke-width=".8"/></g>`);
      else partes.push(`<g>${t}<circle cx="${cx}" cy="${cy}" r="${l.tipo === 'cidade' || l.tipo === 'porto' ? 4 : 3}" fill="${l.tipo === 'porto' ? '#8fd0ff' : '#fff6e0'}" stroke="#1b1206" stroke-width="1.2"/></g>`);
    } else {
      partes.push(`<g>${t}<path d="M${cx} ${cy - 3}l3 3l-3 3l-3-3z" fill="${COR_CAT[l.categoria] || '#fff'}" stroke="#1b1206" stroke-width=".6"/>${l.crise ? `<circle cx="${cx}" cy="${cy}" r="6" fill="none" stroke="#c34cff" stroke-width="1.4"/>` : ''}</g>`);
    }
  }
  // Rótulos sem sobreposição: cada um procura a posição livre mais próxima (capitais primeiro, depois reinos).
  const caixas = [];
  const colide = (b) => caixas.some((c) => b.x1 < c.x2 && b.x2 > c.x1 && b.y1 < c.y2 && b.y2 > c.y1);
  const rotular = (texto, x, y, tam, cls) => {
    const w = texto.length * tam * 0.62, h = tam + 2, larg = W * CELULA;
    for (const dy of [0, 14, -14, 28, -28, 42, -42, 56, -56]) for (const dx of [0, 40, -40, 80, -80]) {
      const cx = Math.max(w / 2 + 4, Math.min(larg - w / 2 - 4, x + dx)); // nunca sai do mapa
      const b = { x1: cx - w / 2, x2: cx + w / 2, y1: y + dy - h, y2: y + dy + 3 };
      if (!colide(b)) { caixas.push(b); partes.push(`<text x="${cx}" y="${y + dy}" class="${cls}">${esc(texto)}</text>`); return; }
    }
    partes.push(`<text x="${x}" y="${y}" class="${cls}">${esc(texto)}</text>`);
  };
  for (const l of todos.filter((x) => x.categoria === 'povoado')) caixas.push({ x1: l.x * CELULA - 4, x2: l.x * CELULA + 10, y1: l.y * CELULA - 4, y2: l.y * CELULA + 10 });
  if (!base) for (const l of todos.filter((x) => x.tipo === 'capital')) rotular(l.nome, l.x * CELULA + 3, l.y * CELULA + 18, 9, 'rotulo-cap');
  for (const r of reinos) rotular(r.nome, r.territorio.centro.x * CELULA, r.territorio.centro.y * CELULA, 13, 'rotulo-reino');
  if (!base) for (const p of indice.pontosDePartida) { const l = pos.get(p.lugar); if (l) partes.push(`<circle cx="${l.x * CELULA + 3}" cy="${l.y * CELULA + 3}" r="9" fill="none" stroke="#3cf0a0" stroke-width="2"><title>Ponto de partida sugerido: ${esc(l.nome)}</title></circle>`); }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W * CELULA} ${H * CELULA}" class="mapa-mundo">
<style>.rotulo-reino{font:700 13px Georgia,serif;fill:#fff;paint-order:stroke;stroke:#1b1206;stroke-width:3px;text-anchor:middle}
.rotulo-cap{font:600 9px Georgia,serif;fill:#ffe9b0;paint-order:stroke;stroke:#1b1206;stroke-width:2.5px;text-anchor:middle}</style>
<rect width="100%" height="100%" fill="#2a4a6b"/>${partes.join('')}</svg>`;
}

/** Página de revisão: tudo o que precisa ser curado, num lugar só. */
export function paginaRevisao(mundo) {
  const { indice, reinos } = mundo;
  const M = indice.mundo, C = indice.grandeCrise;
  const todos = [...reinos.flatMap((r) => r.lugares), ...indice.ermos];
  const nomeDe = (id) => todos.find((l) => l.id === id)?.nome || id;
  const reinoNome = (id) => reinos.find((r) => r.id === id)?.nome || id;
  const cont = (lista, cat) => lista.filter((l) => l.categoria === cat).length;
  const cultura = (id) => indice.culturas.find((c) => c.id === id);
  const niveis = todos.reduce((a, l) => { a[l.nivel] = (a[l.nivel] || 0) + 1; return a; }, {});
  const card = (r) => {
    const c = cultura(r.cultura);
    return `<article class="reino" id="r-${r.id}"><h3>${esc(r.nome)}</h3>
      <p class="sub">${esc(r.tipo === 'reino' ? `${r.governo} · ${c?.nome} (${indice.culturas.length ? c && ({ humanos: 'humanos', anoes: 'anões', elfos: 'elfos', halflings: 'halflings', orcs: 'orcs', gigantes: 'gigantes', marinos: 'povo das marés' })[c.povo] : ''})` : r.governo)}
      · capital: ${esc(nomeDe(r.capital) || '—')}</p>
      <p>${esc(r.descricao)}</p><p class="tensao">⚔ ${esc(r.tensao)}</p>
      ${Object.keys(r.relacoes).length ? `<p class="rel">${Object.entries(r.relacoes).map(([k, v]) => `<span class="tag t-${v.replace(/ /g, '-')}">${esc(v)}: ${esc(reinoNome(k))}</span>`).join(' ')}</p>` : ''}
      ${r.economia ? `<p class="eco">Produz: ${esc(r.economia.produz.join(', '))}${r.economia.precisa?.length ? ` · Precisa: ${esc(r.economia.precisa.join(', '))}` : ''}</p>` : ''}
      ${c ? `<p class="eco">Costumes: ${esc(c.comida)}; festa: ${esc(c.festa)}.</p>` : ''}
      <p class="num">${r.lugares.length} lugares: ${cont(r.lugares, 'povoado')} povoados · ${cont(r.lugares, 'natureza')} natureza · ${cont(r.lugares, 'ruina')} ruínas · ${cont(r.lugares, 'masmorra')} masmorras</p>
      <details><summary>Ver lugares</summary><ul>${r.lugares.map((l) => `<li><b>${esc(l.nome)}</b> <small>${esc(l.tipo)} · perigo ${l.perigo}${l.crise ? ' · <i>Grande Crise</i>' : ''}</small><br><span>${esc(l.conceito)}</span></li>`).join('')}</ul></details></article>`;
  };
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(M.nome)} · Semente do Mundo</title><style>
:root{--bg:#14110d;--p:#1f1a14;--l:#3a332b;--t:#e8e0d4;--m:#a2978a;--a:#d4a24c}
body{margin:0;background:var(--bg);color:var(--t);font:15px/1.55 system-ui,sans-serif}
main{max-width:1200px;margin:0 auto;padding:24px 16px 60px}h1,h2,h3{font-family:Georgia,serif;color:var(--a);margin:.2em 0}
h1{font-size:2.4rem}h2{margin-top:36px;border-bottom:1px solid var(--l);padding-bottom:6px}.sub{color:var(--m)}
.mapa{overflow:auto;border:1px solid var(--l);border-radius:10px;background:#2a4a6b}.mapa svg{display:block;width:100%;min-width:900px;height:auto}
.leg{display:flex;flex-wrap:wrap;gap:12px;font-size:.85rem;color:var(--m);margin:8px 0}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(340px,1fr));gap:14px}
.reino,.box{background:var(--p);border:1px solid var(--l);border-radius:10px;padding:14px}.reino p{margin:.4em 0}
.tensao{color:#f0a08a}.eco,.num{color:var(--m);font-size:.9rem}.tag{display:inline-block;font-size:.75rem;padding:1px 7px;border-radius:9px;border:1px solid var(--l);margin:2px}
.t-aliança,.t-comércio{color:#8fd49a}.t-rivalidade,.t-guerra-fria,.t-desconfiança{color:#e6bd6c}.t-guerra-aberta{color:#f08a7e}
details ul{padding-left:18px;max-height:320px;overflow:auto}details li{margin-bottom:6px}small{color:var(--m)}
ol.tempo li{margin-bottom:6px}.ato{border-left:3px solid #c34cff;padding-left:10px;margin:8px 0}
.est td{padding:3px 12px 3px 0}.aviso{background:#2a2015;border:1px solid var(--a);border-radius:10px;padding:12px 14px}
</style></head><body><main>
<h1>${esc(M.nome)}</h1><p class="sub">${esc(M.era)} · Semente "${esc(indice.semente)}" · <b>${esc(indice.status)}</b></p>
<p class="aviso">Este é o <b>rascunho gerado</b> do mundo. Revise nomes, reinos, tensões, a Grande Crise e escolha o ponto de partida.
O que você mudar vira a versão oficial; o gerador não sobrescreve a Semente curada.</p>
<p>${esc(M.magia)}</p>
<h2>Mapa</h2><div class="mapa">${desenharMapa(mundo)}</div>
<p class="leg"><span>● amarelo: capital</span><span>● branco: cidade/vila</span><span>● azul: porto</span><span>▲ forte</span><span>✚ mosteiro</span>
<span>◆ verde: natureza</span><span>◆ cinza: ruína</span><span>◆ vermelho: masmorra</span><span>◯ roxo: Grande Crise</span><span>◯ verde: ponto de partida</span>
<span>— estrada · ‐‐ trilha · laranja: passo de montanha · pontilhado azul: mar · lilás: só por magia</span></p>
<h2>Pontos de partida sugeridos</h2><div class="grid">${indice.pontosDePartida.map((p) => `<div class="box"><h3>${esc(p.nome)}</h3><p>${esc(p.motivo)}</p></div>`).join('')}</div>
<h2>A Grande Crise: ${esc(C.nome)}</h2><p>${esc(C.conceito)}</p>
<p class="sub">Origem: ${esc(nomeDe(C.origem))} · Reino mais afetado: ${esc(reinoNome(C.reinoAfetado))} · Pistas em: ${C.pistas.map((p) => esc(nomeDe(p))).join(', ')}</p>
${C.atos.map((a) => `<div class="ato"><b>Ato ${a.ato}.</b> ${esc(a.texto)}</div>`).join('')}
<h2>Linha do tempo</h2><ol class="tempo">${M.linhaDoTempo.map((m) => `<li><b>Ano ${m.ano}</b> — ${esc(m.texto)}</li>`).join('')}</ol>
<h2>Reinos e territórios (${reinos.length})</h2><div class="grid">${reinos.map(card).join('')}</div>
<h2>Continentes e mares</h2><div class="grid">${indice.continentes.map((c) => `<div class="box"><h3>${esc(c.nome)}</h3><p>${c.reinos.map((r) => esc(reinoNome(r))).join(', ') || 'sem reinos'}</p></div>`).join('')}
${indice.mares.map((m) => `<div class="box"><h3>${esc(m.nome)}</h3></div>`).join('')}</div>
<h2>Panteão</h2><div class="grid">${M.panteao.map((d) => `<div class="box"><h3>${esc(d.nome)}</h3><p>${esc(d.dominio)}</p><p class="sub">Cultuado por: ${d.cultos.map((c) => esc(cultura(c)?.nome || c)).join(', ')}</p></div>`).join('')}</div>
<h2>Facções</h2><div class="grid">${indice.faccoes.map((f) => `<div class="box"><h3>${esc(f.nome)}</h3><p>${esc(f.objetivo)}</p><p class="sub">Sede: ${esc(nomeDe(f.sede))} · atua em ${f.atuacao.map((r) => esc(reinoNome(r))).join(', ')}</p></div>`).join('')}</div>
<h2>Planos de existência</h2><div class="grid">${indice.planos.map((p) => `<div class="box"><h3>${esc(p.nome)}</h3><p>${esc(p.conceito)}</p><p class="sub">Portal provável: ${esc(nomeDe(p.portal) || '—')}</p></div>`).join('')}</div>
<h2>Mistérios em aberto</h2><ul>${M.misterios.map((m) => `<li>${esc(m.texto)}</li>`).join('')}</ul>
<h2>Construção</h2><table class="est"><tr><td>Lugares no total</td><td>${todos.length}</td></tr>
${[0, 1, 2, 3].map((n) => `<tr><td>Nível ${n}</td><td>${niveis[n] || 0}</td></tr>`).join('')}
<tr><td>Rotas</td><td>${reinos.reduce((a, r) => a + r.rotas.length, 0) + indice.rotasEntreReinos.length}</td></tr></table>
</main></body></html>`;
}

if (process.argv[1] && process.argv[1].replace(/\\/g, '/').endsWith('tools/semente/mapa.mjs')) {
  const i = process.argv.indexOf('--pasta'), pasta = i > 0 ? process.argv[i + 1] : 'mundo';
  const mundo = carregarMundo(pasta);
  writeFileSync(join(pasta, 'mapa.svg'), desenharMapa(mundo));
  writeFileSync(join(pasta, 'revisao.html'), paginaRevisao(mundo));
  console.log(`Mapa e página de revisão gravados em ${pasta}/ (mapa.svg, revisao.html).`);
}
