// UI: telas de título, criação, jogo e morte. Só lê o estado e chama a API do Game.
import { loadContent } from './engine/content.js';
import { newState, Game } from './engine/game.js';
import { markovName } from './engine/names.js';
import { Rng } from './engine/rng.js';
import { describeMods } from './engine/items.js';
import { ATRIBUTOS, SLOTS_EQUIP } from './engine/hero.js';
import { PERIODO_NOME, MAX_EXAUSTAO, xpParaNivel } from './engine/rules.js';
import { conexoes } from './engine/world.js';
import { npcVar, rotuloDisposicao } from './engine/npcs.js';
import { contratante } from './engine/quests.js';
import { Ambience } from './audio/ambience.js';
import * as store from './storage.js';

const app = document.getElementById('app');
const audio = new Ambience();
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const ATTR_NOME = { forca: 'Força', agilidade: 'Agilidade', mente: 'Mente', presenca: 'Presença' };
const CLIMA_NOME = { limpo: 'Céu limpo', chuva: 'Chuva', nevoa: 'Névoa', vento: 'Vento', neve: 'Neve' };
const SLOT_NOME = { arma: 'Arma', armadura: 'Armadura', amuleto: 'Amuleto', consumivel: 'Consumível', ferramenta: 'Ferramenta' };
const nameRng = new Rng(String(Date.now()));

let content, game, history = [], tab = 'ficha';

// ---------- Boot ----------
(async function boot() {
  try {
    content = await loadContent((p) => fetch(`data/packs/${p}`).then((r) => { if (!r.ok) throw new Error(p); return r.json(); }));
  } catch (e) {
    app.innerHTML = `<p class="loading">Falha ao carregar conteúdo (${esc(e.message)}).<br>Rode com um servidor local: <code>npm run dev</code></p>`;
    return;
  }
  titleScreen();
})();

function audioBtn() {
  return `<button class="icon-btn" data-act="audio">${audio.on ? '♪ som: ligado' : '♪ som: desligado'}</button>`;
}
function toggleAudio() {
  if (audio.on) audio.stop(); else audio.start();
  store.setPrefs({ audio: audio.on });
  document.querySelectorAll('[data-act="audio"]').forEach((b) => (b.outerHTML = audioBtn()));
  bindAudio();
}
function bindAudio() { document.querySelectorAll('[data-act="audio"]').forEach((b) => (b.onclick = toggleAudio)); }
function maybeStartAudio() { if (store.prefs().audio && !audio.on) audio.start(); }

// ---------- Título ----------
function titleScreen() {
  const save = store.loadSave();
  const mem = store.memorial();
  app.innerHTML = `
    <div class="screen title">
      <h1>SoloLevel</h1>
      <p>Um mundo que se escreve enquanto você caminha.</p>
      <div class="stack">
        ${save ? `<button class="btn primary" data-act="continue">Continuar: ${esc(save.heroi.nome)}, dia ${save.dia}</button>` : ''}
        <button class="btn ${save ? '' : 'primary'}" data-act="new">Nova jornada</button>
        ${audioBtn()}
      </div>
      ${mem.length ? `<div class="stack" style="margin-top:40px;text-align:left">
        <div class="sec">Memorial dos caídos</div>
        ${mem.slice(0, 6).map((m) => `<div class="entry"><b>${esc(m.nome)}</b> — ${esc(m.classe)}, nível ${m.nivel}<small>${esc(m.epitafio)}</small></div>`).join('')}
      </div>` : ''}
    </div>`;
  app.querySelector('[data-act="new"]').onclick = () => { maybeStartAudio(); creationScreen(); };
  const c = app.querySelector('[data-act="continue"]');
  if (c) c.onclick = () => { maybeStartAudio(); startGame(save); };
  bindAudio();
}

