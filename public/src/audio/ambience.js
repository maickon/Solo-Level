// Ambiente procedural em camadas (Web Audio, sem arquivos):
//  1. leito: ruído filtrado que "respira" (vento, água, eco), por perfil de lugar;
//  2. vozes: sons esparsos agendados ao acaso (pássaros, grilos, gotas, ondas, sinos, trovão…);
//  3. música: pad modal + notas soltas com eco; em combate, percussão e ostinato tensos.
// Math.random é aceitável aqui: o áudio não faz parte do estado determinístico do jogo.

const NOTA = (n) => 440 * 2 ** ((n - 69) / 12);
const rnd = (a, b) => a + Math.random() * (b - a);
const pick = (l) => l[Math.floor(Math.random() * l.length)];

// raiz (MIDI) + escala (graus em semitons) dão a "cor" musical de cada lugar.
const PERFIS = {
  vila:     { ruido: 'pink',  filtro: 900,  q: 0.7, lfo: 0.05, vol: 0.05, raiz: 50, escala: [0, 2, 4, 7, 9], eco: 0.3, vozes: { dia: ['passaro', 'passaro', 'sino'], noite: ['grilo', 'grilo', 'coruja'] } },
  estrada:  { ruido: 'pink',  filtro: 700,  q: 0.8, lfo: 0.08, vol: 0.06, raiz: 48, escala: [0, 2, 5, 7, 9], eco: 0.3, vozes: { dia: ['passaro', 'rajada'], noite: ['grilo', 'coruja'] } },
  floresta: { ruido: 'pink',  filtro: 1400, q: 0.5, lfo: 0.12, vol: 0.07, raiz: 45, escala: [0, 3, 5, 7, 10], eco: 0.4, vozes: { dia: ['passaro', 'passaro', 'passaro', 'galho'], noite: ['coruja', 'grilo', 'grilo', 'galho'] } },
  pantano:  { ruido: 'brown', filtro: 400,  q: 2.5, lfo: 0.06, vol: 0.09, raiz: 43, escala: [0, 1, 5, 7, 8], eco: 0.45, vozes: { dia: ['sapo', 'bolha', 'gota'], noite: ['sapo', 'sapo', 'bolha', 'grilo'] } },
  montanha: { ruido: 'white', filtro: 600,  q: 1.5, lfo: 0.2,  vol: 0.05, raiz: 41, escala: [0, 2, 3, 7, 10], eco: 0.5, vozes: { dia: ['rajada', 'rajada', 'pedra'], noite: ['rajada', 'rajada'] } },
  caverna:  { ruido: 'brown', filtro: 250,  q: 4,   lfo: 0.03, vol: 0.08, raiz: 38, escala: [0, 1, 5, 6, 10], eco: 0.65, vozes: { dia: ['gota', 'gota', 'gota', 'pedra'], noite: ['gota', 'gota', 'pedra'] } },
  ruinas:   { ruido: 'pink',  filtro: 500,  q: 3,   lfo: 0.04, vol: 0.06, raiz: 42, escala: [0, 1, 4, 7, 8], eco: 0.55, vozes: { dia: ['pedra', 'rajada', 'carrilhao'], noite: ['carrilhao', 'coruja', 'pedra'] } },
  mar:      { ruido: 'brown', filtro: 800,  q: 0.6, lfo: 0.09, vol: 0.1,  raiz: 45, escala: [0, 2, 4, 7, 9], eco: 0.35, vozes: { dia: ['onda', 'onda', 'gaivota'], noite: ['onda', 'onda', 'sino'] } },
};

function noiseBuffer(ctx, tipo) {
  const len = ctx.sampleRate * 4, buf = ctx.createBuffer(1, len, ctx.sampleRate), d = buf.getChannelData(0);
  let b0 = 0, b1 = 0, b2 = 0, last = 0;
  for (let i = 0; i < len; i++) {
    const w = Math.random() * 2 - 1;
    if (tipo === 'white') d[i] = w * 0.5;
    else if (tipo === 'brown') { last = (last + 0.02 * w) / 1.02; d[i] = last * 3.5; }
    else { b0 = 0.997 * b0 + w * 0.029; b1 = 0.985 * b1 + w * 0.032; b2 = 0.95 * b2 + w * 0.048; d[i] = (b0 + b1 + b2) * 0.6; }
  }
  return buf;
}

