// UI: telas de título, criação, jogo e morte. Só lê o estado e chama a API do Game.
import { loadContent } from './engine/content.js';
import { newState, Game } from './engine/game.js';
import { nomePessoa } from './engine/names.js';
import { Rng } from './engine/rng.js';
import { describeMods } from './engine/items.js';
import { ATRIBUTOS, SLOTS_EQUIP, compararEquip } from './engine/hero.js';
import { PERIODO_NOME, MAX_EXAUSTAO, xpParaNivel } from './engine/rules.js';
import { conexoes } from './engine/world.js';
import { npcVar, rotuloDisposicao } from './engine/npcs.js';
import { contratante } from './engine/quests.js';
import { AudioEngine } from './audio/engine.js';
import { cuesFrom } from './audio/cues.js';
import { Narrador } from './voice.js';
import { VOZES_NEURAIS } from './voz-neural.js';
import * as store from './storage.js';
import { Cenario } from './visual/cenario.js';
import { icone, dadoHtml } from './visual/icones.js';

const app = document.getElementById('app');
let P = store.prefs();
const audio = new AudioEngine();
audio.setVolumes(P.vol);
const narr = new Narrador();
narr.cfg = { ...P.voz };
if (narr.cfg.motor === 'neural') narr.atualizarNeural().then(() => { if (modal === 'ajustes') abrirAjustes(); });
narr.onEstado = (v) => { audio.abafar(v); document.querySelectorAll('[data-act="ler"]').forEach((b) => b.classList.toggle('on', v)); };
narr.onVozes = () => { if (modal === 'ajustes') abrirAjustes(); };
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const ATTR_NOME = { forca: 'Força', agilidade: 'Agilidade', mente: 'Mente', presenca: 'Presença' };
const CLIMA_NOME = { limpo: 'Céu limpo', chuva: 'Chuva', nevoa: 'Névoa', vento: 'Vento', neve: 'Neve' };
const SLOT_NOME = { arma: 'Arma', armadura: 'Armadura', amuleto: 'Amuleto', consumivel: 'Consumível', ferramenta: 'Ferramenta' };
const nameRng = new Rng(String(Date.now()));

let content, game, history = [], tab = 'ficha', modal = null, folhaAberta = false, mapaView = null;
const cenario = new Cenario(document.getElementById('cenario'));
cenario.iniciar();
let tResize = 0, eraCelular = null;
addEventListener('resize', () => {
  clearTimeout(tResize);
  tResize = setTimeout(() => {
    // Só redesenha quando cruza o limite celular/computador (o cenário se ajusta sozinho).
    if (game && app.querySelector('.jogo') && ehCelular() !== eraCelular) { eraCelular = ehCelular(); renderGame(); }
  }, 150);
});
const salvarPrefs = (p) => { P = { ...P, ...p }; store.setPrefs(p); };

// ---------- Boot ----------
(async function boot() {
  try {
    content = await loadContent((p) => fetch(`data/packs/${p}`).then((r) => { if (!r.ok) throw new Error(p); return r.json(); }));
  } catch (e) {
    app.innerHTML = `<p class="loading">Falha ao carregar conteúdo (${esc(e.message)}).<br>Rode com um servidor local: <code>npm run dev</code></p>`;
    return;
  }
  document.addEventListener('keydown', teclado);
  titleScreen();
})();

function audioBtn() {
  return `<button class="ibtn ${audio.on ? 'on' : ''}" data-act="audio" title="Som ${audio.on ? 'ligado' : 'desligado'}" aria-label="Som">${icone(audio.on ? 'som' : 'mudo')}</button>`;
}
function toggleAudio() {
  if (audio.on) audio.stop(); else audio.start();
  salvarPrefs({ audio: audio.on });
  document.querySelectorAll('[data-act="audio"]').forEach((b) => (b.outerHTML = audioBtn()));
  bindAudio();
}
function bindAudio() { document.querySelectorAll('[data-act="audio"]').forEach((b) => (b.onclick = toggleAudio)); }
function maybeStartAudio() { if (P.audio && !audio.on) audio.start(); }

// ---------- Título ----------
function titleScreen() {
  cenario.set({ bioma: 'estrada', periodo: 'madrugada', clima: 'nevoa', modo: 'titulo', seed: 'titulo', area: 0.62 });
  const save = store.loadSave();
  const mem = store.memorial();
  app.innerHTML = `
    <div class="screen title">
      <h1>SoloLevel</h1>
      <p>Um mundo que se escreve enquanto você caminha.</p>
      <div class="stack">
        ${save ? `<button class="btn primary" data-act="continue">Continuar: ${esc(save.heroi.nome)}, dia ${save.dia}</button>` : ''}
        <button class="btn ${save ? '' : 'primary'}" data-act="new">Nova jornada</button>
        <div class="row" style="justify-content:center;margin:4px 0 0">${audioBtn()}<button class="ibtn" data-act="ajustes" title="Ajustes" aria-label="Ajustes">${icone('ajustes')}</button><button class="btn ghost" data-act="tutorial">Como jogar</button></div>
      </div>
      ${mem.length ? `<div class="stack" style="margin-top:40px;text-align:left">
        <div class="sec">Memorial dos caídos</div>
        ${mem.slice(0, 6).map((m) => `<div class="entry"><b>${esc(m.nome)}</b> — ${esc(m.classe)}, nível ${m.nivel}<small>${esc(m.epitafio)}</small></div>`).join('')}
      </div>` : ''}
    </div>`;
  app.querySelector('[data-act="new"]').onclick = () => { maybeStartAudio(); creationScreen(); };
  const c = app.querySelector('[data-act="continue"]');
  if (c) c.onclick = () => { maybeStartAudio(); startGame(save); };
  bindAudio(); bindModais();
}

