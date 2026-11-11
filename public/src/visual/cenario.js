// Cenário procedural animado (canvas 2D, sem imagens): céu por período, silhuetas em camadas geradas
// por semente (cada lugar tem um visual fixo), névoa, astros e partículas de clima/bioma.
// Visual não é estado de jogo: Math.random é aceitável para partículas; formas usam semente.

const CEUS = {
  madrugada: ['#070a16', '#1d2038', '#3a2f4a'],
  manha:     ['#2c4562', '#7b8fa6', '#e6b38a'],
  tarde:     ['#36587a', '#8aa0b3', '#d8bf8e'],
  noite:     ['#03050b', '#0b1222', '#1c2440'],
};
// Cor-base das silhuetas (perto) e "névoa" do bioma.
const BIOMAS = {
  vila:     { base: '#16120e', tinta: '#c58a4a', camadas: [['colinas', 0.62, 0.06], ['telhados', 0.74, 0.1], ['telhados', 0.86, 0.12]], luzes: true },
  estrada:  { base: '#16150f', tinta: '#a89a7c', camadas: [['serra', 0.55, 0.08], ['colinas', 0.7, 0.07], ['arvores_esparsas', 0.84, 0.1]] },
  floresta: { base: '#08130d', tinta: '#5f8f6a', camadas: [['serra', 0.5, 0.07], ['pinheiros', 0.66, 0.16], ['pinheiros', 0.8, 0.22], ['pinheiros', 0.93, 0.3]] },
  pantano:  { base: '#0e130c', tinta: '#7d8a52', camadas: [['colinas', 0.62, 0.03], ['arvores_mortas', 0.72, 0.16], ['juncos', 0.86, 0.06]], agua: 0.8 },
  montanha: { base: '#11151d', tinta: '#8e9bb0', camadas: [['picos', 0.42, 0.3], ['picos', 0.58, 0.22], ['serra', 0.76, 0.12], ['rochas', 0.9, 0.06]] },
  ruinas:   { base: '#141017', tinta: '#9a7fb8', camadas: [['serra', 0.56, 0.06], ['colunas', 0.72, 0.2], ['arcos', 0.88, 0.2]] },
  costa:    { base: '#0a1520', tinta: '#5aa0c8', camadas: [['falesia', 0.58, 0.12]], mar: 0.66 },
  mar:      { base: '#0a1520', tinta: '#5aa0c8', camadas: [['falesia', 0.58, 0.12]], mar: 0.66 },
  caverna:  { base: '#07070a', tinta: '#5ac8b8', camadas: [], caverna: true },
};

// ---------- utilidades ----------
function rngDe(seed) {
  let h = 1779033703 ^ String(seed).length;
  for (const ch of String(seed)) { h = Math.imul(h ^ ch.charCodeAt(0), 3432918353); h = (h << 13) | (h >>> 19); }
  return () => { h = Math.imul(h ^ (h >>> 16), 2246822507); h = Math.imul(h ^ (h >>> 13), 3266489909); return ((h ^= h >>> 16) >>> 0) / 4294967296; };
}
/** Aceita #rgb, #rrggbb e rgb(r,g,b). */
const hex = (c) => {
  c = String(c || '#000').trim();
  if (c.startsWith('rgb')) return (c.match(/\d+/g) || [0, 0, 0]).slice(0, 3).map(Number);
  if (c.length === 4) c = '#' + [...c.slice(1)].map((x) => x + x).join('');
  return [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16) || 0);
};
function mix(a, b, t) {
  const A = hex(a), B = hex(b);
  return `rgb(${A.map((v, i) => Math.round(v + (B[i] - v) * t)).join(',')})`;
}
const rgba = (c, a) => { const [r, g, b] = hex(c); return `rgba(${r},${g},${b},${a})`; };

/** Linha de cume por deslocamento do ponto médio. */
function cume(r, n, rug) {
  let pts = [0, 0];
  let amp = 1;
  for (let k = 0; k < n; k++) {
    const novo = [];
    for (let i = 0; i < pts.length - 1; i++) novo.push(pts[i], (pts[i] + pts[i + 1]) / 2 + (r() - 0.5) * amp);
    novo.push(pts[pts.length - 1]);
    pts = novo; amp *= rug;
  }
  const min = Math.min(...pts), max = Math.max(...pts) || 1;
  return pts.map((v) => (v - min) / (max - min || 1));
}

