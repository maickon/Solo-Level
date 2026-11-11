// Efeitos sonoros sintetizados (Web Audio). Cada som é uma pequena receita de osciladores e ruído.
const NOTA = (n) => 440 * 2 ** ((n - 69) / 12); // MIDI → Hz

export class Sfx {
  constructor(ctx, out) {
    this.c = ctx; this.out = out;
    const len = ctx.sampleRate, buf = ctx.createBuffer(1, len, ctx.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    this.ruido = buf;
  }

  env(t, vol, ataque, dur) {
    const g = this.c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + ataque);
    g.gain.exponentialRampToValueAtTime(0.0001, t + ataque + dur);
    g.connect(this.out);
    return g;
  }
  tom(t, { f, para = null, tipo = 'sine', vol = 0.2, ataque = 0.005, dur = 0.25, detune = 0 }) {
    const o = this.c.createOscillator();
    o.type = tipo; o.frequency.setValueAtTime(f, t); o.detune.value = detune;
    if (para) o.frequency.exponentialRampToValueAtTime(para, t + ataque + dur);
    o.connect(this.env(t, vol, ataque, dur));
    o.start(t); o.stop(t + ataque + dur + 0.05);
  }
  chiado(t, { filtro = 'lowpass', f = 1200, para = null, q = 1, vol = 0.2, ataque = 0.003, dur = 0.15 }) {
    const s = this.c.createBufferSource(); s.buffer = this.ruido;
    const bq = this.c.createBiquadFilter(); bq.type = filtro; bq.Q.value = q;
    bq.frequency.setValueAtTime(f, t);
    if (para) bq.frequency.exponentialRampToValueAtTime(para, t + ataque + dur);
    s.connect(bq).connect(this.env(t, vol, ataque, dur));
    s.start(t, Math.random() * 0.5); s.stop(t + ataque + dur + 0.05);
  }
  arpejo(t, notas, passo, opts) { notas.forEach((n, i) => this.tom(t + i * passo, { f: NOTA(n), ...opts })); }

  /** Toca uma lista de sons em sequência; devolve a duração aproximada. */
  seq(nomes) {
    let t = this.c.currentTime + 0.03;
    for (const n of nomes) { const d = this.play(n, t); t += d; }
    return t - this.c.currentTime;
  }

  /** Agenda o som `nome` em `t`; retorna o intervalo até o próximo som da sequência. */
  play(nome, t = this.c.currentTime) {
    const R = RECEITAS[nome];
    if (!R) return 0;
    R(this, t);
    return INTERVALO[nome] ?? 0.14;
  }
}

const INTERVALO = { dado: 0.32, viagem: 0.5, alerta: 0.35, critico: 0.45, desastre: 0.4, nivel: 0.7, morte: 1.2, vitoria: 0.45 };

