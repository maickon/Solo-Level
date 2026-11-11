// Narração com a Web Speech API (grátis, sem servidor). Prefere vozes neurais em PT-BR quando o
// navegador oferece: no Edge, "Microsoft Francisca/Antonio Online (Natural)"; no Chrome, "Google português".
import { VozNeural } from './voz-neural.js';
const NEURAL = /natural|neural|online|google|premium|enhanced/i;

export class Narrador {
  constructor() {
    this.synth = typeof window !== 'undefined' ? window.speechSynthesis || null : null;
    this.cfg = { on: false, auto: true, opcoes: false, voz: '', taxa: 1, motor: 'navegador', neural: 'pt_BR-faber-medium' };
    this.falando = false; this.onEstado = null; this.lote = 0;
    // Narrador neural (Piper): usado quando escolhido e já baixado.
    this.neural = new VozNeural();
    this.neuralBaixadas = [];
    this.neural.onEstado = (v) => { this.falando = v; this.onEstado?.(v); };
    this.vozes = [];
    if (this.synth) {
      const carregar = () => { this.vozes = this.synth.getVoices(); this.onVozes?.(); };
      carregar();
      this.synth.addEventListener?.('voiceschanged', carregar);
    }
  }
  get disponivel() { return !!this.synth || this.neural.suportada; }
  get usaNeural() { return this.cfg.motor === 'neural' && this.neuralBaixadas.includes(this.cfg.neural); }
  async atualizarNeural() {
    this.neuralBaixadas = this.neural.suportada ? await this.neural.baixadas() : [];
    if (this.usaNeural) this.neural.aquecer(this.cfg.neural);
    return this.neuralBaixadas;
  }

  /** Vozes em português, neurais e PT-BR primeiro. */
  listar() {
    const pt = this.vozes.filter((v) => /^pt/i.test(v.lang));
    const nota = (v) => (NEURAL.test(v.name) ? 0 : 2) + (/^pt[-_]BR/i.test(v.lang) ? 0 : 1);
    return pt.sort((a, b) => nota(a) - nota(b) || a.name.localeCompare(b.name));
  }
  ehNeural(v) { return NEURAL.test(v?.name || ''); }
  voz() { const l = this.listar(); return l.find((v) => v.name === this.cfg.voz) || l[0] || null; }

  /** Fala o texto em frases curtas (o Chrome corta falas longas). */
  falar(texto) {
    if (!texto?.trim()) return;
    if (this.usaNeural) { this.parar(); this.neural.voz = this.cfg.neural; this.neural.taxa = this.cfg.taxa; this.neural.falar(texto); return; }
    if (!this.synth) return;
    this.parar();
    const lote = ++this.lote;
    const frases = texto.replace(/\s+/g, ' ').match(/[^.!?…]+[.!?…]+["”»]?|[^.!?…]+$/g) || [texto];
    const partes = [];
    for (const f of frases) { // junta frases curtas até ~220 caracteres
      if (partes.length && (partes[partes.length - 1] + f).length < 220) partes[partes.length - 1] += f;
      else partes.push(f.trim());
    }
    const voz = this.voz();
    // Pequeno atraso: falar logo após cancel() falha em alguns navegadores.
    setTimeout(() => {
      if (lote !== this.lote) return;
      partes.forEach((p, i) => {
        const u = new SpeechSynthesisUtterance(p);
        if (voz) u.voice = voz;
        u.lang = voz?.lang || 'pt-BR';
        u.rate = this.cfg.taxa;
        if (i === 0) u.onstart = () => this.estado(true, lote);
        if (i === partes.length - 1) { u.onend = () => this.estado(false, lote); u.onerror = () => this.estado(false, lote); }
        this.synth.speak(u);
      });
    }, 60);
  }
  parar() {
    this.neural.parar();
    if (!this.synth) return;
    this.lote++;
    this.synth.cancel();
    this.estado(false, this.lote);
  }
  estado(v, lote) { if (lote !== this.lote) return; this.falando = v; this.onEstado?.(v); }
}