// ---------- silhuetas: desenham em ctx a forma preenchida com a cor atual ----------
const FORMAS = {
  // Torres e muralhas (castelos, cidades grandes, cidadelas).
  torres(ctx, r, W, H, y, a) {
    chao(ctx, W, H, y);
    const b = H * y;
    for (let x = r() * 60; x < W; x += 120 + r() * 220) {
      const h = H * a * (0.6 + r() * 0.6), w = 18 + r() * 16;
      ctx.fillRect(x, b - h, w, h);
      for (let k = 0; k < 3; k++) ctx.fillRect(x + k * (w / 3), b - h - 6, w / 5, 6); // ameias
      if (r() < 0.6) { ctx.beginPath(); ctx.moveTo(x - 3, b - h); ctx.lineTo(x + w / 2, b - h - w * 1.2); ctx.lineTo(x + w + 3, b - h); ctx.fill(); }
      const mw = 60 + r() * 100; // muralha até a próxima torre
      ctx.fillRect(x + w, b - h * 0.35, mw, h * 0.35);
      for (let k = 0; k < mw; k += 10) ctx.fillRect(x + w + k, b - h * 0.35 - 4, 5, 4);
    }
  },
  palmeiras(ctx, r, W, H, y, a) {
    chao(ctx, W, H, y);
    ctx.lineCap = 'round';
    for (let x = r() * 80; x < W; x += 90 + r() * 200) {
      const h = H * a * (0.6 + r() * 0.5), b = H * y, curva = (r() - 0.5) * 40;
      ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(x, b); ctx.quadraticCurveTo(x + curva, b - h / 2, x + curva * 1.4, b - h); ctx.stroke();
      ctx.lineWidth = 3;
      for (let k = 0; k < 6; k++) {
        const ang = Math.PI + (k / 5) * Math.PI, tx = x + curva * 1.4, ty = b - h;
        ctx.beginPath(); ctx.moveTo(tx, ty); ctx.quadraticCurveTo(tx + Math.cos(ang) * h * 0.25, ty - h * 0.08, tx + Math.cos(ang) * h * 0.35, ty + Math.abs(Math.sin(ang)) * h * 0.12 + h * 0.05); ctx.stroke();
      }
    }
  },
  dunas(ctx, r, W, H, y, a) {
    ctx.beginPath(); ctx.moveTo(0, H);
    let x = 0;
    while (x <= W) { const w = 140 + r() * 260, h = H * a * (0.4 + r() * 0.6); ctx.quadraticCurveTo(x + w * 0.6, H * y - h, x + w, H * y); x += w; }
    ctx.lineTo(W, H); ctx.closePath(); ctx.fill();
  },
  arvores_gigantes(ctx, r, W, H, y, a) {
    chao(ctx, W, H, y);
    for (let x = r() * 60; x < W; x += 140 + r() * 200) {
      const h = H * a * (0.8 + r() * 0.5), b = H * y, w = 14 + r() * 12;
      ctx.beginPath(); ctx.moveTo(x - w, b); ctx.lineTo(x - w * 0.4, b - h); ctx.lineTo(x + w * 0.4, b - h); ctx.lineTo(x + w, b); ctx.fill();
      for (let k = 0; k < 4; k++) { ctx.beginPath(); ctx.ellipse(x + (r() - 0.5) * h * 0.4, b - h - k * h * 0.08, h * (0.22 + r() * 0.1), h * 0.1, 0, 0, Math.PI * 2); ctx.fill(); }
    }
  },
  cogumelos(ctx, r, W, H, y, a) {
    chao(ctx, W, H, y);
    for (let x = r() * 40; x < W; x += 50 + r() * 130) {
      const h = H * a * (0.3 + r() * 0.7), b = H * y, w = h * (0.5 + r() * 0.3);
      ctx.fillRect(x - w * 0.08, b - h, w * 0.16, h);
      ctx.beginPath(); ctx.ellipse(x, b - h, w / 2, w / 4, 0, Math.PI, 0); ctx.fill();
    }
  },
  vulcao(ctx, r, W, H, y, a) {
    const cx = W * (0.3 + r() * 0.4), topo = H * y - H * a, base = W * 0.45;
    ctx.beginPath(); ctx.moveTo(cx - base, H * y); ctx.lineTo(cx - base * 0.12, topo); ctx.lineTo(cx + base * 0.12, topo); ctx.lineTo(cx + base, H * y);
    ctx.lineTo(W, H * y); ctx.lineTo(W, H); ctx.lineTo(0, H); ctx.lineTo(0, H * y); ctx.closePath(); ctx.fill();
  },
  serra(ctx, r, W, H, y, a) { perfil(ctx, W, H, y, a, cume(r, 7, 0.5)); },
  picos(ctx, r, W, H, y, a) { perfil(ctx, W, H, y, a, cume(r, 6, 0.62).map((v) => v ** 1.6)); },
  colinas(ctx, r, W, H, y, a) { perfil(ctx, W, H, y, a, cume(r, 5, 0.35)); },
  falesia(ctx, r, W, H, y, a) {
    const p = cume(r, 6, 0.45).map((v, i, l) => (i / l.length < 0.38 ? v * 0.4 + 0.6 : i / l.length < 0.45 ? 0.2 : 0));
    perfil(ctx, W, H, y, a, p);
  },
  rochas(ctx, r, W, H, y, a) { perfil(ctx, W, H, y, a, cume(r, 8, 0.7).map((v) => v * 0.6)); },
  pinheiros(ctx, r, W, H, y, a) {
    chao(ctx, W, H, y);
    const base = H * y;
    for (let x = -20; x < W + 20; x += 12 + r() * 26) {
      const h = H * a * (0.55 + r() * 0.55), w = h * (0.36 + r() * 0.1);
      ctx.fillRect(x - w * 0.05, base - h * 0.15, w * 0.1, h * 0.2); // tronco
      for (let k = 0; k < 3; k++) { // três saias de galhos sobrepostas
        const bw = w * (1 - k * 0.24), by = base - h * (0.1 + k * 0.26), topo = base - h * (0.5 + k * 0.25);
        ctx.beginPath(); ctx.moveTo(x - bw / 2, by); ctx.lineTo(x, topo); ctx.lineTo(x + bw / 2, by);
        ctx.quadraticCurveTo(x, by - h * 0.05, x - bw / 2, by); ctx.fill();
      }
    }
  },
  arvores_esparsas(ctx, r, W, H, y, a) {
    FORMAS.colinas(ctx, r, W, H, y, a * 0.3);
    for (let x = r() * 80; x < W; x += 60 + r() * 220) {
      const h = H * a * (0.5 + r() * 0.5), b = H * y;
      ctx.fillRect(x - 2, b - h * 0.5, 4, h * 0.5);
      ctx.beginPath(); ctx.ellipse(x, b - h * 0.6, h * 0.28, h * 0.32, 0, 0, Math.PI * 2); ctx.fill();
    }
  },
  arvores_mortas(ctx, r, W, H, y, a) {
    chao(ctx, W, H, y);
    ctx.lineCap = 'round';
    for (let x = r() * 60; x < W; x += 50 + r() * 160) galho(ctx, r, x, H * y, H * a * (0.5 + r() * 0.6), -Math.PI / 2, 4);
  },
  juncos(ctx, r, W, H, y, a) {
    chao(ctx, W, H, y);
    ctx.lineWidth = 1.5;
    for (let x = 0; x < W; x += 3 + r() * 5) {
      const h = H * a * (0.3 + r()), b = H * y + 2, s = (r() - 0.5) * 12;
      ctx.beginPath(); ctx.moveTo(x, b); ctx.quadraticCurveTo(x + s * 0.3, b - h / 2, x + s, b - h); ctx.stroke();
    }
  },
  telhados(ctx, r, W, H, y, a, janelas) {
    chao(ctx, W, H, y);
    let x = -r() * 40;
    while (x < W) {
      const w = 34 + r() * 60, h = H * a * (0.45 + r() * 0.55), b = H * y + 1, tel = w * (0.35 + r() * 0.25);
      ctx.fillRect(x, b - h, w, h);
      ctx.beginPath(); ctx.moveTo(x - 4, b - h); ctx.lineTo(x + w / 2, b - h - tel); ctx.lineTo(x + w + 4, b - h); ctx.fill();
      if (r() < 0.35) ctx.fillRect(x + w * 0.7, b - h - tel * 0.9, 6, tel * 0.6); // chaminé
      if (janelas) for (let k = 0; k < 1 + Math.floor(r() * 2); k++) {
        janelas.push({ x: x + 6 + r() * (w - 16), y: b - h * (0.3 + r() * 0.5), w: 5, h: 7, f: r() * 6 });
      }
      x += w + r() * 18;
    }
  },
  colunas(ctx, r, W, H, y, a) {
    chao(ctx, W, H, y);
    for (let x = r() * 60; x < W; x += 70 + r() * 150) {
      const h = H * a * (0.3 + r() * 0.8), w = 10 + r() * 10, b = H * y;
      ctx.fillRect(x, b - h, w, h);
      ctx.fillRect(x - 4, b - h, w + 8, 5);
      ctx.beginPath(); ctx.moveTo(x, b - h); ctx.lineTo(x + w * r(), b - h - 8 - r() * 10); ctx.lineTo(x + w, b - h); ctx.fill(); // quebra
    }
  },
  arcos(ctx, r, W, H, y, a) {
    chao(ctx, W, H, y);
    for (let x = r() * 100; x < W; x += 180 + r() * 260) {
      const h = H * a * (0.6 + r() * 0.5), w = h * 0.7, b = H * y, e = w * 0.16;
      ctx.beginPath();
      ctx.moveTo(x, b); ctx.lineTo(x, b - h * 0.6); ctx.arc(x + w / 2, b - h * 0.6, w / 2, Math.PI, 0); ctx.lineTo(x + w, b);
      ctx.lineTo(x + w - e, b); ctx.lineTo(x + w - e, b - h * 0.6); ctx.arc(x + w / 2, b - h * 0.6, w / 2 - e, 0, Math.PI, true);
      ctx.lineTo(x + e, b); ctx.closePath(); ctx.fill();
    }
  },
};
function perfil(ctx, W, H, y, a, pts) {
  ctx.beginPath(); ctx.moveTo(0, H);
  pts.forEach((v, i) => ctx.lineTo((i / (pts.length - 1)) * W, H * y - v * H * a));
  ctx.lineTo(W, H); ctx.closePath(); ctx.fill();
}
function chao(ctx, W, H, y) { ctx.fillRect(0, H * y, W, H * (1 - y) + 2); }
function galho(ctx, r, x, y, len, ang, prof) {
  if (prof <= 0 || len < 3) return;
  const x2 = x + Math.cos(ang) * len, y2 = y + Math.sin(ang) * len;
  ctx.lineWidth = prof * 1.4; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x2, y2); ctx.stroke();
  const n = 1 + Math.floor(r() * 2.4);
  for (let i = 0; i < n; i++) galho(ctx, r, x2, y2, len * (0.5 + r() * 0.25), ang + (r() - 0.5) * 1.6, prof - 1);
}