// ---------- Criação de personagem (sem digitar nada) ----------
function creationScreen() {
  cenario.set({ bioma: 'vila', periodo: 'manha', clima: 'limpo', modo: 'criacao', seed: 'criacao', area: 0.5 });
  const sel = { classe: content.classes[0].id, genero: 'm', nome: nomePessoa(nameRng, content.names, 'm') };
  const render = () => {
    app.innerHTML = `
      <div class="screen criacao">
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
    app.querySelectorAll('[data-g]').forEach((b) => (b.onclick = () => { if (sel.genero !== b.dataset.g) sel.nome = nomePessoa(nameRng, content.names, b.dataset.g); sel.genero = b.dataset.g; render(); }));
    app.querySelector('[data-act="reroll"]').onclick = () => { sel.nome = nomePessoa(nameRng, content.names, sel.genero); render(); };
    app.querySelector('[data-act="back"]').onclick = titleScreen;
    app.querySelector('[data-act="start"]').onclick = () => startGame(newState(content, { ...sel, seed: `${sel.nome}-${Date.now()}` }));
  };
  render();
}

// ---------- Jogo ----------
function startGame(state) {
  game = new Game(content, state);
  history = [];
  tab = 'ficha'; folhaAberta = false; mapaView = null;
  montarJogo();
  renderGame(true);
  if (!P.tutorial) { salvarPrefs({ tutorial: true }); abrirTutorial(); }
}

function act(fn, newScene = true) {
  const prev = game.s.cena, antes = { blocos: prev?.blocos || [], modo: prev?.modo, local: game.s.local };
  const h0 = { hp: game.s.heroi.hp, ouro: game.s.heroi.ouro };
  fn();
  const cur = game.s.cena, mudou = prev !== cur;
  if (newScene && prev && mudou && !game.s.morto) history = [...history, prev].slice(-1);
  persist();
  const cues = cuesFrom(antes, { blocos: cur.blocos, modo: cur.modo, local: game.s.local });
  audio.play(newScene ? ['clique', ...cues] : cues);
  renderGame(newScene && mudou);
  efeitoVisual(cues);
  numerosFlutuantes(h0);
  if (mudou && narr.cfg.on && narr.cfg.auto) lerCena(antes.blocos);
}

/** Lampejo na tela para golpes recebidos, críticos e nível. */
function efeitoVisual(cues) {
  const cls = cues.includes('ferido') || cues.includes('desastre') ? 'fx-dano'
    : cues.includes('golpe_critico') || cues.includes('critico') ? 'fx-crit' : cues.includes('nivel') ? 'fx-nivel' : null;
  const el = app.querySelector('.jogo');
  if (!cls || !el || !P.animar) return;
  el.classList.add(cls);
  setTimeout(() => el.classList.remove(cls), 650);
}

/** Números que saltam da barra de vida (dano/cura) e do topo (ouro). */
function numerosFlutuantes(h0) {
  if (!P.animar) return;
  const h = game.s.heroi, dv = h.hp - h0.hp, dou = h.ouro - h0.ouro;
  const barra = app.querySelector('#bar-vida');
  if (dv && barra) {
    flutuar(barra, `${dv > 0 ? '+' : '−'}${Math.abs(dv)}`, dv > 0 ? 'cura' : 'dano');
    if (dv < 0) { barra.classList.remove('treme'); void barra.offsetWidth; barra.classList.add('treme'); }
  }
  if (dou) flutuar(app.querySelector('.hud h1') || app, `${dou > 0 ? '+' : '−'}${Math.abs(dou)} ouro`, 'ouro', 40);
}
function flutuar(el, texto, cls, dx = 0) {
  const r = el.getBoundingClientRect();
  const f = document.createElement('div');
  f.className = `flutua ${cls}`; f.textContent = texto;
  f.style.left = `${Math.min(innerWidth - 90, r.left + r.width / 2 - 16 + dx)}px`; f.style.top = `${r.top + 10}px`;
  document.body.appendChild(f);
  setTimeout(() => f.remove(), 1200);
}

/** Lê a cena atual em voz alta (só os blocos novos, se `ignorar` for informado). */
function lerCena(ignorar = []) {
  if (!narr.disponivel || !game) return;
  if (narr.falando && !ignorar.length) return narr.parar();
  const vistos = new Set(ignorar), cena = game.s.cena;
  let txt = cena.blocos.filter((b) => b.tipo === 'texto' && !vistos.has(b)).map((b) => b.texto).join(' ');
  if (narr.cfg.opcoes && cena.opcoes.length) {
    txt += ' Opções: ' + cena.opcoes.map((o, i) => (o.desativada ? '' : `${i + 1}: ${o.rotulo}.`)).filter(Boolean).join(' ');
  }
  narr.falar(txt);
}

function moodAtual() {
  const s = game.s, loc = content.location(s), bioma = content.biome(s), tags = loc.tags || [];
  const sub = tags.includes('subterraneo') || tags.includes('caverna') || tags.includes('masmorra');
  return { audio: sub ? 'caverna' : bioma.audio, bioma: bioma.id, perfil: sub ? null : bioma.som || null,
    periodo: s.periodo, clima: s.clima, modo: s.cena.modo, seguro: tags.includes('seguro'), sagrado: tags.includes('sagrado') };
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

// ---------- Moldura do jogo (montada uma vez; renderGame só atualiza as partes) ----------
const ehCelular = () => matchMedia('(max-width: 900px)').matches;
const areaCenario = () => (ehCelular() ? 0.42 : 0.56);

function montarJogo() {
  app.innerHTML = `
    <div class="jogo ${P.animar ? 'anim' : ''}">
      <header class="hud" id="hud"></header>
      <div class="palco">
        <main class="coluna" id="coluna"></main>
        <aside class="painel"><div class="caixa"><nav class="abas" id="abas"></nav><div class="conteudo" id="painel-c"></div></div></aside>
      </div>
      <nav class="navinf" id="navinf"></nav>
      <div class="fundo-folha" id="fundo-folha"></div>
      <section class="folha" aria-label="Painel">
        <div class="alca"></div>
        <div class="folha-h"><h3 id="folha-t"></h3><button class="ibtn" id="folha-x" aria-label="Fechar">${icone('fechar')}</button></div>
        <div class="conteudo" id="folha-c"></div>
      </section>
    </div>`;
  const fechar = () => { folhaAberta = false; app.querySelector('.jogo').classList.remove('aberta'); };
  app.querySelector('#folha-x').onclick = fechar;
  app.querySelector('#fundo-folha').onclick = fechar;
}

/** Cenário do lugar atual (semente = id do local: cada lugar tem um visual fixo). */
function cenarioDoLugar() {
  const m = moodAtual();
  const bioma = content.biome(game.s), sub = m.audio === 'caverna';
  cenario.set({ bioma: sub ? 'caverna' : (bioma.visual?.base || bioma.audio), perfil: sub ? null : bioma.visual || null,
    periodo: m.periodo, clima: m.clima, modo: game.s.cena.modo, seed: game.s.local, area: areaCenario() });
}

const ABAS_DEF = [['ficha', 'Ficha', 'ficha'], ['mochila', 'Mochila', 'mochila'], ['mapa', 'Mapa', 'mapa'], ['jornada', 'Jornada', 'jornada'], ['diario', 'Diário', 'diario']];

function renderGame(fresh = false) {
  if (!app.querySelector('.jogo')) montarJogo();
  eraCelular = ehCelular();
  const s = game.s;
  audio.set(moodAtual());
  cenarioDoLugar();
  app.querySelector('.jogo').classList.toggle('anim', !!P.animar);
  app.querySelector('#hud').innerHTML = hudHtml();
  const coluna = app.querySelector('#coluna');
  coluna.innerHTML = history.map((c) => cenaHtml(c, true)).join('') + cenaHtml(s.cena, false, fresh);
  // Abas: painel lateral (computador) ou barra inferior + folha (celular).
  const bolhas = { mochila: s.heroi.inventario.length, jornada: s.missoes.length + s.fios.length };
  const btn = ([id, nome, ic]) => `<button data-tab="${id}" class="${tab === id ? 'sel' : ''}">${icone(ic)}${nome}${bolhas[id] ? `<span class="bolha">${bolhas[id]}</span>` : ''}</button>`;
  app.querySelector('#abas').innerHTML = ABAS_DEF.map(btn).join('');
  app.querySelector('#navinf').innerHTML = ABAS_DEF.map(btn).join('');
  const corpo = { ficha: fichaHtml, mochila: mochilaHtml, mapa: mapaHtml, jornada: jornadaHtml, diario: diarioHtml };
  const celular = ehCelular();
  app.querySelector('#painel-c').innerHTML = celular ? '' : corpo[tab]();
  app.querySelector('#folha-c').innerHTML = celular && folhaAberta ? corpo[tab]() : '';
  app.querySelector('#folha-t').textContent = ABAS_DEF.find((a) => a[0] === tab)[1];
  app.querySelector('.jogo').classList.toggle('aberta', celular && folhaAberta);
  ligarJogo(fresh);
}

function ligarJogo(fresh) {
  bindAudio(); bindModais();
  app.querySelector('[data-act="menu"]').onclick = () => { narr.parar(); titleScreen(); };
  const ler = app.querySelector('[data-act="ler"]');
  if (ler) ler.onclick = () => lerCena();
  app.querySelectorAll('[data-opt]').forEach((b) => (b.onclick = () => act(() => game.choose(+b.dataset.opt))));
  app.querySelectorAll('#abas [data-tab]').forEach((b) => (b.onclick = () => { tab = b.dataset.tab; renderGame(); }));
  app.querySelectorAll('#navinf [data-tab]').forEach((b) => (b.onclick = () => {
    if (folhaAberta && tab === b.dataset.tab) folhaAberta = false; else { tab = b.dataset.tab; folhaAberta = true; }
    renderGame();
  }));
  app.querySelectorAll('[data-use]').forEach((b) => (b.onclick = () => act(() => game.usarItem(+b.dataset.use), false)));
  app.querySelectorAll('[data-equip]').forEach((b) => (b.onclick = () => act(() => game.equiparItem(+b.dataset.equip), false)));
  app.querySelectorAll('[data-drop]').forEach((b) => (b.onclick = () => act(() => game.descartarItem(+b.dataset.drop), false)));
  app.querySelectorAll('[data-abandon]').forEach((b) => (b.onclick = () => act(() => game.abandonarMissao(+b.dataset.abandon), false)));
  app.querySelectorAll('.map').forEach(ligarMapa);
  const nova = app.querySelector('[data-act="again"]');
  if (nova) nova.onclick = creationScreen;
  if (fresh) {
    const cur = app.querySelector('.cartao.atual');
    if (cur && history.length) cur.scrollIntoView({ block: 'start', behavior: P.animar ? 'smooth' : 'auto' });
  }
}

function hudHtml() {
  const s = game.s, h = s.heroi, loc = content.location(s), st = game.stats();
  const noite = s.periodo === 'noite' || s.periodo === 'madrugada';
  const CLIMA_IC = { limpo: noite ? 'lua' : 'sol', chuva: 'chuva', nevoa: 'nevoa', vento: 'vento', neve: 'neve' };
  const pct = (v, m) => Math.max(0, Math.min(100, (v / m) * 100));
  return `
    <div class="lugar"><h1>${esc(loc.nome)}</h1>
      <div class="meta"><span>${icone('dia')}<span class="so-desk">Dia </span>${s.dia}</span><span>${icone(noite ? 'lua' : 'sol')}${PERIODO_NOME[s.periodo]}</span>
        <span>${icone(CLIMA_IC[s.clima] || 'sol')}${CLIMA_NOME[s.clima] || s.clima}</span><span>${icone('ouro')}${h.ouro}</span></div></div>
    <div class="vitais">
      <span style="color:#e0675b" title="Vida">${icone('vida')}</span><div class="vital vida" id="bar-vida"><i style="width:${pct(h.hp, h.hpMax)}%"></i><b>${h.hp}/${h.hpMax}</b></div>
      <span style="color:#5aa0e0" title="Energia">${icone('energia')}</span><div class="vital energia"><i style="width:${pct(h.energia, h.energiaMax)}%"></i><b>${h.energia}/${h.energiaMax}</b></div>
      <span style="color:#9a6ad4" title="Exaustão${st.penalidade ? `: −${st.penalidade} nos testes` : ''}">${icone('exaustao')}</span>
      <div class="pips-ex">${Array.from({ length: MAX_EXAUSTAO }, (_, i) => `<i class="${i < h.exaustao ? 'on' : ''}"></i>`).join('')}</div>
    </div>
    <div class="acoes">
      ${narr.disponivel ? `<button class="ibtn ${narr.falando ? 'on' : ''}" data-act="ler" title="Ouvir a cena (L)" aria-label="Ouvir a cena">${icone('ouvir')}</button>` : ''}
      ${audioBtn()}
      <button class="ibtn" data-act="ajustes" title="Ajustes" aria-label="Ajustes">${icone('ajustes')}</button>
      <button class="ibtn" data-act="menu" title="Menu" aria-label="Menu">${icone('menu')}</button>
    </div>`;
}

const RES_ROTULO = { critico: 'Crítico!', desastre: 'Desastre!', sucesso: 'Sucesso', parcial: 'Parcial', falha: 'Falha' };
function rolagemHtml(b, anim) {
  if (b.d1 == null) return `<div class="rolagem"><span>${esc(b.texto)}</span></div>`; // saves antigos
  const mod = b.mod ? ` ${b.mod > 0 ? '+' : '−'}${Math.abs(b.mod)}` : '';
  return `<div class="rolagem">${dadoHtml(b.d1, anim)}${dadoHtml(b.d2, anim)}
    <span>${ATTR_NOME[b.atributo] || ''}${mod} = <b style="color:var(--text)">${b.total}</b></span>
    <span class="res ${b.classe}">${RES_ROTULO[b.classe] || ''}</span></div>`;
}

function cenaHtml(cena, antigo, fresh = false) {
  const d = (i) => `style="--i:${Math.min(i, 8)}"`;
  const anim = fresh && P.animar;
  // Agrupa notas consecutivas numa linha de marcas.
  let html = '', marcas = [];
  const fechar = () => { if (marcas.length) html += `<div class="marcas">${marcas.join('')}</div>`; marcas = []; };
  cena.blocos.forEach((b, i) => {
    if (b.tipo === 'nota') { marcas.push(`<span class="marca ${b.classe}" ${d(i)}>${esc(b.texto)}</span>`); return; }
    fechar();
    html += b.tipo === 'texto' ? `<p class="txt" ${d(i)}>${esc(b.texto)}</p>` : `<div ${d(i)}>${rolagemHtml(b, anim)}</div>`;
  });
  fechar();
  if (antigo) return `<article class="cartao antigo">${html}</article>`;
  let extra = '';
  if (cena.modo === 'combate' && game.s.combate) {
    const e = content.enemies[game.s.combate.id], c = game.s.combate;
    extra = `<div class="inimigo"><b>${esc(e.nome.charAt(0).toUpperCase() + e.nome.slice(1))}</b>
      <div class="vital vida"><i style="width:${Math.max(0, (c.hp / c.hpMax) * 100)}%"></i><b>${c.hp}/${c.hpMax}</b></div></div>`;
  }
  if (cena.modo === 'morte') {
    const h = game.s.heroi;
    extra = `<div class="death"><h2>Fim da jornada</h2>
      <p>${esc(h.nome)} chegou ao nível ${h.nivel} e resistiu ${game.s.dia} dia(s).</p>
      <button class="btn primary" data-act="again">Nova jornada</button></div>`;
  }
  const combate = cena.modo === 'combate';
  const ops = cena.opcoes.map((o, i) => `
    <button class="op ${combate ? 'combate' : ''} ${o.destaque ? 'destaque' : ''} ${o.atividade ? 'atividade' : ''}" data-opt="${i}" ${o.desativada ? 'disabled' : ''}>
      ${i < 9 ? `<kbd>${i + 1}</kbd>` : ''}
      <span class="rot">${esc(o.rotulo)}${o.item ? ` <small class="dica">${esc(describeMods(o.item))}</small>${compHtml(o.item)}` : ''}</span>
      ${o.dica ? `<span class="dica">${icone(dicaIcone(o))}${esc(o.dica)}</span>` : ''}
    </button>`).join('');
  return `<article class="cartao atual ${fresh ? 'fresh' : ''} ${combate ? 'em-combate' : ''}">${html}${extra}
    <div class="opcoes" style="--i:${Math.min(cena.blocos.length, 9)}">${ops}</div></article>`;
}

/** Ícone da dica da opção: teste (dado), tempo, preço, combate. */
function dicaIcone(o) {
  const d = o.dica || '';
  if (/teste|força|agilidade|mente|presença/i.test(d)) return o.acao?.tipo === 'combate' ? 'espada' : 'dado';
  if (/período|dia|curto|amanhecer/i.test(d)) return 'tempo';
  if (/ouro/i.test(d)) return 'ouro';
  if (/cura|vida/i.test(d)) return 'vida';
  return 'dado';
}

function fichaHtml() {
  const h = game.s.heroi, st = game.stats();
  const cls = content.classes.find((c) => c.id === h.classe);
  const sinal = (n) => (n > 0 ? '+' : '') + n;
  return `
    <div class="retrato"><div class="selo">${esc(h.nome.charAt(0))}</div><div>
      <p class="hero-name">${esc(h.nome)}</p>
      <div class="hero-sub">${esc(cls?.nome[h.genero] || '')} · nível ${h.nivel} · ${h.xp}/${xpParaNivel(h.nivel)} XP</div></div></div>
    <div class="atributos">${ATRIBUTOS.map((a) => `<div><b>${sinal(st.attrs[a])}</b><small>${ATTR_NOME[a]}</small></div>`).join('')}</div>
    <div class="kv">
      <span>Vida</span><span>${h.hp} / ${h.hpMax}</span>
      <span>Energia</span><span>${h.energia} / ${h.energiaMax}</span>
      <span>Exaustão</span><span>${h.exaustao}/${MAX_EXAUSTAO}${st.penalidade ? ` (−${st.penalidade} nos testes)` : ''}</span>
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
    ${eq ? '' : compHtml(it)}
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
  const fios = s.fios.map((x) => `<div class="entry">${esc(game.label(content.threads[x.id]?.texto || ''))}<small>desde o dia ${x.desde}</small></div>`).join('')
    || '<p class="empty">Nenhuma ponta solta. Por enquanto.</p>';
  const pessoas = Object.values(s.npcs).sort((a, b) => (b.visto || 0) - (a.visto || 0)).slice(0, 12).map((n) => {
    const v = npcVar(game, n), l = game.loc(n.local);
    return `<div class="entry"><b>${esc(n.nome)}</b>, ${esc(v.oficio)} ${esc(v.temperamento)}
      <span class="disp d${Math.sign(n.disposicao)}">${rotuloDisposicao(n.disposicao)}</span><small>${esc(l?.nome || '')} · ${n.encontros} encontro(s)</small></div>`;
  }).join('') || '<p class="empty">Ninguém conhece você ainda.</p>';
  // Só os estabelecimentos que o herói já frequentou (o resto ele descobre andando).
  const lugares = Object.entries(s.estabsVistos || {}).filter(([, l]) => l.length).map(([id, l]) =>
    `<div class="entry"><b>${esc(game.loc(id)?.nome || id)}</b><small>${l.map((e) => esc((s.estabs[id] || []).find((x) => x.id === e)?.nome || e)).join(' · ')}</small></div>`).join('')
    || '<p class="empty">Nenhum povoado conhecido de perto.</p>';
  return `<div class="sec" style="margin-top:0">Missões (${s.missoes.length}/3)</div>${missoes}
    <div class="sec">Fios soltos</div>${fios}<div class="sec">Pessoas</div>${pessoas}<div class="sec">Lugares</div>${lugares}`;
}

const COR_BIOMA = { vila: '#d4a24c', estrada: '#a2978a', floresta: '#6fb37a', pantano: '#7f8f4e', montanha: '#9aa6b2',
  ruinas: '#9a6ad4', costa: '#5aa0e0' };

/** Enquadramento automático da área conhecida. */
function mapaAuto(nodes, atual) {
  const xs = nodes.map((l) => l.x), ys = nodes.map((l) => l.y);
  const extensao = Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys)) + 24;
  // Mundo pequeno: mostra tudo. Mundo grande (regiões desbravadas): centra em você; afaste para ver o resto.
  if (extensao <= 110 || !atual) return { cx: (Math.max(...xs) + Math.min(...xs)) / 2, cy: (Math.max(...ys) + Math.min(...ys)) / 2, size: Math.max(36, extensao), max: Math.max(140, extensao) };
  return { cx: atual.x, cy: atual.y, size: 110, max: extensao + 20 };
}
const vbDe = (v) => `${(v.cx - v.size / 2).toFixed(2)} ${(v.cy - v.size / 2).toFixed(2)} ${v.size.toFixed(2)} ${v.size.toFixed(2)}`;