// ---------- Criação de personagem (sem digitar nada) ----------
function creationScreen() {
  const sel = { classe: content.classes[0].id, genero: 'm', nome: markovName(nameRng, content.names.pessoas) };
  const render = () => {
    app.innerHTML = `
      <div class="screen">
        <h2>Quem caminha esta estrada?</h2>
        <div class="classes">
          ${content.classes.map((c) => `
            <button class="card ${c.id === sel.classe ? 'sel' : ''}" data-classe="${c.id}">
              <h3>${esc(c.nome[sel.genero] || c.nome.m)}</h3>
              <p>${esc(c.descricao)}</p>
              <div class="attrs">
                ${ATRIBUTOS.map((a) => `<span>${ATTR_NOME[a]}</span><b>${c.atributos[a] >= 0 ? '+' : ''}${c.atributos[a]}</b>`).join('')}
                <span>Vida</span><b>${c.hp}</b><span>Energia</span><b>${c.energia}</b>
              </div>
              <p style="margin:10px 0 0">${(c.tracos || []).map((t) => `<b style="color:var(--exh)">${esc(content.traits[t]?.nome)}</b>: ${esc(content.traits[t]?.descricao)}`).join('<br>')}</p>
            </button>`).join('')}
        </div>
        <div class="row seg">
          <span class="sec" style="margin:0">Gênero</span>
          <button class="btn ${sel.genero === 'm' ? 'sel' : ''}" data-g="m">Masculino</button>
          <button class="btn ${sel.genero === 'f' ? 'sel' : ''}" data-g="f">Feminino</button>
        </div>
        <div class="row">
          <span class="sec" style="margin:0">Nome</span>
          <span class="nome">${esc(sel.nome)}</span>
          <button class="btn" data-act="reroll">Outro nome</button>
        </div>
        <div class="row">
          <button class="btn primary" data-act="start">Começar a jornada</button>
          <button class="btn ghost" data-act="back">Voltar</button>
        </div>
      </div>`;
    app.querySelectorAll('[data-classe]').forEach((b) => (b.onclick = () => { sel.classe = b.dataset.classe; render(); }));
    app.querySelectorAll('[data-g]').forEach((b) => (b.onclick = () => { sel.genero = b.dataset.g; render(); }));
    app.querySelector('[data-act="reroll"]').onclick = () => { sel.nome = markovName(nameRng, content.names.pessoas); render(); };
    app.querySelector('[data-act="back"]').onclick = titleScreen;
    app.querySelector('[data-act="start"]').onclick = () => startGame(newState(content, { ...sel, seed: `${sel.nome}-${Date.now()}` }));
  };
  render();
}

// ---------- Jogo ----------
function startGame(state) {
  game = new Game(content, state);
  history = [];
  tab = 'ficha';
  renderGame();
}

function act(fn, newScene = true) {
  const prev = game.s.cena;
  fn();
  if (newScene && prev && prev !== game.s.cena && !game.s.morto) history = [...history, prev].slice(-2);
  persist();
  renderGame();
}

function persist() {
  const s = game.s;
  if (s.morto) {
    const ep = s.cena.blocos.filter((b) => b.tipo === 'texto').pop()?.texto || '';
    if (!s.memorializado) {
      s.memorializado = true;
      const cls = content.classes.find((c) => c.id === s.heroi.classe);
      store.addMemorial({ nome: s.heroi.nome, classe: cls?.nome[s.heroi.genero] || '', nivel: s.heroi.nivel, dia: s.dia, epitafio: ep });
    }
    store.clearSave();
  } else store.saveGame(s);
}

function renderGame() {
  const s = game.s, loc = content.location(s), bioma = content.biome(s);
  audio.set({ audio: bioma.audio, periodo: s.periodo, clima: s.clima, modo: s.cena.modo });
  app.innerHTML = `
    <div class="game">
      <div class="main">
        <div class="topbar">
          <div><div class="where">${esc(loc.nome)}</div>
            <div class="when">Dia ${s.dia} · ${PERIODO_NOME[s.periodo]} · ${CLIMA_NOME[s.clima] || s.clima} · ${esc(bioma.nome)}</div></div>
          <div class="row" style="margin:0">${audioBtn()}<button class="icon-btn" data-act="menu">menu</button></div>
        </div>
        <div class="story">
          ${history.map((c) => sceneHtml(c, true)).join('')}
          ${sceneHtml(s.cena, false)}
        </div>
      </div>
      <aside class="side">${sideHtml()}</aside>
    </div>`;
  bindAudio();
  app.querySelector('[data-act="menu"]').onclick = titleScreen;
  app.querySelectorAll('[data-opt]').forEach((b) => (b.onclick = () => act(() => game.choose(+b.dataset.opt))));
  app.querySelectorAll('[data-tab]').forEach((b) => (b.onclick = () => { tab = b.dataset.tab; renderGame(); }));
  app.querySelectorAll('[data-use]').forEach((b) => (b.onclick = () => act(() => game.usarItem(+b.dataset.use), false)));
  app.querySelectorAll('[data-equip]').forEach((b) => (b.onclick = () => act(() => game.equiparItem(+b.dataset.equip), false)));
  app.querySelectorAll('[data-drop]').forEach((b) => (b.onclick = () => act(() => game.descartarItem(+b.dataset.drop), false)));
  app.querySelectorAll('[data-abandon]').forEach((b) => (b.onclick = () => act(() => game.abandonarMissao(+b.dataset.abandon), false)));
  app.querySelectorAll('[data-maptravel]').forEach((b) => (b.onclick = () => act(() => game.choose(+b.dataset.maptravel))));
  const nova = app.querySelector('[data-act="again"]');
  if (nova) nova.onclick = creationScreen;
  const cur = app.querySelector('.scene:not(.old)');
  if (cur && history.length) cur.scrollIntoView({ block: 'start', behavior: 'smooth' });
}