// ---------- caverna: estalactites, estalagmites e cristais ----------
function caverna(ctx, r, W, H, cor, cristal) {
  // Brilho difuso ao fundo (galeria distante) para dar profundidade.
  const gl = ctx.createRadialGradient(W * 0.5, H * 0.55, 0, W * 0.5, H * 0.55, Math.max(W, H) * 0.55);
  gl.addColorStop(0, rgba(cristal, 0.16)); gl.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = gl; ctx.fillRect(0, 0, W, H * 1.2);
  // Rocha ao fundo (mais clara) e em primeiro plano (escura).
  for (const [tom, escala] of [[mix(cor, cristal, 0.12), 0.7], [cor, 1]]) {
    ctx.fillStyle = tom;
    ctx.beginPath(); ctx.moveTo(0, 0);
    for (let x = 0; x <= W; x += 10 + r() * 34) {
      const h = H * (0.06 + r() ** 2.2 * 0.5) * escala;
      ctx.lineTo(x, H * 0.04); ctx.lineTo(x + 5 + r() * 9, h); ctx.lineTo(x + 12 + r() * 16, H * 0.05);
    }
    ctx.lineTo(W, 0); ctx.closePath(); ctx.fill();
    // Paredes laterais irregulares.
    for (const lado of [0, 1]) {
      ctx.beginPath(); ctx.moveTo(lado * W, 0);
      for (let yy = 0; yy <= H; yy += H / 12) ctx.lineTo(lado ? W - W * (0.06 + r() * 0.1) * escala : W * (0.06 + r() * 0.1) * escala, yy);
      ctx.lineTo(lado * W, H); ctx.closePath(); ctx.fill();
    }
    ctx.beginPath(); ctx.moveTo(0, H);
    for (let x = 0; x <= W; x += 16 + r() * 50) {
      const h = H * (0.08 + r() ** 2 * 0.34) * escala;
      ctx.lineTo(x, H * 0.92); ctx.lineTo(x + 8 + r() * 10, H - h); ctx.lineTo(x + 22 + r() * 20, H * 0.9);
    }
    ctx.lineTo(W, H); ctx.closePath(); ctx.fill();
  }
  const cr = [];
  for (let i = 0; i < 9; i++) cr.push({ x: W * (0.12 + r() * 0.76), y: H * (0.55 + r() * 0.35), s: 6 + r() * 14, f: r() * 6 });
  return cr.map((c) => ({ ...c, cor: cristal }));
}