const RECEITAS = {
  clique: (s, t) => s.tom(t, { f: 1800, para: 1200, tipo: 'triangle', vol: 0.04, dur: 0.03 }),
  dado: (s, t) => {
    for (let i = 0; i < 5; i++) {
      const dt = i * 0.045 + Math.random() * 0.02;
      s.chiado(t + dt, { filtro: 'bandpass', f: 2200 + Math.random() * 1800, q: 6, vol: 0.18 - i * 0.025, dur: 0.035 });
      s.tom(t + dt, { f: 700 + Math.random() * 500, tipo: 'square', vol: 0.025, dur: 0.02 });
    }
  },
  sucesso: (s, t) => s.arpejo(t, [76, 83], 0.08, { tipo: 'triangle', vol: 0.12, dur: 0.35 }),
  parcial: (s, t) => s.arpejo(t, [72, 71], 0.1, { tipo: 'triangle', vol: 0.1, dur: 0.3 }),
  falha: (s, t) => s.arpejo(t, [62, 57], 0.12, { tipo: 'sine', vol: 0.14, dur: 0.4 }),
  critico: (s, t) => {
    s.arpejo(t, [72, 76, 79, 84, 88], 0.055, { tipo: 'triangle', vol: 0.13, dur: 0.6 });
    s.chiado(t + 0.2, { filtro: 'highpass', f: 6000, vol: 0.06, ataque: 0.05, dur: 0.8 });
  },
  desastre: (s, t) => {
    s.tom(t, { f: NOTA(50), para: NOTA(38), tipo: 'sawtooth', vol: 0.08, dur: 0.7 });
    s.tom(t, { f: NOTA(56), para: NOTA(44), tipo: 'sawtooth', vol: 0.06, dur: 0.7 });
    s.chiado(t, { f: 300, vol: 0.15, dur: 0.4 });
  },
  golpe: (s, t) => {
    s.chiado(t, { f: 2600, para: 400, vol: 0.32, dur: 0.12 });
    s.tom(t, { f: 140, para: 45, vol: 0.35, dur: 0.16 });
  },
  golpe_critico: (s, t) => {
    s.chiado(t, { f: 4000, para: 300, vol: 0.4, dur: 0.2 });
    s.tom(t, { f: 160, para: 38, vol: 0.45, dur: 0.28 });
    s.tom(t + 0.01, { f: 1320, tipo: 'square', vol: 0.04, dur: 0.5, detune: 12 });
    s.tom(t + 0.01, { f: 1980, tipo: 'sine', vol: 0.05, dur: 0.7 });
  },
  ferido: (s, t) => {
    s.tom(t, { f: 95, para: 38, vol: 0.45, dur: 0.3 });
    s.chiado(t, { f: 700, para: 150, vol: 0.25, dur: 0.2 });
    s.tom(t + 0.22, { f: 70, para: 40, vol: 0.2, dur: 0.18 }); // eco de batimento
  },
  cura: (s, t) => {
    s.tom(t, { f: NOTA(69), para: NOTA(76), vol: 0.09, ataque: 0.08, dur: 0.6 });
    s.arpejo(t + 0.1, [81, 88], 0.12, { tipo: 'sine', vol: 0.05, ataque: 0.02, dur: 0.6 });
  },
  ouro: (s, t) => {
    [0, 0.07, 0.16].forEach((dt, i) => {
      s.tom(t + dt, { f: 2100 + i * 240, tipo: 'triangle', vol: 0.07, dur: 0.18 });
      s.tom(t + dt, { f: 3150 + i * 300, tipo: 'sine', vol: 0.035, dur: 0.12 });
    });
  },
  item: (s, t) => s.arpejo(t, [79, 83, 86], 0.06, { tipo: 'triangle', vol: 0.08, dur: 0.3 }),
  item_raro: (s, t) => { s.arpejo(t, [79, 83, 86, 91], 0.06, { tipo: 'triangle', vol: 0.09, dur: 0.4 }); },
  item_lendario: (s, t) => {
    s.arpejo(t, [72, 79, 84, 88, 91, 96], 0.07, { tipo: 'triangle', vol: 0.1, dur: 0.7 });
    s.chiado(t + 0.3, { filtro: 'highpass', f: 7000, vol: 0.05, ataque: 0.1, dur: 1 });
  },
  fio: (s, t) => {
    s.tom(t, { f: NOTA(62), vol: 0.07, ataque: 0.15, dur: 1.1 });
    s.tom(t + 0.25, { f: NOTA(63), vol: 0.05, ataque: 0.15, dur: 1.0 });
  },
  nivel: (s, t) => {
    s.arpejo(t, [67, 72, 76, 79], 0.1, { tipo: 'triangle', vol: 0.12, dur: 0.5 });
    [72, 76, 79, 84].forEach((n) => s.tom(t + 0.45, { f: NOTA(n), tipo: 'sine', vol: 0.06, ataque: 0.03, dur: 1.2 }));
  },
  vitoria: (s, t) => {
    s.arpejo(t, [69, 73, 76], 0.08, { tipo: 'triangle', vol: 0.1, dur: 0.4 });
    s.tom(t + 0.25, { f: NOTA(81), vol: 0.07, ataque: 0.02, dur: 0.8 });
  },
  alerta: (s, t) => {
    s.tom(t, { f: 70, para: 50, vol: 0.4, dur: 0.35 });
    s.tom(t, { f: NOTA(58), para: NOTA(57), tipo: 'sawtooth', vol: 0.05, ataque: 0.02, dur: 0.5 });
    s.chiado(t, { f: 900, para: 200, vol: 0.12, dur: 0.3 });
  },
  morte: (s, t) => {
    [0, 1.4].forEach((dt) => [1, 2.76, 5.4].forEach((m, i) => s.tom(t + dt, { f: 82 * m, vol: 0.12 / (i + 1), dur: 3 })));
    s.tom(t, { f: 65, para: 32, vol: 0.2, ataque: 0.5, dur: 3.5 });
  },
  viagem: (s, t) => {
    for (let i = 0; i < 4; i++) s.chiado(t + i * 0.12, { f: 500 + (i % 2) * 150, para: 150, vol: 0.13, dur: 0.07 });
  },
};

export const SONS = Object.keys(RECEITAS);