function sceneHtml(cena, old) {
  const blocos = cena.blocos.map((b) =>
    b.tipo === 'texto' ? `<p class="txt">${esc(b.texto)}</p>`
    : b.tipo === 'rolagem' ? `<span class="rollb ${b.classe}">${esc(b.texto)}</span>`
    : `<span class="note ${b.classe}">${esc(b.texto)}</span>`).join('');
  if (old) return `<div class="scene old">${blocos}</div>`;
  let extra = '';
  if (cena.modo === 'combate' && game.s.combate) {
    const e = content.enemies[game.s.combate.id], c = game.s.combate;
    extra = `<div class="foe"><b>${esc(e.nome.charAt(0).toUpperCase() + e.nome.slice(1))}</b> ${bar('', c.hp, c.hpMax, 'var(--hp)')}</div>`;
  }
  if (cena.modo === 'morte') {
    const h = game.s.heroi;
    extra = `<div class="death"><h2>Fim da jornada</h2>
      <p>${esc(h.nome)} chegou ao nível ${h.nivel} e resistiu ${game.s.dia} dia(s).</p>
      <button class="btn primary" data-act="again">Nova jornada</button></div>`;
  }
  const ops = cena.opcoes.map((o, i) => `
    <button class="btn ${cena.modo === 'combate' ? 'combate' : ''} ${o.destaque ? 'destaque' : ''}" data-opt="${i}" ${o.desativada ? 'disabled' : ''}>
      <span>${esc(o.rotulo)}${o.item ? ` <small class="dica">${esc(describeMods(o.item))}</small>` : ''}</span>
      ${o.dica ? `<span class="dica">${esc(o.dica)}</span>` : ''}
    </button>`).join('');
  return `<div class="scene">${blocos}${extra}<div class="options">${ops}</div></div>`;
}

function bar(lbl, v, max, color, cls = '') {
  return `<div class="bar ${cls}"><div class="lbl"><span>${lbl}</span><span>${v} / ${max}</span></div>
    <div class="track"><div class="fill" style="width:${Math.max(0, Math.min(100, (v / max) * 100))}%;background:${color}"></div></div></div>`;
}

function sideHtml() {
  const s = game.s;
  const tabs = [['ficha', 'Ficha'], ['mochila', `Mochila (${s.heroi.inventario.length})`], ['mapa', 'Mapa'],
    ['jornada', `Jornada (${s.missoes.length + s.fios.length})`], ['diario', 'Diário']];
  if (!tabs.some(([id]) => id === tab)) tab = 'ficha';
  const body = { ficha: fichaHtml, mochila: mochilaHtml, mapa: mapaHtml, jornada: jornadaHtml, diario: diarioHtml }[tab]();
  return `<div class="tabs">${tabs.map(([id, n]) => `<button class="${tab === id ? 'sel' : ''}" data-tab="${id}">${n}</button>`).join('')}</div>
    <div class="pane">${body}</div>`;
}

function fichaHtml() {
  const h = game.s.heroi, st = game.stats();
  const cls = content.classes.find((c) => c.id === h.classe);
  return `
    <p class="hero-name">${esc(h.nome)}</p>
    <div class="hero-sub">${esc(cls?.nome[h.genero] || '')} · nível ${h.nivel} · ${h.xp}/${xpParaNivel(h.nivel)} XP</div>
    ${bar('Vida', h.hp, h.hpMax, 'var(--hp)', 'hp')}
    ${bar('Energia', h.energia, h.energiaMax, 'var(--energy)')}
    <div class="bar"><div class="lbl"><span>Exaustão</span><span>${st.penalidade ? `−${st.penalidade} nos testes` : ''}</span></div>
      <div class="pips">${Array.from({ length: MAX_EXAUSTAO }, (_, i) => `<i class="${i < h.exaustao ? 'on' : ''}"></i>`).join('')}</div></div>
    <div class="kv">
      ${ATRIBUTOS.map((a) => `<span>${ATTR_NOME[a]}</span><span>${st.attrs[a] >= 0 ? '+' : ''}${st.attrs[a]}</span>`).join('')}
      <span>Defesa</span><span>${st.defesa}</span>
      <span>Dano</span><span>${st.arma?.dano || '1d3'}${st.danoBonus ? (st.danoBonus > 0 ? '+' : '') + st.danoBonus : ''}</span>
      <span>Ouro</span><span>${h.ouro}</span>
    </div>
    <div class="sec">Traços</div>
    ${h.tracos.map((t) => `<div class="trait"><b>${esc(content.traits[t]?.nome || t)}</b> — ${esc(content.traits[t]?.descricao || '')}</div>`).join('') || '<p class="empty">Nenhum.</p>'}
    <div class="sec">Equipado</div>
    ${SLOTS_EQUIP.map((sl) => { const it = h.inventario.find((i) => i.uid === h.equipado[sl]); return it ? itemHtml(it, true) : `<p class="empty">${SLOT_NOME[sl]}: vazio</p>`; }).join('')}`;
}