export class Ambience {
  constructor(ctx, busAmbiente, busMusica) {
    this.c = ctx; this.ambBus = busAmbiente; this.musBus = busMusica;
    this.bufs = { white: noiseBuffer(ctx, 'white'), pink: noiseBuffer(ctx, 'pink'), brown: noiseBuffer(ctx, 'brown') };
    this.key = ''; this.layer = null;
  }

  /** mood = { audio, periodo, clima, modo, seguro, sagrado } */
  set(mood, force = false) {
    const key = ['audio', 'periodo', 'clima', 'modo', 'seguro', 'sagrado'].map((k) => mood[k]).join('|');
    if (key === this.key && !force) return;
    this.key = key;
    const t = this.c.currentTime;
    if (this.layer) this.descartar(this.layer, t);
    this.layer = this.build(mood);
    this.layer.amb.gain.setTargetAtTime(1, t, 1.2);
    this.layer.mus.gain.setTargetAtTime(1, t, 1.5);
  }
  /** Para tudo (som desligado). */
  pausar() { if (this.layer) this.descartar(this.layer, this.c.currentTime); this.layer = null; this.key = ''; }

  descartar(L, t) {
    L.vivo = false;
    L.timers.forEach(clearTimeout);
    L.amb.gain.setTargetAtTime(0, t, 0.8); L.mus.gain.setTargetAtTime(0, t, 0.8);
    setTimeout(() => { L.nodes.forEach((n) => { try { n.stop(); } catch { /* já parado */ } }); L.amb.disconnect(); L.mus.disconnect(); }, 5000);
  }

  build(mood) {
    const c = this.c, p = PERFIS[mood.audio] || PERFIS.estrada;
    const noite = mood.periodo === 'noite' || mood.periodo === 'madrugada';
    const L = { vivo: true, nodes: [], timers: [], p, noite, mood };
    L.amb = c.createGain(); L.amb.gain.value = 0; L.amb.connect(this.ambBus);
    L.mus = c.createGain(); L.mus.gain.value = 0; L.mus.connect(this.musBus);
    if (mood.modo === 'morte') return L; // silêncio: só o sino da morte (SFX)

    // Eco compartilhado (dá espaço: caverna e ruínas ecoam mais).
    L.eco = c.createDelay(2); L.eco.delayTime.value = 0.28 + p.eco * 0.5;
    const fb = c.createGain(); fb.gain.value = p.eco * 0.6;
    const ecoF = c.createBiquadFilter(); ecoF.type = 'lowpass'; ecoF.frequency.value = 1800;
    L.eco.connect(ecoF).connect(fb).connect(L.eco);
    ecoF.connect(L.amb);
    L.ecoIn = c.createGain(); L.ecoIn.gain.value = 0.5; L.ecoIn.connect(L.eco);

    this.leito(L);
    if (mood.clima === 'chuva' || mood.clima === 'vento' || mood.clima === 'neve') this.clima(L);
    if (mood.seguro && (mood.modo === 'mercado' || mood.modo === 'trabalho')) this.multidao(L);
    if (mood.modo === 'combate') this.combate(L);
    else this.musica(L);
    this.agendarVoz(L, rnd(1.5, 4));
    return L;
  }

