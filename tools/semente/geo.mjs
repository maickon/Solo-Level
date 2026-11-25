// Geografia da Semente: relevo (ruído fractal com máscaras de continente e arquipélago), clima por latitude,
// umidade, biomas, rios e massas de terra. Tudo determinístico a partir do RNG recebido.

const vizinhos8 = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
const vizinhos4 = [[1, 0], [-1, 0], [0, 1], [0, -1]];

/** Ruído de valor suave (grade aleatória + interpolação), com oitavas (fBm). */
function criarRuido(rng, W, H, escalaBase, oitavas = 5) {
  const camadas = [];
  for (let o = 0; o < oitavas; o++) {
    const e = escalaBase / 2 ** o, gw = Math.ceil(W / e) + 2, gh = Math.ceil(H / e) + 2;
    const g = new Float32Array(gw * gh).map(() => rng.next());
    camadas.push({ e, gw, g, amp: 0.5 ** o });
  }
  const suave = (t) => t * t * (3 - 2 * t);
  return (x, y) => {
    let v = 0, total = 0;
    for (const { e, gw, g, amp } of camadas) {
      const fx = x / e, fy = y / e, ix = Math.floor(fx), iy = Math.floor(fy), tx = suave(fx - ix), ty = suave(fy - iy);
      const a = g[iy * gw + ix], b = g[iy * gw + ix + 1], c = g[(iy + 1) * gw + ix], d = g[(iy + 1) * gw + ix + 1];
      v += amp * ((a * (1 - tx) + b * tx) * (1 - ty) + (c * (1 - tx) + d * tx) * ty);
      total += amp;
    }
    return v / total;
  };
}

