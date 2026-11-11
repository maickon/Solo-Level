// Narração com a Web Speech API (grátis, sem servidor). Prefere vozes neurais em PT-BR quando o
// navegador oferece: no Edge, "Microsoft Francisca/Antonio Online (Natural)"; no Chrome, "Google português".
const NEURAL = /natural|neural|online|google|premium|enhanced/i;

export class Narrador {
  constructor() {
    this.synth = typeof window !== 'undefined' ? window.speechSynthesis || null : null;
    this.cfg = { on: false, auto: true, opcoes: false, voz: '', taxa: 1 };
    this.falando = false; this.onEstado = null; this.lote = 0;
    this.vozes = [];
    if (this.synth) {
      const carregar = () => { this.vozes = this.synth.getVoices(); this.onVozes?.(); };
      carregar();
      this.synth.addEventListener?.('voiceschanged', carregar);
    }
  }
  get disponivel() { return !!this.synth; }

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
    if (!this.synth || !texto?.trim()) return;
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
    if (!this.synth) return;
    this.lote++;
    this.synth.cancel();
    this.estado(false, this.lote);
  }
  estado(v, lote) { if (lote !== this.lote) return; this.falando = v; this.onEstado?.(v); }
}