// ---------- partículas ----------
function criarParticula(tipo, W, H, inicio, Hs = H) {
  const p = { tipo, x: Math.random() * W, y: inicio ? Math.random() * H : -10, v: 0, f: Math.random() * 6 };
  if (tipo === 'chuva') { p.v = 9 + Math.random() * 6; p.l = 10 + Math.random() * 14; }
  if (tipo === 'neve') { p.v = 0.4 + Math.random() * 0.8; p.s = 1 + Math.random() * 2.2; }
  if (tipo === 'vagalume') { p.y = Hs * (0.5 + Math.random() * 0.45); p.s = 1.2 + Math.random(); }
  if (tipo === 'poeira') { p.y = Math.random() * H; p.s = 0.6 + Math.random() * 1.2; p.v = 0.1 + Math.random() * 0.2; }
  if (tipo === 'brasa') { p.y = inicio ? Math.random() * H : H + 10; p.v = 0.6 + Math.random() * 1.4; p.s = 1 + Math.random() * 1.8; }
  if (tipo === 'folha') { p.v = 0.6 + Math.random(); p.s = 2 + Math.random() * 2; p.x = inicio ? p.x : -10; }
  if (tipo === 'cinza') { p.v = 0.3 + Math.random() * 0.5; p.s = 1 + Math.random() * 1.5; }
  if (tipo === 'esporo') { p.y = Math.random() * H; p.s = 1 + Math.random() * 1.6; p.v = 0.15 + Math.random() * 0.3; p.cor = ['#c58cff', '#7ef0d0', '#ffd27a', '#ff8ad8'][Math.floor(Math.random() * 4)]; }
  if (tipo === 'gota') { p.y = Hs * (0.05 + Math.random() * 0.2); p.v = 0; p.espera = Math.random() * 200; }
  return p;
}

