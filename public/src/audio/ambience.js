// Áudio procedural (Web Audio API) — sem arquivos. Ruído filtrado por bioma + drone + pulso de combate.
const PERFIS = {
  vila:     { ruido: 'pink',  filtro: 900,  q: 0.7, lfo: 0.05, vol: 0.05, notas: [146.8, 220, 293.7] },
  estrada:  { ruido: 'pink',  filtro: 700,  q: 0.8, lfo: 0.08, vol: 0.06, notas: [130.8, 196, 261.6] },
  floresta: { ruido: 'pink',  filtro: 1400, q: 0.5, lfo: 0.12, vol: 0.07, notas: [110, 164.8, 220] },
  pantano:  { ruido: 'brown', filtro: 400,  q: 2.5, lfo: 0.06, vol: 0.09, notas: [98, 146.8, 185] },
  montanha: { ruido: 'white', filtro: 600,  q: 1.5, lfo: 0.2,  vol: 0.05, notas: [87.3, 130.8, 174.6] },
  caverna:  { ruido: 'brown', filtro: 250,  q: 4,   lfo: 0.03, vol: 0.08, notas: [73.4, 110, 146.8] },
  ruinas:   { ruido: 'pink',  filtro: 500,  q: 3,   lfo: 0.04, vol: 0.06, notas: [92.5, 138.6, 185] },
  mar:      { ruido: 'brown', filtro: 800,  q: 0.6, lfo: 0.09, vol: 0.12, notas: [110, 146.8, 196] },
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
  constructor() { this.ctx = null; this.on = false; this.key = ''; }

  start() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0;
      this.master.connect(this.ctx.destination);
      this.bufs = { white: noiseBuffer(this.ctx, 'white'), pink: noiseBuffer(this.ctx, 'pink'), brown: noiseBuffer(this.ctx, 'brown') };
    }
    this.ctx.resume();
    this.on = true;
    this.master.gain.setTargetAtTime(0.9, this.ctx.currentTime, 1.5);
    if (this.pending) this.set(this.pending, true);
    return true;
  }
  stop() {
    this.on = false;
    if (this.ctx) this.master.gain.setTargetAtTime(0, this.ctx.currentTime, 0.4);
  }

  /** mood = { audio, periodo, clima, modo } */
  set(mood, force = false) {
    this.pending = mood;
    if (!this.on || !this.ctx) return;
    const key = `${mood.audio}|${mood.periodo}|${mood.clima}|${mood.modo}`;
    if (key === this.key && !force) return;
    this.key = key;
    const t = this.ctx.currentTime;
    if (this.layer) { const old = this.layer; old.out.gain.setTargetAtTime(0, t, 1.2); setTimeout(() => old.nodes.forEach((n) => n.stop?.()), 5000); }
    this.layer = this.build(mood);
    this.layer.out.gain.setTargetAtTime(1, t, 1.5);
  }

  build({ audio, periodo, clima, modo }) {
    const c = this.ctx, p = PERFIS[audio] || PERFIS.estrada, nodes = [];
    const out = c.createGain(); out.gain.value = 0; out.connect(this.master);
    const noturno = periodo === 'noite' || periodo === 'madrugada';

    // Camada de ambiente: ruído filtrado com respiração (LFO no filtro).
    const src = c.createBufferSource(); src.buffer = this.bufs[p.ruido]; src.loop = true;
    const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = p.filtro * (noturno ? 0.6 : 1); f.Q.value = p.q;
    const g = c.createGain(); g.gain.value = p.vol;
    const lfo = c.createOscillator(); lfo.frequency.value = p.lfo;
    const lfoG = c.createGain(); lfoG.gain.value = p.filtro * 0.4;
    lfo.connect(lfoG).connect(f.frequency);
    src.connect(f).connect(g).connect(out);
    src.start(); lfo.start(); nodes.push(src, lfo);

    // Chuva / vento extra.
    if (clima === 'chuva' || clima === 'vento' || clima === 'neve') {
      const r = c.createBufferSource(); r.buffer = this.bufs.white; r.loop = true;
      const hf = c.createBiquadFilter(); hf.type = clima === 'chuva' ? 'highpass' : 'bandpass';
      hf.frequency.value = clima === 'chuva' ? 2500 : 500; hf.Q.value = clima === 'chuva' ? 0.5 : 3;
      const rg = c.createGain(); rg.gain.value = clima === 'chuva' ? 0.04 : 0.03;
      r.connect(hf).connect(rg).connect(out); r.start(); nodes.push(r);
    }

    // Drone harmônico; em combate, desafina e pulsa.
    const tensa = modo === 'combate';
    p.notas.forEach((freq, i) => {
      const o = c.createOscillator(); o.type = i === 0 ? 'sine' : 'triangle';
      o.frequency.value = freq * (noturno ? 0.5 : 1) * (tensa && i === 2 ? 1.059 : 1);
      o.detune.value = (i - 1) * 6;
      const og = c.createGain(); og.gain.value = (tensa ? 0.018 : 0.012) / (i + 1);
      o.connect(og).connect(out); o.start(); nodes.push(o);
      if (tensa && i === 0) {
        const pulse = c.createOscillator(); pulse.frequency.value = 1.6;
        const pg = c.createGain(); pg.gain.value = 0.012;
        pulse.connect(pg).connect(og.gain); pulse.start(); nodes.push(pulse);
      }
    });
    return { out, nodes };
  }
}