  // ---------- 1. Leito ----------
  leito(L) {
    const c = this.c, p = L.p;
    const src = c.createBufferSource(); src.buffer = this.bufs[p.ruido]; src.loop = true;
    const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = p.filtro * (L.noite ? 0.6 : 1); f.Q.value = p.q;
    const g = c.createGain(); g.gain.value = p.vol * (L.mood.modo === 'combate' ? 0.6 : 1);
    const lfo = c.createOscillator(); lfo.frequency.value = p.lfo;
    const lfoG = c.createGain(); lfoG.gain.value = p.filtro * 0.4;
    lfo.connect(lfoG).connect(f.frequency);
    src.connect(f).connect(g).connect(L.amb);
    src.start(); lfo.start(); L.nodes.push(src, lfo);
  }
  clima(L) {
    const c = this.c, chuva = L.mood.clima === 'chuva';
    const r = c.createBufferSource(); r.buffer = this.bufs.white; r.loop = true;
    const hf = c.createBiquadFilter(); hf.type = chuva ? 'highpass' : 'bandpass';
    hf.frequency.value = chuva ? 2500 : 500; hf.Q.value = chuva ? 0.5 : 3;
    const rg = c.createGain(); rg.gain.value = chuva ? 0.045 : 0.03;
    if (!chuva) { // vento: rajadas lentas
      const l = c.createOscillator(); l.frequency.value = 0.07; const lg = c.createGain(); lg.gain.value = 300;
      l.connect(lg).connect(hf.frequency); l.start(); L.nodes.push(l);
    }
    r.connect(hf).connect(rg).connect(L.amb); r.start(); L.nodes.push(r);
  }
  multidao(L) {
    const c = this.c;
    for (let i = 0; i < 3; i++) {
      const s = c.createBufferSource(); s.buffer = this.bufs.pink; s.loop = true;
      const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 350 + i * 260; bp.Q.value = 4;
      const g = c.createGain(); g.gain.value = 0.02;
      const l = c.createOscillator(); l.frequency.value = rnd(2, 5); const lg = c.createGain(); lg.gain.value = 0.015;
      l.connect(lg).connect(g.gain);
      s.connect(bp).connect(g).connect(L.amb); s.start(rnd(0, 0.3)); l.start(); L.nodes.push(s, l);
    }
  }