/** Perfil visual: o do bioma vindo dos dados (cfg.perfil) sobre o embutido (cfg.bioma). */
function perfilDe(cfg) {
  const base = BIOMAS[cfg.perfil?.base || cfg.bioma] || BIOMAS.estrada;
  if (!cfg.perfil) return base;
  // `base` no JSON é o nome do perfil de partida; a cor das silhuetas vem de `cor_base`.
  const { base: _nome, cor_base: cor, ...resto } = cfg.perfil;
  return { ...base, ...resto, base: cor || base.base };
}

export class Cenario {
  constructor(canvas) {
    this.cv = canvas; this.ctx = canvas.getContext('2d');
    this.cfg = null; this.part = []; this.t = 0; this.vivo = false; this.raio = 0;
    this.reduzido = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.onResize = () => this.redimensionar();
    this.onVis = () => (document.hidden ? this.parar() : this.iniciar());
  }

  /** cfg = { bioma, periodo, clima, modo, seed, area } — area: fração da altura usada pela paisagem. */
  set(cfg) {
    const chave = JSON.stringify(cfg);
    if (chave === this.chave) return;
    const mudouLugar = !this.cfg || this.cfg.seed !== cfg.seed || this.cfg.bioma !== cfg.bioma || this.cfg.periodo !== cfg.periodo || this.cfg.clima !== cfg.clima;
    this.chave = chave; this.cfg = cfg;
    if (mudouLugar) { this.fade = 1; this.montar(); }
    this.ajustarParticulas();
    if (this.reduzido || !this.vivo) this.quadro();
  }

  iniciar() {
    if (this.vivo) return;
    this.vivo = true;
    addEventListener('resize', this.onResize);
    document.addEventListener('visibilitychange', this.onVis);
    if (this.reduzido) { this.quadro(); return; }
    let ultimo = 0;
    const loop = (ms) => {
      if (!this.vivo) return;
      if (ms - ultimo > 32) { ultimo = ms; this.t++; this.quadro(); } // ~30 fps
      this.raf = requestAnimationFrame(loop);
    };
    this.raf = requestAnimationFrame(loop);
  }
  parar() { this.vivo = false; cancelAnimationFrame(this.raf); }
  destruir() { this.parar(); removeEventListener('resize', this.onResize); document.removeEventListener('visibilitychange', this.onVis); }

  redimensionar() {
    const dpr = Math.min(1.5, devicePixelRatio || 1);
    const w = this.cv.clientWidth, h = this.cv.clientHeight;
    if (!w || !h) return;
    this.cv.width = Math.round(w * dpr); this.cv.height = Math.round(h * dpr);
    this.W = w; this.H = h; this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.montar(); this.ajustarParticulas(true); this.quadro();
  }