/** Mapa com névoa: visitados com nome, vizinhos como "?", o resto oculto. Zoom, arrastar e clicar num vizinho para viajar. */
function mapaHtml() {
  const s = game.s, visit = new Set(s.visitados), conhecidos = new Set(visit);
  for (const id of visit) for (const cx of conexoes(game, id)) conhecidos.add(cx.para);
  const viaveis = new Map();
  if (s.cena.modo === 'local') s.cena.opcoes.forEach((o, i) => { if (o.acao.tipo === 'viajar') viaveis.set(o.acao.para, i); });
  const alvos = new Set(s.missoes.map((m) => (m.estado === 'cumprida' ? m.origem : m.destino)));
  const nodes = [...conhecidos].map((id) => game.loc(id)).filter((l) => l && l.x != null);
  const auto = mapaAuto(nodes, game.loc(s.local));
  const view = mapaView || auto;
  const k = Math.min(auto.size, 110) / 100; // tamanhos de traço/texto seguem o enquadramento automático
  const edges = [], vistos = new Set();
  for (const l of nodes) {
    for (const cx of conexoes(game, l.id)) {
      const d = game.loc(cx.para), key = [l.id, cx.para].sort().join('|');
      if (!d || !conhecidos.has(d.id) || vistos.has(key) || (!visit.has(l.id) && !visit.has(d.id))) continue;
      vistos.add(key);
      edges.push(`<line x1="${l.x}" y1="${l.y}" x2="${d.x}" y2="${d.y}" stroke-width="${(.5 * k).toFixed(2)}" class="${visit.has(l.id) && visit.has(d.id) ? 'e-vis' : 'e-fog'}"/>`);
    }
  }
  const circles = nodes.map((l) => {
    const v = visit.has(l.id), atual = l.id === s.local, r = (l.gerado ? 2 : 2.8) * k;
    const cor = content.biomes[l.bioma]?.cor || COR_BIOMA[l.bioma] || '#a2978a';
    const clic = viaveis.has(l.id) ? `data-maptravel="${viaveis.get(l.id)}" class="n-go"` : '';
    const rel = (l.x - (auto.cx - auto.size / 2)) / auto.size;
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
    <div class="mapa-caixa">
      <svg class="map" viewBox="${vbDe(view)}" data-auto='${JSON.stringify(auto)}' role="img" aria-label="Mapa do mundo">${edges.join('')}${circles}</svg>
      <div class="mapa-ctl">
        <button class="ibtn" data-zoom="in" title="Aproximar" aria-label="Aproximar">+</button>
        <button class="ibtn" data-zoom="out" title="Afastar" aria-label="Afastar">−</button>
        <button class="ibtn" data-zoom="fit" title="Centralizar" aria-label="Centralizar">${icone('alvo')}</button>
      </div>
    </div>
    <p class="maplegend"><span class="lg-cur"></span>você <span class="lg-q"></span>missão <span class="lg-fog"></span>inexplorado</p>
    <p class="empty">${viaveis.size ? 'Toque num local vizinho para viajar. ' : ''}Arraste para mover; roda do mouse ou pinça para zoom.</p>`;
}

/** Zoom (roda/pinça/botões), arrastar e clique para viajar, sem redesenhar o painel. */
function ligarMapa(svg) {
  const auto = JSON.parse(svg.dataset.auto);
  let v = { ...(mapaView || auto) };
  const aplicar = () => { v.size = Math.max(14, Math.min(auto.max || 140, v.size)); mapaView = { ...v }; svg.setAttribute('viewBox', vbDe(v)); };
  const ponto = (cx, cy) => { // tela → coordenadas do mapa
    const r = svg.getBoundingClientRect();
    return { x: v.cx - v.size / 2 + ((cx - r.left) / r.width) * v.size, y: v.cy - v.size / 2 + ((cy - r.top) / r.height) * v.size };
  };
  const zoom = (f, cx, cy) => {
    const p = cx == null ? { x: v.cx, y: v.cy } : ponto(cx, cy);
    v.cx = p.x + (v.cx - p.x) * f; v.cy = p.y + (v.cy - p.y) * f; v.size *= f; aplicar();
  };
  svg.addEventListener('wheel', (e) => { e.preventDefault(); zoom(e.deltaY > 0 ? 1.15 : 1 / 1.15, e.clientX, e.clientY); }, { passive: false });
  const ptrs = new Map();
  let arrastou = false, pinca = 0;
  svg.addEventListener('pointerdown', (e) => { ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY }); arrastou = false; pinca = 0; });
  svg.addEventListener('pointermove', (e) => {
    const ant = ptrs.get(e.pointerId);
    if (!ant) return;
    const r = svg.getBoundingClientRect();
    if (ptrs.size === 1) {
      const dx = e.clientX - ant.x, dy = e.clientY - ant.y;
      if (!arrastou && Math.hypot(dx, dy) < 4) return;
      if (!arrastou) svg.setPointerCapture(e.pointerId);
      arrastou = true;
      v.cx -= (dx / r.width) * v.size; v.cy -= (dy / r.height) * v.size; aplicar();
    }
    ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (ptrs.size === 2) {
      const [a, b] = [...ptrs.values()], dist = Math.hypot(a.x - b.x, a.y - b.y);
      if (pinca) zoom(pinca / dist, (a.x + b.x) / 2, (a.y + b.y) / 2);
      pinca = dist; arrastou = true;
    }
  });
  const soltar = (e) => { ptrs.delete(e.pointerId); if (ptrs.size < 2) pinca = 0; };
  svg.addEventListener('pointerup', soltar); svg.addEventListener('pointercancel', soltar);
  svg.querySelectorAll('[data-maptravel]').forEach((g) => (g.onclick = () => {
    if (arrastou) return;
    act(() => game.choose(+g.dataset.maptravel));
  }));
  const caixa = svg.closest('.mapa-caixa');
  caixa.querySelector('[data-zoom="in"]').onclick = () => zoom(1 / 1.3);
  caixa.querySelector('[data-zoom="out"]').onclick = () => zoom(1.3);
  caixa.querySelector('[data-zoom="fit"]').onclick = () => { v = { ...auto }; mapaView = null; svg.setAttribute('viewBox', vbDe(v)); };
}

function diarioHtml() {
  return [...game.s.diario].reverse().map((e) =>
    `<div class="entry">${esc(e.texto)}<small>Dia ${e.dia} · ${PERIODO_NOME[e.periodo]}</small></div>`).join('') || '<p class="empty">Páginas em branco.</p>';
}

// ---------- Comparação de equipamento ----------
const CMP_NOME = { ...ATTR_NOME, defesa: 'Defesa', hpMax: 'Vida máx.', energiaMax: 'Energia máx.', dano: 'Dano médio' };
function compHtml(it) {
  const r = compararEquip(game.s.heroi, content, it);
  if (!r) return '';
  const vs = r.atual ? `vs. ${esc(r.atual.nome)}` : 'vs. nada equipado';
  const sinal = (n) => (n >= 0 ? '+' : '') + n;
  const atk = r.ataque ? `<b class="${r.ataque.depois.valor >= r.ataque.antes.valor ? 'up' : 'down'}">ataca com ${ATTR_NOME[r.ataque.depois.atributo]} ${sinal(r.ataque.depois.valor)}
    (era ${ATTR_NOME[r.ataque.antes.atributo]} ${sinal(r.ataque.antes.valor)})</b>` : '';
  if (!r.deltas.length && !atk) return `<span class="cmp">${vs}: sem diferença</span>`;
  return `<span class="cmp">${vs}: ${atk}${r.deltas.map((d) =>
    `<b class="${d.delta > 0 ? 'up' : 'down'}">${sinal(d.delta)} ${CMP_NOME[d.chave] || d.chave}</b>`).join(' ')}</span>`;
}

// ---------- Teclado ----------
const ABAS = { f: 'ficha', i: 'mochila', m: 'mapa', j: 'jornada', d: 'diario' };
function teclado(e) {
  if (e.ctrlKey || e.metaKey || e.altKey || /INPUT|SELECT|TEXTAREA/.test(e.target.tagName)) return;
  if (modal) { if (e.key === 'Escape') fecharModal(); return; }
  if (!game || !app.querySelector('.jogo')) return;
  const k = e.key.toLowerCase();
  if (/^[1-9]$/.test(k)) {
    const b = app.querySelector(`.cartao.atual [data-opt="${+k - 1}"]`);
    if (b && !b.disabled) { e.preventDefault(); b.click(); }
  } else if (k === 'l') lerCena();
  else if (ABAS[k]) { if (ehCelular()) folhaAberta = !(folhaAberta && tab === ABAS[k]); tab = ABAS[k]; renderGame(); }
  else if (e.key === 'Escape' && folhaAberta) { folhaAberta = false; renderGame(); }
}

// ---------- Janelas: ajustes e tutorial ----------
function bindModais() {
  document.querySelectorAll('[data-act="ajustes"]').forEach((b) => (b.onclick = abrirAjustes));
  document.querySelectorAll('[data-act="tutorial"]').forEach((b) => (b.onclick = abrirTutorial));
}
function abrirModal(nome, titulo, corpo) {
  fecharModal(false);
  modal = nome;
  const el = document.createElement('div');
  el.className = 'modal-bg';
  el.innerHTML = `<div class="modal" role="dialog" aria-modal="true" aria-label="${esc(titulo)}">
    <div class="modal-h"><h2>${esc(titulo)}</h2><button class="icon-btn" data-close>fechar (Esc)</button></div>${corpo}</div>`;
  el.onclick = (e) => { if (e.target === el || e.target.closest('[data-close]')) fecharModal(); };
  document.body.appendChild(el);
  el.querySelector('[data-close]').focus();
  return el;
}
function fecharModal(limpar = true) {
  document.querySelector('.modal-bg')?.remove();
  if (limpar) modal = null;
}

function abrirTutorial() {
  abrirModal('tutorial', 'Como jogar', `
    <ul class="tut">
      <li><b>Você só escolhe.</b> Muitas opções pedem um teste: <b>2d6 + atributo</b>. 10+ é sucesso,
        7–9 é sucesso com custo, 6 ou menos é falha. Dois 6 são <b>crítico</b>; dois 1, <b>desastre</b>.</li>
      <li><b>A vida é o que mais importa.</b> Cura é rara: descanse, acampe com rações ou pague a estalagem.
        A morte é permanente.</li>
      <li><b>Energia</b> se gasta explorando e viajando. <b>Exaustão</b> acumulada pesa em todos os testes.</li>
      <li>Pontas soltas voltam mais tarde. Em locais seguros, <b>procure trabalho</b>. O <b>mapa</b> mostra o que você já conhece.</li>
      <li><b>Atalhos:</b> <kbd>1</kbd>–<kbd>9</kbd> escolhem opções · <kbd>L</kbd> lê a cena em voz alta ·
        <kbd>F</kbd> <kbd>I</kbd> <kbd>M</kbd> <kbd>J</kbd> <kbd>D</kbd> trocam as abas · <kbd>Esc</kbd> fecha janelas.</li>
    </ul>
    <div class="row" style="justify-content:flex-end;margin:0"><button class="btn primary" data-close>Entendi</button></div>`);
}

function abrirAjustes() {
  const v = P.vol, z = narr.cfg;
  const faixa = (id, rot, val, min = 0, max = 100) =>
    `<label class="rng"><span>${rot}</span><input type="range" min="${min}" max="${max}" value="${val}" data-k="${id}"><output>${val}</output></label>`;
  const check = (id, rot, val) => `<label class="chk"><input type="checkbox" data-k="${id}" ${val ? 'checked' : ''}> ${rot}</label>`;
  const vozes = narr.listar();
  const vozSel = narr.voz()?.name;
  const narracao = !narr.disponivel ? '<p class="empty">Este navegador não oferece narração.</p>' : `
    ${check('voz.on', 'Narração ligada', z.on)}
    ${check('voz.auto', 'Ler cada cena nova automaticamente', z.auto)}
    ${check('voz.opcoes', 'Ler também as opções', z.opcoes)}
    <label class="rng"><span>Motor</span><select data-k="voz.motor">
      <option value="neural" ${z.motor === 'neural' ? 'selected' : ''}>Narrador neural SoloLevel (Piper)</option>
      <option value="navegador" ${z.motor !== 'neural' ? 'selected' : ''}>Voz do navegador</option></select></label>
    ${z.motor === 'neural' ? `
      <label class="rng"><span>Narrador</span><select data-k="voz.neural">${VOZES_NEURAIS.map((x) =>
        `<option value="${x.id}" ${x.id === z.neural ? 'selected' : ''}>${esc(x.nome)}${narr.neuralBaixadas.includes(x.id) ? ' ✓' : ''}</option>`).join('')}</select></label>
      ${narr.neuralBaixadas.includes(z.neural)
        ? `<p class="empty">Voz baixada e guardada neste aparelho: funciona offline.</p><button class="btn ghost" data-acao="remover-neural">Remover voz baixada</button>`
        : `<p class="empty">Voz neural que roda no próprio navegador, grátis e igual em qualquer aparelho. Download único de ~${VOZES_NEURAIS.find((x) => x.id === z.neural)?.mb || 63} MB.</p>
           <button class="btn primary" data-acao="baixar-neural">Baixar narrador</button> <span class="empty" id="neural-prog"></span>`}`
    : `<label class="rng"><span>Voz</span><select data-k="voz.voz">${vozes.length ? vozes.map((x) =>
      `<option value="${esc(x.name)}" ${x.name === vozSel ? 'selected' : ''}>${narr.ehNeural(x) ? '★ ' : ''}${esc(x.name)} (${esc(x.lang)})</option>`).join('')
      : '<option value="">Nenhuma voz em português encontrada</option>'}</select></label>
      <p class="empty">★ = voz neural do navegador (Edge: Francisca, Antonio; Chrome: Google).</p>`}
    ${faixa('voz.taxa', 'Velocidade', Math.round(z.taxa * 100), 70, 140)}
    <button class="btn" data-acao="testar-voz">Testar voz</button>`;
  const el = abrirModal('ajustes', 'Ajustes', `
    <div class="sec" style="margin-top:0">Som</div>
    ${check('audio', 'Som ligado', audio.on)}
    ${faixa('vol.master', 'Volume geral', Math.round(v.master * 100))}
    ${faixa('vol.ambiente', 'Ambiente', Math.round(v.ambiente * 100))}
    ${faixa('vol.musica', 'Música', Math.round(v.musica * 100))}
    ${faixa('vol.efeitos', 'Efeitos', Math.round(v.efeitos * 100))}
    <button class="btn" data-acao="testar-som">Testar efeitos</button>
    <div class="sec">Narração</div>${narracao}
    <div class="sec">Texto</div>
    ${check('animar', 'Animar texto e efeitos na tela', P.animar)}
    <div class="row" style="justify-content:space-between;margin:16px 0 0">
      <button class="btn" data-acao="tutorial">Como jogar</button><button class="btn primary" data-close>Pronto</button></div>`);

  el.querySelectorAll('[data-k]').forEach((inp) => {
    const ev = inp.type === 'range' ? 'input' : 'change';
    inp.addEventListener(ev, () => {
      const [grupo, chave] = inp.dataset.k.split('.');
      const val = inp.type === 'checkbox' ? inp.checked : inp.type === 'range' ? +inp.value : inp.value;
      if (inp.type === 'range') inp.nextElementSibling.textContent = val;
      if (grupo === 'audio') { if (val !== audio.on) toggleAudio(); return; }
      if (grupo === 'animar') { salvarPrefs({ animar: val }); if (game && app.querySelector('.jogo')) renderGame(); return; }
      if (grupo === 'vol') { const vol = { ...P.vol, [chave]: val / 100 }; salvarPrefs({ vol }); audio.setVolumes(vol); return; }
      if (grupo === 'voz') {
        narr.cfg = { ...narr.cfg, [chave]: chave === 'taxa' ? val / 100 : val };
        if (chave === 'on' && !val) narr.parar();
        salvarPrefs({ voz: narr.cfg });
        if (chave === 'motor' || chave === 'neural') narr.atualizarNeural().then(() => { if (modal === 'ajustes') abrirAjustes(); });
      }
    });
  });
  el.querySelector('[data-acao="testar-som"]').onclick = () => {
    if (!audio.on) toggleAudio();
    audio.play(['dado', 'critico', 'golpe_critico', 'ouro']);
  };
  el.querySelector('[data-acao="tutorial"]').onclick = abrirTutorial;
  const tv = el.querySelector('[data-acao="testar-voz"]');
  if (tv) tv.onclick = () => narr.falar('A névoa se abre por um instante. Ao longe, um sino toca três vezes.');
  const bx = el.querySelector('[data-acao="baixar-neural"]');
  if (bx) bx.onclick = async () => {
    bx.disabled = true;
    const prog = el.querySelector('#neural-prog');
    try {
      await narr.neural.baixar(narr.cfg.neural, (f) => { if (prog) prog.textContent = `${Math.round(f * 100)}%`; });
      await narr.atualizarNeural();
    } catch (e) {
      if (prog) prog.textContent = 'Falha no download. Verifique a conexão e tente de novo.';
      bx.disabled = false; return;
    }
    if (modal === 'ajustes') abrirAjustes();
  };
  const rm = el.querySelector('[data-acao="remover-neural"]');
  if (rm) rm.onclick = async () => { narr.parar(); await narr.neural.remover(narr.cfg.neural); await narr.atualizarNeural(); abrirAjustes(); };
}