  // ---------- 2. Vozes esparsas ----------
  agendarVoz(L, seg) {
    const id = setTimeout(() => {
      if (!L.vivo) return;
      const lista = [...L.p.vozes[L.noite ? 'noite' : 'dia']];
      if (L.mood.clima === 'chuva' && Math.random() < 0.25) lista.push('trovao');
      if (L.mood.sagrado) lista.push('carrilhao');
      if (L.mood.modo !== 'combate') VOZES[pick(lista)]?.(this, L, this.c.currentTime + 0.05);
      this.agendarVoz(L, rnd(3, 9) * (L.mood.modo === 'combate' ? 2 : 1));
    }, seg * 1000);
    L.timers.push(id);
  }
  /** Envelope simples ligado ao ambiente (e opcionalmente ao eco). */
  env(L, t, vol, ataque, dur, eco = true) {
    const g = this.c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + ataque);
    g.gain.exponentialRampToValueAtTime(0.0001, t + ataque + dur);
    g.connect(L.amb); if (eco) g.connect(L.ecoIn);
    return g;
  }
  osc(L, t, { f, para, tipo = 'sine', vol, ataque = 0.01, dur, eco = true }) {
    const o = this.c.createOscillator(); o.type = tipo; o.frequency.setValueAtTime(f, t);
    if (para) o.frequency.exponentialRampToValueAtTime(para, t + ataque + dur);
    o.connect(this.env(L, t, vol, ataque, dur, eco)); o.start(t); o.stop(t + ataque + dur + 0.05);
    return o;
  }
  ruido(L, t, { buf = 'white', tipo = 'bandpass', f, para, q = 1, vol, ataque = 0.01, dur, eco = true }) {
    const s = this.c.createBufferSource(); s.buffer = this.bufs[buf];
    const bq = this.c.createBiquadFilter(); bq.type = tipo; bq.Q.value = q; bq.frequency.setValueAtTime(f, t);
    if (para) bq.frequency.exponentialRampToValueAtTime(para, t + ataque + dur);
    s.connect(bq).connect(this.env(L, t, vol, ataque, dur, eco)); s.start(t, rnd(0, 2)); s.stop(t + ataque + dur + 0.05);
  }

  // ---------- 3. Música ----------
  musica(L) {
    const c = this.c, p = L.p, raiz = p.raiz - (L.noite ? 12 : 0);
    // Pad: quinta + oitava, respirando devagar.
    [0, 7, 12].forEach((iv, i) => {
      const o = c.createOscillator(); o.type = i ? 'triangle' : 'sine'; o.frequency.value = NOTA(raiz + iv);
      o.detune.value = (i - 1) * 5;
      const g = c.createGain(); g.gain.value = 0.014 / (i + 1);
      const l = c.createOscillator(); l.frequency.value = rnd(0.03, 0.08); const lg = c.createGain(); lg.gain.value = 0.006 / (i + 1);
      l.connect(lg).connect(g.gain);
      o.connect(g).connect(L.mus); o.start(); l.start(); L.nodes.push(o, l);
    });
    // Notas soltas da escala do lugar, com eco.
    const tocar = () => {
      if (!L.vivo) return;
      const t = c.currentTime + 0.05, n = raiz + 24 + pick(p.escala) + (Math.random() < 0.3 ? 12 : 0);
      const o = c.createOscillator(); o.type = 'triangle'; o.frequency.value = NOTA(n);
      const g = c.createGain(); g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.03, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + 2.6);
      o.connect(g); g.connect(L.mus); g.connect(L.ecoIn);
      o.start(t); o.stop(t + 2.7);
      L.timers.push(setTimeout(tocar, rnd(2.5, 7) * 1000 * (Math.random() < 0.2 ? 2.5 : 1)));
    };
    L.timers.push(setTimeout(tocar, rnd(2, 5) * 1000));
  }

  /** Combate: tambor grave + ostinato tenso, agendados com antecedência (relógio do áudio). */
  combate(L) {
    const c = this.c, p = L.p, bpm = 104, passo = 60 / bpm / 2; // colcheias
    const raiz = p.raiz - 12;
    // Drone tenso (raiz + trítono discreto).
    [[0, 0.03, 'sawtooth'], [6, 0.008, 'triangle']].forEach(([iv, v, tipo]) => {
      const o = c.createOscillator(); o.type = tipo; o.frequency.value = NOTA(raiz + iv);
      const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 320;
      const g = c.createGain(); g.gain.value = v;
      o.connect(lp).connect(g).connect(L.mus); o.start(); L.nodes.push(o);
    });
    const BUMBO = [1, 0, 0, 0, 1, 0, 0, 1, 1, 0, 0, 0, 1, 0, 1, 0];
    const OST = [0, 0, 3, 0, 1, 0, 3, 6];
    let i = 0, prox = c.currentTime + 0.1;
    const tick = () => {
      if (!L.vivo) return;
      while (prox < c.currentTime + 0.3) {
        const t = prox, k = i % 16;
        if (BUMBO[k]) {
          const o = c.createOscillator(); o.frequency.setValueAtTime(120, t); o.frequency.exponentialRampToValueAtTime(40, t + 0.18);
          const g = c.createGain(); g.gain.setValueAtTime(0.32, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.25);
          o.connect(g).connect(L.mus); o.start(t); o.stop(t + 0.3);
        }
        if (k % 4 === 2) { // aro seco
          const s = c.createBufferSource(); s.buffer = this.bufs.white;
          const hp = c.createBiquadFilter(); hp.type = 'bandpass'; hp.frequency.value = 1800; hp.Q.value = 1.5;
          const g = c.createGain(); g.gain.setValueAtTime(0.05, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.06);
          s.connect(hp).connect(g).connect(L.mus); s.start(t, rnd(0, 2)); s.stop(t + 0.08);
        }
        if (i % 2 === 0) { // ostinato em semínimas
          const o = c.createOscillator(); o.type = 'square'; o.frequency.value = NOTA(raiz + 12 + OST[(i / 2) % 8]);
          const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 700;
          const g = c.createGain(); g.gain.setValueAtTime(0.022, t); g.gain.exponentialRampToValueAtTime(0.0001, t + passo * 1.8);
          o.connect(lp).connect(g).connect(L.mus); o.start(t); o.stop(t + passo * 2);
        }
        prox += passo; i++;
      }
      L.timers.push(setTimeout(tick, 100));
    };
    tick();
  }
}