  /** Pré-desenha céu e silhuetas em camadas (offscreen) para o lugar atual. */
  montar() {
    if (!this.cfg) return;
    if (!this.W) { this.redimensionar(); if (!this.W) return; }
    const W = this.W, H = this.H * (this.cfg.area || 1), HT = this.H, cfg = this.cfg;
    this.Hs = H;
    const b = perfilDe(cfg), r = rngDe(cfg.seed || cfg.bioma);
    let ceu = [...(CEUS[cfg.periodo] || CEUS.tarde)];
    // Céu próprio (outros planos): mistura a cor do período com o tom do perfil.
    if (b.ceu) ceu = ceu.map((c, i) => mix(c, b.ceu[i] || b.ceu[0], b.ceuForca ?? 0.7));
    if (cfg.clima === 'chuva') ceu = ceu.map((c) => mix(c, '#2b3138', 0.55));
    if (cfg.clima === 'nevoa') ceu = ceu.map((c) => mix(c, '#5d6268', 0.45));
    if (cfg.clima === 'neve') ceu = ceu.map((c) => mix(c, '#8d939c', 0.4));
    const toHex = (c) => '#' + hex(c).map((v) => Math.max(0, Math.min(255, v)).toString(16).padStart(2, '0')).join('');
    ceu = ceu.map(toHex);
    this.ceu = ceu; this.b = b;
    this.noite = cfg.periodo === 'noite' || cfg.periodo === 'madrugada';
    const off = (draw) => { const c = document.createElement('canvas'); c.width = W; c.height = HT; draw(c.getContext('2d')); return c; };
    this.janelas = []; this.cristais = [];
    if (b.caverna) {
      const fundo = ['#0a0c10', '#101418', '#141a1c'];
      this.ceu = fundo;
      this.camadas = [off((c) => { this.cristais = caverna(c, r, W, H, b.base, b.tinta); c.fillStyle = b.base; c.fillRect(0, H * 0.94, W, HT); })];
    } else {
      const n = b.camadas.length;
      this.camadas = b.camadas.map(([tipo, y, a], i) => off((c) => {
        const longe = 1 - (i + 1) / (n + 0.6); // 0 = perto
        const nevoa = cfg.clima === 'nevoa' ? 0.25 : 0;
        const cor = mix(b.base, ceu[2], Math.min(0.92, longe * (this.noite ? 0.55 : 0.8) + nevoa));
        c.fillStyle = cor; c.strokeStyle = cor;
        FORMAS[tipo]?.(c, r, W, H, y, a, b.luzes && i >= n - 2 ? this.janelas : null);
        c.fillRect(0, H - 1, W, HT - H + 1); // o chão continua abaixo da paisagem
      }));
    }
    // Estrelas (fixas por semente).
    this.estrelas = this.noite && cfg.clima === 'limpo' && !b.caverna
      ? Array.from({ length: 90 }, () => ({ x: r() * W, y: r() * H * 0.5, s: r() * 1.3 + 0.2, f: r() * 6 })) : [];
    this.astro = b.caverna || cfg.clima === 'chuva' ? null
      : { x: W * (0.15 + r() * 0.6), y: Math.max(130, H * (cfg.periodo === 'tarde' ? 0.4 : cfg.periodo === 'manha' ? 0.5 : 0.3)), lua: this.noite };
  }

  ajustarParticulas(reset = false) {
    const cfg = this.cfg; if (!cfg || !this.W) return;
    const b = perfilDe(cfg);
    const alvo = [];
    for (const [tipo, n] of b.particulas || []) alvo.push([tipo, n]);
    if (cfg.clima === 'chuva' && !b.caverna) alvo.push(['chuva', 140]);
    if (cfg.clima === 'neve' && !b.caverna) alvo.push(['neve', 110]);
    if (cfg.bioma === 'floresta' && this.noite) alvo.push(['vagalume', 26]);
    if (cfg.bioma === 'floresta' && cfg.clima === 'vento') alvo.push(['folha', 20]);
    if (cfg.bioma === 'ruinas' || b.caverna) alvo.push(['poeira', 40]);
    if (b.caverna) alvo.push(['gota', 8]);
    if (cfg.modo === 'combate') alvo.push(['brasa', 45]);
    const tipos = new Set(alvo.map((a) => a[0]));
    this.part = reset ? [] : this.part.filter((p) => tipos.has(p.tipo));
    for (const [tipo, n] of alvo) {
      const tem = this.part.filter((p) => p.tipo === tipo).length;
      for (let i = tem; i < n; i++) this.part.push(criarParticula(tipo, this.W, this.H, true, this.Hs));
    }
  }

