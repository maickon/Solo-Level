// Mesa de som: contexto, barramentos (ambiente, música, efeitos) com volumes e "ducking" para a narração.
import { Ambience } from './ambience.js';
import { Sfx } from './sfx.js';

export const VOLUMES_PADRAO = { master: 0.8, ambiente: 0.7, musica: 0.55, efeitos: 0.8 };

export class AudioEngine {
  constructor() { this.ctx = null; this.on = false; this.vol = { ...VOLUMES_PADRAO }; this.mood = null; this.abafado = false; }

  init() {
    if (this.ctx) return true;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    const c = (this.ctx = new AC());
    this.master = c.createGain(); this.master.gain.value = 0;
    const comp = c.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 4;
    this.master.connect(comp).connect(c.destination);
    this.bus = {};
    for (const k of ['ambiente', 'musica', 'efeitos']) { this.bus[k] = c.createGain(); this.bus[k].connect(this.master); }
    this.amb = new Ambience(c, this.bus.ambiente, this.bus.musica);
    this.sfx = new Sfx(c, this.bus.efeitos);
    this.aplicarVolumes();
    return true;
  }

  start() {
    if (!this.init()) return false;
    this.ctx.resume();
    this.on = true;
    this.master.gain.setTargetAtTime(this.vol.master, this.ctx.currentTime, 0.8);
    if (this.mood) this.amb.set(this.mood, true);
    return true;
  }
  stop() {
    this.on = false;
    if (!this.ctx) return;
    this.master.gain.setTargetAtTime(0, this.ctx.currentTime, 0.3);
    this.amb.pausar();
  }

  setVolumes(v) { this.vol = { ...this.vol, ...v }; this.aplicarVolumes(); }
  aplicarVolumes() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime, d = this.abafado ? 0.35 : 1;
    if (this.on) this.master.gain.setTargetAtTime(this.vol.master, t, 0.1);
    this.bus.ambiente.gain.setTargetAtTime(this.vol.ambiente * d, t, 0.3);
    this.bus.musica.gain.setTargetAtTime(this.vol.musica * d, t, 0.3);
    this.bus.efeitos.gain.setTargetAtTime(this.vol.efeitos, t, 0.05);
  }
  /** Abaixa ambiente e música enquanto a narração fala. */
  abafar(sim) { if (this.abafado !== sim) { this.abafado = sim; this.aplicarVolumes(); } }

  set(mood) { this.mood = mood; if (this.on) this.amb.set(mood); }
  /** Toca uma sequência de efeitos; devolve a duração (s). */
  play(nomes) { return this.on && nomes?.length ? this.sfx.seq(nomes) : 0; }
}