function itemHtml(it, eq) {
  const morto = game.s.morto;
  const acts = morto ? '' : [
    it.slot === 'consumivel' ? `<button data-use="${it.uid}">Usar</button>` : '',
    SLOTS_EQUIP.includes(it.slot) ? `<button data-equip="${it.uid}">${eq ? 'Desequipar' : 'Equipar'}</button>` : '',
    `<button data-drop="${it.uid}">Descartar</button>`,
  ].join('');
  return `<div class="item r-${it.raridade} ${eq ? 'eq' : ''}">
    <div class="n">${esc(it.nome)}</div>
    <div class="m">${SLOT_NOME[it.slot]}${it.raridade !== 'comum' ? ' · ' + it.raridade : ''}${describeMods(it) ? ' · ' + esc(describeMods(it)) : ''} · ${it.valor} ouro</div>
    <div class="acts">${acts}</div></div>`;
}

function mochilaHtml() {
  const h = game.s.heroi;
  if (!h.inventario.length) return '<p class="empty">Mochila vazia.</p>';
  const eqIds = Object.values(h.equipado);
  return `<div class="sec" style="margin-top:0">${h.inventario.length} / 12 espaços</div>` +
    h.inventario.map((it) => itemHtml(it, eqIds.includes(it.uid))).join('');
}

function jornadaHtml() {
  const s = game.s;
  const missoes = s.missoes.map((m) => {
    const npc = contratante(game, m), dest = game.loc(m.destino), orig = game.loc(m.origem);
    const status = m.estado === 'cumprida' ? `Cumprida: volte a ${npc?.nome} em ${orig?.nome}`
      : m.objetivo === 'chegar' ? `Leve o pacote até ${dest?.nome}` : `Vá até ${dest?.nome}`;
    return `<div class="quest ${m.estado}"><div class="n">${esc(m.titulo)}</div>
      <div class="m">${esc(status)} · ${m.ouro} ouro · ${m.xp} XP</div>
      <div class="m">Contratante: ${esc(npc?.nome)}, dia ${m.aceita}</div>
      <div class="acts"><button data-abandon="${m.uid}">Abandonar</button></div></div>`;
  }).join('') || '<p class="empty">Nenhuma missão. Procure trabalho em locais seguros.</p>';
  const fios = s.fios.map((x) => `<div class="entry">${esc(content.threads[x.id]?.texto)}<small>desde o dia ${x.desde}</small></div>`).join('')
    || '<p class="empty">Nenhuma ponta solta. Por enquanto.</p>';
  const pessoas = Object.values(s.npcs).sort((a, b) => (b.visto || 0) - (a.visto || 0)).slice(0, 12).map((n) => {
    const v = npcVar(game, n), l = game.loc(n.local);
    return `<div class="entry"><b>${esc(n.nome)}</b>, ${esc(v.oficio)} ${esc(v.temperamento)}
      <span class="disp d${Math.sign(n.disposicao)}">${rotuloDisposicao(n.disposicao)}</span><small>${esc(l?.nome || '')} · ${n.encontros} encontro(s)</small></div>`;
  }).join('') || '<p class="empty">Ninguém conhece você ainda.</p>';
  return `<div class="sec" style="margin-top:0">Missões (${s.missoes.length}/3)</div>${missoes}
    <div class="sec">Fios soltos</div>${fios}<div class="sec">Pessoas</div>${pessoas}`;
}

const COR_BIOMA = { vila: '#d4a24c', estrada: '#a2978a', floresta: '#6fb37a', pantano: '#7f8f4e', montanha: '#9aa6b2',
  ruinas: '#9a6ad4', costa: '#5aa0e0' };