// Receitas das vozes esparsas: (ambience, layer, tempo).
const VOZES = {
  passaro: (a, L, t) => {
    const base = rnd(2400, 3600), n = Math.floor(rnd(2, 6));
    for (let i = 0; i < n; i++) a.osc(L, t + i * rnd(0.09, 0.16), { f: base, para: base * rnd(1.2, 1.6), vol: 0.018, ataque: 0.01, dur: 0.07 });
  },
  gaivota: (a, L, t) => {
    for (let i = 0; i < 3; i++) a.osc(L, t + i * 0.28, { f: 1400, para: 900, tipo: 'triangle', vol: 0.012, ataque: 0.04, dur: 0.22 });
  },
  grilo: (a, L, t) => {
    const f = rnd(4200, 5200);
    for (let k = 0; k < 3; k++) for (let i = 0; i < 4; i++) a.osc(L, t + k * 0.45 + i * 0.035, { f, vol: 0.008, ataque: 0.004, dur: 0.02, eco: false });
  },
  coruja: (a, L, t) => {
    a.osc(L, t, { f: 420, para: 380, vol: 0.03, ataque: 0.05, dur: 0.3 });
    a.osc(L, t + 0.55, { f: 400, para: 340, vol: 0.025, ataque: 0.05, dur: 0.45 });
  },
  galho: (a, L, t) => a.ruido(L, t, { f: 2500, q: 2, vol: 0.05, ataque: 0.002, dur: 0.05 }),
  sapo: (a, L, t) => {
    const f = rnd(140, 220);
    for (let i = 0; i < Math.floor(rnd(2, 5)); i++) a.osc(L, t + i * 0.18, { f, para: f * 0.8, tipo: 'square', vol: 0.012, ataque: 0.01, dur: 0.1 });
  },
  bolha: (a, L, t) => a.osc(L, t, { f: rnd(300, 500), para: rnd(700, 1100), vol: 0.03, ataque: 0.005, dur: 0.06 }),
  gota: (a, L, t) => a.osc(L, t, { f: rnd(1400, 2200), para: rnd(500, 800), vol: 0.035, ataque: 0.002, dur: 0.08 }),
  pedra: (a, L, t) => {
    a.ruido(L, t, { buf: 'brown', tipo: 'lowpass', f: 600, para: 120, vol: 0.12, ataque: 0.005, dur: 0.25 });
    a.osc(L, t, { f: 90, para: 50, vol: 0.05, ataque: 0.005, dur: 0.2 });
  },
  rajada: (a, L, t) => a.ruido(L, t, { tipo: 'bandpass', f: 300, para: 900, q: 2.5, vol: 0.05, ataque: 1.2, dur: 2.2, eco: false }),
  onda: (a, L, t) => a.ruido(L, t, { buf: 'brown', tipo: 'lowpass', f: 300, para: 1400, q: 0.7, vol: 0.12, ataque: 1.6, dur: 2.6, eco: false }),
  trovao: (a, L, t) => a.ruido(L, t, { buf: 'brown', tipo: 'lowpass', f: 220, para: 60, q: 0.5, vol: 0.4, ataque: 0.08, dur: 3.5, eco: false }),
  sino: (a, L, t) => [1, 2.76, 5.4].forEach((m, i) => a.osc(L, t, { f: 196 * m, vol: 0.022 / (i + 1), ataque: 0.005, dur: 3.5 })),
  carrilhao: (a, L, t) => {
    const raiz = L.p.raiz + 36;
    for (let i = 0; i < 3; i++) a.osc(L, t + i * rnd(0.3, 0.6), { f: NOTA(raiz + pick(L.p.escala)), vol: 0.015, ataque: 0.003, dur: 2.2 });
  },
};