export function gerarGeografia(rng, { W = 180, H = 110, terra = 0.4 } = {}) {
  const N = W * H, idx = (x, y) => y * W + x;
  const relevo = criarRuido(rng, W, H, 40, 5), crista = criarRuido(rng, W, H, 26, 4);
  const wx = criarRuido(rng, W, H, 30, 3), wy = criarRuido(rng, W, H, 30, 3), alto = criarRuido(rng, W, H, 22, 4), detalhe = criarRuido(rng, W, H, 10, 3);
  const umid = criarRuido(rng, W, H, 34, 4), antiga = criarRuido(rng, W, H, 18, 3), temp = criarRuido(rng, W, H, 50, 3);

  // Máscaras: 3 continentes espalhados na horizontal + 2 arquipélagos nos vãos.
  const conts = [0.18, 0.5, 0.82].map((fx) => ({
    x: W * (fx + (rng.next() - 0.5) * 0.05), y: H * (0.38 + rng.next() * 0.24),
    rx: W * (0.1 + rng.next() * 0.035), ry: H * (0.3 + rng.next() * 0.1),
  }));
  const arqs = [0.34, 0.66].map((fx) => ({ x: W * (fx + (rng.next() - 0.5) * 0.04), y: H * (rng.chance(0.5) ? 0.22 : 0.78), r: Math.min(W, H) * 0.11 }));
  const ilhas = criarRuido(rng, W, H, 7, 2);

  const bruto = new Float32Array(N);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    let m = 0;
    // Coordenadas deformadas: costas recortadas, penínsulas e baías em vez de elipses.
    const qx = x + (wx(x, y) - 0.5) * W * 0.22, qy = y + (wy(x, y) - 0.5) * H * 0.3;
    for (const c of conts) m = Math.max(m, 1 - (((qx - c.x) / c.rx) ** 2 + ((qy - c.y) / c.ry) ** 2));
    // Fossas oceânicas entre os continentes: garantem 3 massas separadas (travessia só por mar).
    for (let k = 0; k < conts.length - 1; k++) {
      const meio = (conts[k].x + conts[k + 1].x) / 2;
      m -= 2.4 * Math.exp(-(((x + (wx(x, y) - 0.5) * W * 0.05 - meio) / (W * 0.04)) ** 2));
    }
    for (const a of arqs) { const d = 1 - Math.hypot(x - a.x, y - a.y) / a.r; if (d > 0) m = Math.max(m, d * 0.5 + (ilhas(x, y) - 0.55) * 1.8); }
    const borda = Math.min(x, y, W - 1 - x, H - 1 - y) / 8; // o mapa termina em mar
    bruto[idx(x, y)] = m * 1.0 + (relevo(x, y) - 0.5) * 0.5 + (detalhe(x, y) - 0.5) * 0.3 - (borda < 1 ? (1 - borda) * 0.8 : 0);
  }
  // Nível do mar pelo percentil: garante a fração de terra pedida.
  const ord = [...bruto].sort((a, b) => a - b), nivel = ord[Math.floor(N * (1 - terra))];
  const max = ord[N - 1];

  const elev = new Float32Array(N), bioma = new Array(N).fill('mar');
  for (let i = 0; i < N; i++) {
    const x = i % W, y = (i / W) | 0;
    if (bruto[i] <= nivel) { elev[i] = -1; continue; }
    // A máscara só decide terra × mar; o relevo vem de ruído próprio + cordilheiras em linha.
    const base = Math.min(1, (bruto[i] - nivel) / ((max - nivel) * 0.35));
    const cr = 1 - Math.abs(crista(x, y) - 0.5) * 2;
    elev[i] = Math.min(1, (alto(x, y) * 0.6 + cr ** 5 * 0.55) * (0.35 + 0.65 * base));
  }

  // Distância até o mar (BFS) para umidade costeira e costas.
  const distMar = new Int16Array(N).fill(-1), fila = [];
  for (let i = 0; i < N; i++) if (elev[i] < 0) { distMar[i] = 0; fila.push(i); }
  for (let q = 0; q < fila.length; q++) {
    const i = fila[q], x = i % W, y = (i / W) | 0;
    for (const [dx, dy] of vizinhos4) {
      const nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
      const j = idx(nx, ny); if (distMar[j] < 0) { distMar[j] = distMar[i] + 1; fila.push(j); }
    }
  }

  // Focos vulcânicos.
  const terras = []; for (let i = 0; i < N; i++) if (elev[i] > 0.35) terras.push(i);
  const vulcoes = Array.from({ length: 3 }, () => rng.pick(terras));

  // Rios: nascem no alto e úmido, descem pelo vizinho mais baixo até o mar.
  const rio = new Uint8Array(N), rios = [];
  const fontes = [];
  for (let t = 0; t < 4000 && fontes.length < 24; t++) {
    const i = rng.pick(terras); const x = i % W, y = (i / W) | 0;
    if (elev[i] > 0.42 && umid(x, y) > 0.42 && fontes.every((f) => Math.hypot(f % W - x, ((f / W) | 0) - y) > 11)) fontes.push(i);
  }
  for (const f of fontes) {
    const caminho = [f]; let i = f;
    for (let passo = 0; passo < 300; passo++) {
      const x = i % W, y = (i / W) | 0;
      let melhor = -1, menor = elev[i];
      for (const [dx, dy] of vizinhos8) {
        const nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
        const j = idx(nx, ny), e = elev[j] < 0 ? -1 : elev[j] - (rio[j] ? 0.02 : 0);
        if (e < menor) { menor = e; melhor = j; }
      }
      if (melhor < 0) break; // lago: não há para onde descer
      i = melhor; caminho.push(i);
      if (elev[i] < 0 || rio[i]) break;
    }
    if (caminho.length >= 6) { for (const c of caminho) if (elev[c] >= 0) rio[c] = 1; rios.push(caminho.filter((c) => elev[c] >= 0)); }
  }

  // Biomas.
  for (let i = 0; i < N; i++) {
    if (elev[i] < 0) continue;
    const x = i % W, y = (i / W) | 0, e = elev[i];
    // Latitude: norte frio, sul quente; o relevo esfria um pouco.
    const t = Math.min(1, Math.max(0, y / (H - 1) + (temp(x, y) - 0.5) * 0.22 - e * 0.12));
    const u = Math.min(1, umid(x, y) + (distMar[i] <= 3 ? 0.12 : 0) + (rio[i] ? 0.2 : 0) - (distMar[i] > 18 ? 0.12 : 0));
    let b;
    if (vulcoes.some((v) => Math.hypot(v % W - x, ((v / W) | 0) - y) < 4.5) && e > 0.3) b = 'vulcanico';
    else if (e > 0.66) b = t < 0.25 ? 'geleira' : 'montanha';
    else if (t < 0.13) b = 'geleira';
    else if (t < 0.26) b = 'tundra';
    else if (distMar[i] <= 1 && e < 0.35) b = 'costa';
    else if (t > 0.68) b = u > 0.58 ? 'selva' : u < 0.42 ? 'deserto' : 'savana';
    else if (u > 0.62 && e < 0.25) b = 'pantano';
    else if (u > 0.56) b = antiga(x, y) > 0.62 ? 'floresta_antiga' : 'floresta';
    else if (e > 0.5) b = 'colinas';
    else b = 'planicie';
    bioma[i] = b;
  }

  // Massas de terra: continentes (as 3 maiores) e ilhas.
  const massa = new Int32Array(N).fill(-1), massas = [];
  for (let i = 0; i < N; i++) {
    if (elev[i] < 0 || massa[i] >= 0) continue;
    const id = massas.length, pilha = [i]; massa[i] = id; let n = 0;
    while (pilha.length) {
      const k = pilha.pop(); n++;
      const x = k % W, y = (k / W) | 0;
      for (const [dx, dy] of vizinhos4) {
        const nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
        const j = idx(nx, ny); if (elev[j] >= 0 && massa[j] < 0) { massa[j] = id; pilha.push(j); }
      }
    }
    massas.push({ id, tamanho: n });
  }
  const ordem = [...massas].sort((a, b) => b.tamanho - a.tamanho);
  ordem.forEach((m, k) => { m.tipo = k < 3 ? 'continente' : 'ilha'; });

  return { W, H, elev, bioma, rio, rios, massa, massas, distMar, idx };
}

/** Grade compacta (uma letra por célula) para guardar e redesenhar o mapa; rios vão à parte. */
export const CODIGO_BIOMA = { mar: '~', costa: 'c', planicie: 'p', colinas: 'h', floresta: 'f', floresta_antiga: 'F', selva: 's',
  pantano: 'w', savana: 'v', deserto: 'd', tundra: 't', geleira: 'g', montanha: 'm', vulcanico: 'x' };
export function compactar(geo) {
  const linhas = [];
  for (let y = 0; y < geo.H; y++) {
    let l = '';
    for (let x = 0; x < geo.W; x++) l += CODIGO_BIOMA[geo.bioma[geo.idx(x, y)]];
    linhas.push(l);
  }
  return linhas;
}