  quadro() {
    const { ctx, W, H, cfg } = this;
    if (!cfg || !W || !this.camadas) return;
    const t = this.t;
    // Céu
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, this.ceu[0]); g.addColorStop(0.55, this.ceu[1]); g.addColorStop(1, this.ceu[2]);
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    for (const e of this.estrelas) {
      ctx.globalAlpha = 0.35 + 0.35 * Math.sin(t * 0.05 + e.f);
      ctx.fillStyle = '#fff'; ctx.fillRect(e.x, e.y, e.s, e.s);
    }
    ctx.globalAlpha = 1;
    if (this.astro) {
      const a = this.astro, rad = this.astro.lua ? 16 : 26;
      const halo = ctx.createRadialGradient(a.x, a.y, 0, a.x, a.y, rad * 6);
      halo.addColorStop(0, a.lua ? 'rgba(220,225,255,.28)' : 'rgba(255,220,160,.45)'); halo.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = halo; ctx.fillRect(a.x - rad * 6, a.y - rad * 6, rad * 12, rad * 12);
      ctx.fillStyle = a.lua ? '#e6e8f2' : '#ffe2b0';
      ctx.globalAlpha = cfg.clima === 'nevoa' ? 0.35 : 0.9;
      ctx.beginPath(); ctx.arc(a.x, a.y, rad, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1;
    }
    if (this.raio > 0) { ctx.fillStyle = `rgba(220,230,255,${this.raio * 0.5})`; ctx.fillRect(0, 0, W, H); this.raio -= 0.08; }
    else if (cfg.clima === 'chuva' && !this.b.caverna && Math.random() < 0.002) this.raio = 1;

    // Silhuetas com paralaxe lenta (respiração horizontal).
    this.camadas.forEach((c, i) => {
      const dx = Math.sin(t * 0.004 + i) * (i + 1) * 3;
      ctx.drawImage(c, dx, 0);
      // Faixa de névoa entre camadas.
      if (i < this.camadas.length - 1 || this.b.caverna) {
        const y = this.Hs * ((this.b.camadas?.[i]?.[1]) || 0.7);
        const forte = cfg.clima === 'nevoa' ? 0.5 : 0.18;
        const nv = ctx.createLinearGradient(0, y - H * 0.08, 0, y + H * 0.04);
        nv.addColorStop(0, 'rgba(0,0,0,0)'); nv.addColorStop(0.6, rgba(this.ceu[2], forte)); nv.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = nv; ctx.fillRect(0, y - H * 0.08, W, H * 0.12);
      }
    });
    // Janelas acesas (vila) e cristais (caverna) piscando.
    if (this.noite || cfg.clima !== 'limpo') for (const j of this.janelas) {
      ctx.fillStyle = `rgba(255,190,110,${0.55 + 0.25 * Math.sin(t * 0.07 + j.f)})`; ctx.fillRect(j.x, j.y, j.w, j.h);
    }
    for (const c of this.cristais) {
      const a = 0.35 + 0.3 * Math.sin(t * 0.04 + c.f);
      const gl = ctx.createRadialGradient(c.x, c.y, 0, c.x, c.y, c.s * 4);
      gl.addColorStop(0, rgba(c.cor, a)); gl.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = gl; ctx.fillRect(c.x - c.s * 4, c.y - c.s * 4, c.s * 8, c.s * 8);
      ctx.fillStyle = rgba(c.cor, 0.9);
      ctx.beginPath(); ctx.moveTo(c.x, c.y - c.s); ctx.lineTo(c.x + c.s * 0.3, c.y); ctx.lineTo(c.x - c.s * 0.3, c.y); ctx.fill();
    }
    // Mar e água com reflexo ondulante.
    const yMar = this.b.mar || this.b.agua;
    if (yMar) {
      const y0 = this.Hs * yMar;
      const ag = ctx.createLinearGradient(0, y0, 0, H);
      ag.addColorStop(0, mix(this.ceu[2], this.b.base, 0.45)); ag.addColorStop(1, this.b.base);
      ctx.fillStyle = ag; ctx.fillRect(0, y0, W, H - y0);
      ctx.strokeStyle = rgba(this.ceu[2], 0.35); ctx.lineWidth = 1;
      for (let k = 0; k < 14; k++) {
        const yy = y0 + (k / 14) ** 1.6 * (H - y0) + 4, amp = 1 + k * 0.4;
        ctx.beginPath();
        for (let x = 0; x <= W; x += 16) ctx.lineTo(x, yy + Math.sin(x * 0.02 + t * 0.05 + k) * amp);
        ctx.globalAlpha = 0.25 + 0.5 * (1 - k / 14); ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }
    // Partículas.
    for (const p of this.part) this.particula(p);
    // Combate: pulso vermelho na borda.
    if (cfg.modo === 'combate') {
      const v = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.3, W / 2, H / 2, Math.max(W, H) * 0.75);
      v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, `rgba(140,30,20,${0.28 + 0.1 * Math.sin(t * 0.12)})`);
      ctx.fillStyle = v; ctx.fillRect(0, 0, W, H);
    }
    // Troca de lugar: escurece e revela.
    if (this.fade > 0) { ctx.fillStyle = `rgba(10,8,6,${this.fade})`; ctx.fillRect(0, 0, W, H); this.fade = this.reduzido ? 0 : this.fade - 0.04; }
  }

  particula(p) {
    const { ctx, W, H, t } = this;
    switch (p.tipo) {
      case 'chuva':
        ctx.strokeStyle = 'rgba(180,200,225,.35)'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x - 2, p.y + p.l); ctx.stroke();
        p.y += p.v; p.x -= 0.6;
        if (p.y > H) Object.assign(p, criarParticula('chuva', W, H, false));
        break;
      case 'neve':
        ctx.fillStyle = 'rgba(240,244,255,.8)'; ctx.beginPath(); ctx.arc(p.x, p.y, p.s, 0, Math.PI * 2); ctx.fill();
        p.y += p.v; p.x += Math.sin(t * 0.03 + p.f) * 0.4;
        if (p.y > H) Object.assign(p, criarParticula('neve', W, H, false));
        break;
      case 'vagalume': {
        const a = Math.max(0, Math.sin(t * 0.05 + p.f));
        ctx.fillStyle = `rgba(210,255,140,${a * 0.9})`; ctx.shadowColor = '#d4ff8c'; ctx.shadowBlur = 8;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.s, 0, Math.PI * 2); ctx.fill(); ctx.shadowBlur = 0;
        p.x += Math.sin(t * 0.02 + p.f * 3) * 0.5; p.y += Math.cos(t * 0.017 + p.f) * 0.3;
        break;
      }
      case 'poeira':
        ctx.fillStyle = `rgba(230,220,200,${0.15 + 0.15 * Math.sin(t * 0.03 + p.f)})`; ctx.fillRect(p.x, p.y, p.s, p.s);
        p.x += Math.sin(t * 0.01 + p.f) * 0.2; p.y -= p.v * 0.3;
        if (p.y < 0) p.y = H;
        break;
      case 'brasa':
        ctx.fillStyle = `rgba(255,${120 + Math.floor(60 * Math.sin(p.f + t * 0.1))},40,${0.7})`;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.s, 0, Math.PI * 2); ctx.fill();
        p.y -= p.v; p.x += Math.sin(t * 0.04 + p.f) * 0.6;
        if (p.y < -10) Object.assign(p, criarParticula('brasa', W, H, false));
        break;
      case 'folha':
        ctx.fillStyle = 'rgba(150,120,60,.7)';
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(t * 0.05 + p.f); ctx.fillRect(-p.s, -p.s / 2, p.s * 2, p.s); ctx.restore();
        p.x += 1.6 + p.v; p.y += Math.sin(t * 0.04 + p.f) * 0.8 + 0.3;
        if (p.x > W + 10) Object.assign(p, criarParticula('folha', W, H, false));
        break;
      case 'cinza':
        ctx.fillStyle = 'rgba(120,115,110,.55)'; ctx.fillRect(p.x, p.y, p.s, p.s);
        p.y += p.v; p.x += Math.sin(t * 0.02 + p.f) * 0.5;
        if (p.y > H) Object.assign(p, criarParticula('cinza', W, H, false));
        break;
      case 'esporo': {
        const a = 0.35 + 0.45 * Math.sin(t * 0.04 + p.f);
        ctx.globalAlpha = Math.max(0, a); ctx.fillStyle = p.cor; ctx.shadowColor = p.cor; ctx.shadowBlur = 6;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.s, 0, Math.PI * 2); ctx.fill(); ctx.shadowBlur = 0; ctx.globalAlpha = 1;
        p.y -= p.v; p.x += Math.sin(t * 0.015 + p.f * 2) * 0.4;
        if (p.y < 0) p.y = H;
        break;
      }
      case 'gota':
        if (p.espera > 0) { p.espera--; break; }
        ctx.fillStyle = 'rgba(160,220,230,.7)'; ctx.fillRect(p.x, p.y, 1.5, 4);
        p.v += 0.35; p.y += p.v;
        if (p.y > this.Hs * 0.92) Object.assign(p, criarParticula('gota', W, H, false, this.Hs), { espera: 60 + Math.random() * 240 });
        break;
    }
  }
}

export const BIOMAS_VISUAIS = Object.keys(BIOMAS);
export const FORMAS_VISUAIS = Object.keys(FORMAS);
export const PARTICULAS = ['chuva', 'neve', 'vagalume', 'poeira', 'brasa', 'folha', 'gota', 'cinza', 'esporo'];
