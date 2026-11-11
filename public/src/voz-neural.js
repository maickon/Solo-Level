// Narrador neural próprio: Piper (VITS) rodando no navegador via WebAssembly/ONNX — grátis, offline após
// o download único do modelo (~63 MB, guardado no OPFS do navegador). Biblioteca carregada sob demanda.
const LIB = 'https://cdn.jsdelivr.net/npm/@mintplex-labs/piper-tts-web@1.0.4/dist/piper-tts-web.js';

export const VOZES_NEURAIS = [
  { id: 'pt_BR-faber-medium', nome: 'Fábio (masculina, média)', mb: 63 },
  { id: 'pt_BR-edresson-low', nome: 'Edresson (masculina, leve)', mb: 63 },
];

export class VozNeural {
  constructor() {
    this.lib = null; this.voz = VOZES_NEURAIS[0].id; this.taxa = 1;
    this.lote = 0; this.audio = null; this.onEstado = null; this.falando = false;
  }
  get suportada() { return typeof WebAssembly !== 'undefined' && !!navigator.storage?.getDirectory; }

  async carregar() {
    if (!this.lib) this.lib = await import(LIB);
    return this.lib;
  }
  /** Ids das vozes já baixadas. */
  async baixadas() {
    try { return await (await this.carregar()).stored(); } catch { return []; }
  }
  async baixar(id, progresso) {
    const tts = await this.carregar();
    await tts.download(id, (p) => progresso?.(p.total ? p.loaded / p.total : 0));
    // A biblioteca não espera a gravação no armazenamento terminar: confirmamos antes de dizer "pronto".
    for (let i = 0; i < 120; i++) {
      if ((await tts.stored()).includes(id)) return;
      await new Promise((r) => setTimeout(r, 500));
    }
    throw new Error('A voz baixou, mas não foi possível guardá-la neste aparelho.');
  }
  /** Carrega o modelo na memória com uma frase curta, para a primeira cena não demorar. */
  async aquecer(id) {
    if (this.aquecida === id) return;
    this.aquecida = id;
    try { await (await this.carregar()).predict({ text: 'Olá.', voiceId: id }); } catch { this.aquecida = null; }
  }
  async remover(id) { const tts = await this.carregar(); await tts.remove(id); }

  /** Fala frase a frase; gera a próxima enquanto a atual toca. */
  async falar(texto) {
    this.parar();
    const lote = ++this.lote;
    const frases = (texto.replace(/\s+/g, ' ').match(/[^.!?…]+[.!?…]+["”»]?|[^.!?…]+$/g) || [texto]).map((f) => f.trim()).filter(Boolean);
    if (!frases.length) return;
    const tts = await this.carregar();
    const gerar = (f) => tts.predict({ text: f, voiceId: this.voz });
    this.estado(true, lote);
    let proxima = gerar(frases[0]);
    for (let i = 0; i < frases.length; i++) {
      let wav;
      try { wav = await proxima; } catch (e) { console.warn('voz neural:', e); break; }
      if (lote !== this.lote) return;
      if (i + 1 < frases.length) proxima = gerar(frases[i + 1]);
      await this.tocar(wav, lote);
      if (lote !== this.lote) return;
    }
    this.estado(false, lote);
  }
  tocar(wav, lote) {
    return new Promise((ok) => {
      const url = URL.createObjectURL(wav);
      const a = (this.audio = new Audio(url));
      a.playbackRate = this.taxa;
      a.preservesPitch = true;
      const fim = () => { URL.revokeObjectURL(url); ok(); };
      a.onended = fim; a.onerror = fim;
      a.play().catch(fim);
      if (lote !== this.lote) fim();
    });
  }
  parar() {
    this.lote++;
    if (this.audio) { this.audio.pause(); this.audio = null; }
    this.estado(false, this.lote);
  }
  estado(v, lote) { if (lote !== this.lote) return; this.falando = v; this.onEstado?.(v); }
}