/** Mapa com névoa: visitados com nome, vizinhos como "?", o resto oculto. Clicar num vizinho viaja. */
function mapaHtml() {
  const s = game.s, visit = new Set(s.visitados), conhecidos = new Set(visit);
  for (const id of visit) for (const cx of conexoes(game, id)) conhecidos.add(cx.para);
  const viaveis = new Map();
  if (s.cena.modo === 'local') s.cena.opcoes.forEach((o, i) => { if (o.acao.tipo === 'viajar') viaveis.set(o.acao.para, i); });
  const alvos = new Set(s.missoes.map((m) => (m.estado === 'cumprida' ? m.origem : m.destino)));
  const nodes = [...conhecidos].map((id) => game.loc(id)).filter((l) => l && l.x != null);
  // Enquadra a área conhecida (zoom automático); k escala raios e textos.
  const xs = nodes.map((l) => l.x), ys = nodes.map((l) => l.y);
  const size = Math.min(110, Math.max(36, Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys)) + 24);
  const cx = (Math.max(...xs) + Math.min(...xs)) / 2, cy = (Math.max(...ys) + Math.min(...ys)) / 2;
  const vb = `${(cx - size / 2).toFixed(1)} ${(cy - size / 2).toFixed(1)} ${size.toFixed(1)} ${size.toFixed(1)}`;
  const k = size / 100;
  const edges = [], vistos = new Set();
  for (const l of nodes) {
    for (const cx of conexoes(game, l.id)) {
      const d = game.loc(cx.para), k = [l.id, cx.para].sort().join('|');
      if (!d || !conhecidos.has(d.id) || vistos.has(k) || (!visit.has(l.id) && !visit.has(d.id))) continue;
      vistos.add(k);
      edges.push(`<line x1="${l.x}" y1="${l.y}" x2="${d.x}" y2="${d.y}" stroke-width="${(.5 * k).toFixed(2)}" class="${visit.has(l.id) && visit.has(d.id) ? 'e-vis' : 'e-fog'}"/>`);
    }
  }
  const circles = nodes.map((l) => {
    const v = visit.has(l.id), atual = l.id === s.local, r = (l.gerado ? 2 : 2.8) * k;
    const cor = COR_BIOMA[l.bioma] || '#a2978a';
    const clic = viaveis.has(l.id) ? `data-maptravel="${viaveis.get(l.id)}" class="n-go"` : '';
    // Rótulos perto da borda alinham para dentro.
    const rel = (l.x - (cx - size / 2)) / size;
    const anchor = rel > 0.8 ? 'end' : rel < 0.2 ? 'start' : 'middle';
    const a = 1.4 * k;
    return `<g ${clic}>
      ${atual ? `<circle cx="${l.x}" cy="${l.y}" r="${r + 2.2 * k}" stroke-width="${(.6 * k).toFixed(2)}" class="n-atual"/>` : ''}
      <circle cx="${l.x}" cy="${l.y}" r="${r}" fill="${v ? cor : 'none'}" stroke="${cor}" stroke-width="${(.6 * k).toFixed(2)}" ${v ? '' : 'stroke-dasharray="1 .8" opacity=".7"'}/>
      ${alvos.has(l.id) ? `<path d="M${l.x + r + a / 2} ${l.y - r - 2 * a} l${a} ${a} -${a} ${a} -${a} -${a}z" class="n-alvo"/>` : ''}
      <text x="${l.x}" y="${l.y + r + 3.4 * k}" font-size="${(2.7 * k).toFixed(2)}" text-anchor="${anchor}" stroke-width="${(.8 * k).toFixed(2)}" class="${v ? 'lbl' : 'lbl fog'}">${v ? esc(l.nome) : '?'}</text>
      <title>${v ? esc(l.nome) : 'Inexplorado'}${viaveis.has(l.id) ? ' (clique para viajar)' : ''}</title></g>`;
  }).join('');
  const total = Object.keys(content.locations).length + Object.keys(s.locais).length;
  return `<div class="sec" style="margin-top:0">Mundo conhecido · ${visit.size}/${total} locais visitados</div>
    <svg class="map" viewBox="${vb}" role="img" aria-label="Mapa do mundo">${edges.join('')}${circles}</svg>
    <p class="maplegend"><span class="lg-cur"></span>você <span class="lg-q"></span>missão <span class="lg-fog"></span>inexplorado</p>
    ${viaveis.size ? '<p class="empty">Toque num local vizinho para viajar.</p>' : ''}`;
}

function diarioHtml() {
  return [...game.s.diario].reverse().map((e) =>
    `<div class="entry">${esc(e.texto)}<small>Dia ${e.dia} · ${PERIODO_NOME[e.periodo]}</small></div>`).join('') || '<p class="empty">Páginas em branco.</p>';
}
