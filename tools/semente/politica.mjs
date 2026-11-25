// Política da Semente: capitais e culturas, territórios (crescimento por custo de terreno), terras selvagens,
// povoados, lugares de natureza/ruína/masmorra, rotas terrestres e marítimas, relações entre reinos.
import { markovName } from '../../public/src/engine/names.js';
import { CULTURAS, POVOS, TIPOS_POVOADO, LUGARES_BIOMA, LUGARES_MAR, COMPLEMENTOS, ADJETIVOS, RELACOES } from './tabelas.mjs';

const V4 = [[1, 0], [-1, 0], [0, 1], [0, -1]];
const HABITAVEL = { planicie: 1.3, colinas: 1, floresta: 0.9, costa: 1.1, savana: 0.8, deserto: 0.45, tundra: 0.5, pantano: 0.5,
  selva: 0.6, montanha: 0.55, vulcanico: 0.35, floresta_antiga: 0.7, geleira: 0.15 };
const CUSTO = { planicie: 1, colinas: 1.4, floresta: 1.6, costa: 1, savana: 1.1, deserto: 1.8, tundra: 1.6, pantano: 2.2,
  selva: 2.2, montanha: 3.5, vulcanico: 3, floresta_antiga: 2.4, geleira: 4 };
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
export const sementes = (lista) => { const s = lista.filter((n) => !n.includes(' ')); return s.length >= 6 ? s : lista.map((n) => n.split(' ').pop()); };
const slug = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');

export function gerarPolitica(rng, geo) {
  const { W, H, bioma, rio, massa, massas, distMar, idx } = geo;
  const xy = (i) => ({ x: i % W, y: (i / W) | 0 });
  const nomesUsados = new Set();
  const maiusc = (n) => n.replace(/-([a-zà-ú])/g, (_, c) => `-${c.toUpperCase()}`);
  const nomeUnico = (lista, gerar0 = () => markovName(rng, sementes(lista))) => {
    const gerar = () => maiusc(gerar0());
    for (let t = 0; t < 40; t++) { const n = gerar(); if (!nomesUsados.has(n)) { nomesUsados.add(n); return n; } }
    // Último recurso: junta dois nomes gerados (nunca numerais).
    for (let t = 0; t < 40; t++) { const n = gerar() + gerar().toLowerCase().slice(-3); if (!nomesUsados.has(n)) { nomesUsados.add(n); return n; } }
    const n = `${gerar()} ${rng.pick(['Velha', 'Nova', 'Alta', 'Baixa'])}`; nomesUsados.add(n); return n;
  };

  // ---------- 1. Capitais (distribuídas pelos continentes e pela maior ilha) ----------
  const terra = []; for (let i = 0; i < W * H; i++) if (bioma[i] !== 'mar' && bioma[i] !== 'geleira') terra.push(i);
  const continentes = massas.filter((m) => m.tipo === 'continente');
  const ilhaGrande = massas.filter((m) => m.tipo === 'ilha' && m.tamanho >= 45).sort((a, b) => b.tamanho - a.tamanho)[0];
  const K = rng.int(14, 18);
  const totalCont = continentes.reduce((a, m) => a + m.tamanho, 0);
  const cotas = new Map(continentes.map((m) => [m.id, Math.max(3, Math.round(((K - (ilhaGrande ? 1 : 0)) * m.tamanho) / totalCont))]));
  if (ilhaGrande) cotas.set(ilhaGrande.id, 1);
  const pontua = (i) => (HABITAVEL[bioma[i]] || 0.3) * (1 + (rio[i] ? 1.4 : 0) + (distMar[i] <= 2 ? 0.7 : 0));
  const capitais = [];
  for (const [mid, n] of cotas) {
    const cand = terra.filter((i) => massa[i] === mid);
    if (!cand.length) continue; // massa só de geleira: sem lugar habitável para capital
    for (let k = 0, t = 0; k < n && t < 3000; t++) {
      const i = rng.weighted(cand, pontua); if (i === undefined) break;
      const p = xy(i);
      if (capitais.some((c) => dist(c, p) < 15)) continue;
      capitais.push({ ...p, i, massa: mid, bioma: bioma[i] }); k++;
    }
  }

  // ---------- 2. Culturas: garante povos não humanos onde o terreno combina ----------
  const vizinhanca = (c) => { const cnt = {}; for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) { const x = c.x + dx, y = c.y + dy; if (x < 0 || y < 0 || x >= W || y >= H) continue; const b = bioma[idx(x, y)]; if (b !== 'mar') cnt[b] = (cnt[b] || 0) + 1; } return cnt; };
  const afinidade = (cul, c) => { const v = vizinhanca(c); return cul.biomas.reduce((a, b) => a + (v[b] || 0), 0) + (cul.biomas.includes(c.bioma) ? 10 : 0); };
  const usoCultura = new Map();
  for (const povo of ['anoes', 'elfos', 'orcs', 'gigantes', 'halflings', 'marinos']) {
    const cul = CULTURAS.find((c) => c.povo === povo);
    const livres = capitais.filter((c) => !c.cultura && (povo !== 'marinos' || distMar[c.i] <= 2));
    const melhor = livres.map((c) => ({ c, a: afinidade(cul, c) })).sort((a, b) => b.a - a.a)[0];
    if (melhor && melhor.a > 6) { melhor.c.cultura = cul.id; usoCultura.set(cul.id, 1); }
  }
  const humanas = CULTURAS.filter((c) => c.povo === 'humanos');
  for (const c of capitais.filter((x) => !x.cultura)) {
    const ranking = humanas.map((cul) => ({ cul, a: afinidade(cul, c) / (1 + 2 * (usoCultura.get(cul.id) || 0)) })).sort((a, b) => b.a - a.a);
    c.cultura = ranking[0].cul.id; usoCultura.set(c.cultura, (usoCultura.get(c.cultura) || 0) + 1);
  }

  // ---------- 3. Territórios: Dijkstra multi-fonte com custo de terreno e raio por reino ----------
  const dono = new Int16Array(W * H).fill(-1), custoAte = new Float64Array(W * H).fill(Infinity);
  const reinos = capitais.map((c, k) => {
    const cul = CULTURAS.find((x) => x.id === c.cultura);
    return { k, capital: c, cultura: cul, raio: 22 + rng.next() * 30 };
  });
  const heap = []; const push = (n) => { heap.push(n); let i = heap.length - 1; while (i > 0) { const p = (i - 1) >> 1; if (heap[p].c <= heap[i].c) break; [heap[p], heap[i]] = [heap[i], heap[p]]; i = p; } };
  const pop = () => { const top = heap[0], last = heap.pop(); if (heap.length) { heap[0] = last; let i = 0; for (;;) { const l = 2 * i + 1, r = l + 1; let m = i; if (l < heap.length && heap[l].c < heap[m].c) m = l; if (r < heap.length && heap[r].c < heap[m].c) m = r; if (m === i) break; [heap[m], heap[i]] = [heap[i], heap[m]]; i = m; } } return top; };
  for (const r of reinos) { custoAte[r.capital.i] = 0; push({ c: 0, i: r.capital.i, k: r.k }); }
  while (heap.length) {
    const { c, i, k } = pop();
    if (c > custoAte[i] || dono[i] >= 0) continue;
    dono[i] = k;
    const { x, y } = xy(i), povo = reinos[k].cultura.povo;
    for (const [dx, dy] of V4) {
      const nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
      const j = idx(nx, ny); if (bioma[j] === 'mar' || dono[j] >= 0) continue;
      let custo = CUSTO[bioma[j]] || 2;
      if (POVOS[povo].biomas.includes(bioma[j])) custo *= 0.6; // cada povo avança melhor no seu terreno
      const nc = c + custo;
      if (nc <= reinos[k].raio && nc < custoAte[j]) { custoAte[j] = nc; push({ c: nc, i: j, k }); }
    }
  }

  // ---------- 4. Terras selvagens e ilhas sem dono viram territórios sem governo ----------
  const visto = new Uint8Array(W * H);
  for (const i of terra) {
    if (dono[i] >= 0 || visto[i]) continue;
    const pilha = [i], comp = []; visto[i] = 1;
    while (pilha.length) {
      const k = pilha.pop(); comp.push(k); const { x, y } = xy(k);
      for (const [dx, dy] of V4) { const nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue; const j = idx(nx, ny); if (!visto[j] && dono[j] < 0 && bioma[j] !== 'mar' && bioma[j] !== 'geleira') { visto[j] = 1; pilha.push(j); } }
    }
    const ehIlha = massas[massa[i]]?.tipo === 'ilha';
    if (comp.length < (ehIlha ? 12 : 60)) continue;
    const k = reinos.length, centro = comp.reduce((a, c) => ({ x: a.x + (c % W) / comp.length, y: a.y + ((c / W) | 0) / comp.length }), { x: 0, y: 0 });
    for (const c of comp) dono[c] = k;
    const cnt = {}; comp.forEach((c) => { cnt[bioma[c]] = (cnt[bioma[c]] || 0) + 1; });
    const dom = Object.entries(cnt).sort((a, b) => b[1] - a[1])[0][0];
    reinos.push({ k, selvagem: true, ilhas: ehIlha, celulas: comp, centro, biomaDominante: dom });
  }
  // Geleiras e sobras pequenas ficam sem dono (ermos).

  // ---------- 5. Nomes e governos ----------
  for (const r of reinos) {
    r.celulas ||= terra.filter((i) => dono[i] === r.k);
    r.tamanho = r.celulas.length;
    if (!r.selvagem) {
      const raiz = nomeUnico(r.cultura.lugares);
      r.governo = rng.pick(r.cultura.governos);
      r.nome = `${r.governo} de ${raiz}`;
      r.raiz = raiz;
      r.id = slug(raiz);
      r.centro = r.celulas.reduce((a, c) => ({ x: a.x + (c % W) / r.tamanho, y: a.y + ((c / W) | 0) / r.tamanho }), { x: 0, y: 0 });
    } else {
      const adj = rng.pick(ADJETIVOS);
      const base = r.ilhas ? 'Ilhas' : { deserto: 'Areias', tundra: 'Ermos', pantano: 'Brejos', selva: 'Selvas', montanha: 'Picos', floresta: 'Matas', floresta_antiga: 'Matas', vulcanico: 'Terras', savana: 'Estepes' }[r.biomaDominante] || 'Terras';
      const fem = ['Ilhas', 'Areias', 'Selvas', 'Matas', 'Terras', 'Estepes'].includes(base);
      r.nome = `${base} ${fem ? adj[1] : adj[0]}s`; // base no plural: adjetivo no plural
      if (nomesUsados.has(r.nome)) r.nome = `${base} ${rng.pick(COMPLEMENTOS)}`;
      nomesUsados.add(r.nome);
      r.governo = r.ilhas ? 'Terra sem lei' : 'Território selvagem';
      r.id = slug(r.nome);
    }
  }
  const idsVistos = new Set();
  for (const r of reinos) { let id = r.id; let n = 2; while (idsVistos.has(id)) id = `${r.id}_${n++}`; r.id = id; idsVistos.add(id); }

  // ---------- 6. Povoados ----------
  const lugares = [];
  const ocupados = [];
  const livre = (p, d) => ocupados.every((o) => dist(o, p) >= d);
  const novoLugar = (dados) => { const l = { nivel: 0, ...dados }; lugares.push(l); ocupados.push(l); return l; };
  const idLugar = (nome) => { let id = slug(nome), n = 2; while (lugares.some((l) => l.id === id)) id = `${slug(nome)}_${n++}`; return id; };
  for (const r of reinos.filter((x) => !x.selvagem)) {
    const c = r.capital, nome = nomeUnico(r.cultura.lugares);
    r.capitalId = idLugar(nome);
    novoLugar({ id: r.capitalId, nome, genero: 'f', tipo: 'capital', categoria: 'povoado', reino: r.id, x: c.x, y: c.y, bioma: bioma[c.i], cultura: r.cultura.id, porto: distMar[c.i] <= 1 });
    const n = Math.max(2, Math.min(6, Math.round(r.tamanho / 110)));
    const cand = r.celulas.filter((i) => bioma[i] !== 'geleira');
    let portos = distMar[c.i] <= 1 ? 1 : 0;
    for (let k = 0, t = 0; k < n && t < 1500; t++) {
      const i = rng.weighted(cand, pontua), p = xy(i);
      if (!livre(p, 7)) continue;
      const b = bioma[i];
      let tipo;
      if (distMar[i] <= 1 && portos < 2 && rng.chance(0.7)) { tipo = 'porto'; portos++; }
      else if ((b === 'montanha' || b === 'colinas') && rng.chance(0.4)) tipo = rng.chance(0.5) ? 'forte' : 'mosteiro';
      else tipo = k === 0 ? 'cidade' : rng.pick(['vila', 'vila', 'aldeia', 'cidade']);
      const base = nomeUnico(r.cultura.lugares);
      const nomeP = tipo === 'porto' ? `Porto de ${base}` : tipo === 'forte' ? `Forte ${base}` : tipo === 'mosteiro' ? `Mosteiro de ${base}` : base;
      novoLugar({ id: idLugar(nomeP), nome: nomeP, genero: TIPOS_POVOADO[tipo].genero, tipo, categoria: 'povoado', reino: r.id, x: p.x, y: p.y, bioma: b, cultura: r.cultura.id, porto: distMar[i] <= 1 });
      k++;
    }
  }
  // Terras selvagens e ilhas: um acampamento ou refúgio, às vezes.
  for (const r of reinos.filter((x) => x.selvagem)) {
    if (!rng.chance(r.ilhas ? 0.8 : 0.6)) continue;
    const i = rng.pick(r.celulas), p = xy(i);
    if (!livre(p, 6)) continue;
    const nome = nomeUnico([], () => (r.ilhas ? `Refúgio ${rng.pick(COMPLEMENTOS)}` : `Acampamento ${rng.pick(COMPLEMENTOS)}`));
    novoLugar({ id: idLugar(nome), nome, genero: 'm', tipo: r.ilhas ? 'refugio' : 'acampamento', categoria: 'povoado', reino: r.id, x: p.x, y: p.y, bioma: bioma[i], cultura: null, porto: distMar[i] <= 1 });
  }

  // ---------- 7. Lugares de natureza, ruína e masmorra ----------
  const nomeLugar = (base, genero, plural) => {
    if (rng.chance(0.55)) return `${base} ${rng.pick(COMPLEMENTOS)}`;
    const a = rng.pick(ADJETIVOS); let adj = genero === 'f' ? a[1] : a[0];
    if (plural) adj = adj.endsWith('e') ? `${adj}s` : `${adj}s`;
    return `${base} ${adj}`;
  };
  const alvo = Math.round(terra.length / 28);
  for (let t = 0, n = 0; n < alvo && t < alvo * 40; t++) {
    const i = rng.pick(terra), p = xy(i), b = bioma[i];
    const opcoes = LUGARES_BIOMA[b]; if (!opcoes || !livre(p, 3.5)) continue;
    const [tipo, base, genero, categoria, plural] = rng.pick(opcoes);
    const nome = nomeUnico([], () => nomeLugar(base, genero, plural));
    const r = reinos.find((x) => x.k === dono[i]);
    novoLugar({ id: idLugar(nome), nome, genero, plural: !!plural, tipo, categoria, reino: r?.id || null, x: p.x, y: p.y, bioma: b, porto: false });
    n++;
  }
  // Ilhas pequenas sem nada ganham um lugar; o mar aberto ganha naufrágios e recifes.
  for (const m of massas.filter((x) => x.tipo === 'ilha' && x.tamanho >= 2)) {
    const cel = terra.filter((i) => massa[i] === m.id); if (!cel.length) continue;
    const i = rng.pick(cel), p = xy(i);
    if (!livre(p, 3)) continue;
    const [tipo, base, genero, categoria] = rng.pick(LUGARES_MAR);
    const nome = nomeUnico([], () => nomeLugar(base, genero, false));
    novoLugar({ id: idLugar(nome), nome, genero, tipo, categoria, reino: reinos.find((x) => x.k === dono[i])?.id || null, x: p.x, y: p.y, bioma: bioma[i], porto: false, ilha: true });
  }

  // ---------- 8. Rotas ----------
  const linhaCusto = (a, b) => { // custo e travessia de mar ao longo da linha reta
    const n = Math.ceil(dist(a, b)) + 1; let c = 0, mar = false, montanha = 0;
    for (let s = 0; s <= n; s++) {
      const x = Math.round(a.x + ((b.x - a.x) * s) / n), y = Math.round(a.y + ((b.y - a.y) * s) / n), bb = bioma[idx(x, y)];
      if (bb === 'mar') mar = true; c += CUSTO[bb] || 2; if (bb === 'montanha' || bb === 'geleira') montanha++;
    }
    return { custo: c, mar, montanha: montanha / (n + 1) };
  };
  const rotas = [], chave = new Set();
  const addRota = (a, b, tipo) => {
    const k = [a.id, b.id].sort().join('|'); if (chave.has(k) || a === b) return false;
    chave.add(k);
    const d = dist(a, b), tempo = tipo === 'mar' ? Math.max(1, Math.ceil(d / 12)) : tipo === 'magia' ? 0 : Math.max(1, Math.ceil(d / (tipo === 'estrada' ? 7 : 5)));
    rotas.push({ de: a.id, para: b.id, tipo, tempo });
    return true;
  };
  const povoados = lugares.filter((l) => l.categoria === 'povoado');
  // Estradas: árvore geradora mínima entre povoados de cada massa de terra + alguns atalhos.
  for (const m of massas) {
    const ps = povoados.filter((p) => massa[idx(p.x, p.y)] === m.id); if (ps.length < 2) continue;
    const dentro = [ps[0]], fora = ps.slice(1);
    while (fora.length) {
      let melhor = null;
      for (const a of dentro) for (const b of fora) { const lc = linhaCusto(a, b); const v = lc.custo + (lc.mar ? 999 : 0); if (!melhor || v < melhor.v) melhor = { a, b, v, lc }; }
      addRota(melhor.a, melhor.b, melhor.lc.montanha > 0.25 ? 'passo' : melhor.lc.custo / dist(melhor.a, melhor.b) > 1.8 ? 'trilha' : 'estrada');
      dentro.push(melhor.b); fora.splice(fora.indexOf(melhor.b), 1);
    }
    for (const a of ps) for (const b of ps) if (a !== b && dist(a, b) < 16 && rng.chance(0.25)) { const lc = linhaCusto(a, b); if (!lc.mar) addRota(a, b, lc.montanha > 0.25 ? 'passo' : 'estrada'); }
  }
  // Lugares: trilha até o povoado ou lugar mais próximo da mesma massa (por mar se não houver).
  for (const l of lugares.filter((x) => x.categoria !== 'povoado')) {
    const mm = massa[idx(l.x, l.y)];
    const mesmos = lugares.filter((o) => o !== l && massa[idx(o.x, o.y)] === mm && (o.categoria === 'povoado' || rotas.some((r) => r.de === o.id || r.para === o.id)));
    const perto = mesmos.sort((a, b) => dist(a, l) - dist(b, l))[0];
    if (perto) addRota(l, perto, linhaCusto(l, perto).montanha > 0.3 ? 'passo' : 'trilha');
    else l.semAcessoTerrestre = true;
  }
  // Portos: cada massa de terra precisa de um porto; portos se ligam pelo mar.
  for (const m of massas.filter((x) => x.tamanho >= 2)) {
    const ps = lugares.filter((l) => massa[idx(l.x, l.y)] === m.id);
    if (!ps.length) continue;
    if (!ps.some((l) => l.porto)) { const c = ps.filter((l) => distMar[idx(l.x, l.y)] <= 2).sort((a, b) => (a.categoria === 'povoado' ? -1 : 1))[0]; if (c) c.porto = true; }
  }
  const portos = lugares.filter((l) => l.porto);
  for (const p of portos) {
    const mm = massa[idx(p.x, p.y)];
    const outros = portos.filter((o) => massa[idx(o.x, o.y)] !== mm).sort((a, b) => dist(a, p) - dist(b, p));
    for (const o of outros.slice(0, p.categoria === 'povoado' ? 2 : 1)) if (dist(o, p) < 70) addRota(p, o, 'mar');
  }
  // Ilhas remotas sem porto alcançável: só por magia (dragão, barco voador, portal).
  const alcancavel = (inicio) => { const v = new Set([inicio]), f = [inicio]; while (f.length) { const a = f.pop(); for (const r of rotas) { const o = r.de === a ? r.para : r.para === a ? r.de : null; if (o && !v.has(o)) { v.add(o); f.push(o); } } } return v; };
  const base = alcancavel(povoados[0].id);
  for (const l of lugares) if (!base.has(l.id)) {
    const perto = [...base].map((id) => lugares.find((x) => x.id === id)).sort((a, b) => dist(a, l) - dist(b, l))[0];
    const remoto = dist(perto, l) > 45;
    addRota(l, perto, remoto ? 'magia' : 'mar');
    for (const id of alcancavel(l.id)) base.add(id);
  }

  // ---------- 9. Relações entre reinos vizinhos ----------
  const reais = reinos.filter((r) => !r.selvagem);
  const vizinhos = new Map(reais.map((r) => [r.k, new Set()]));
  for (let i = 0; i < W * H; i++) {
    if (dono[i] < 0 || !vizinhos.has(dono[i])) continue;
    const { x, y } = xy(i);
    for (const [dx, dy] of V4) { const nx = x + dx, ny = y + dy; if (nx >= W || ny >= H || nx < 0 || ny < 0) continue; const o = dono[idx(nx, ny)]; if (o >= 0 && o !== dono[i] && vizinhos.has(o)) vizinhos.get(dono[i]).add(o); }
  }
  const hostil = { orcs: 2, gigantes: 1 }, rivais = [['elfos', 'anoes'], ['orcs', 'anoes'], ['orcs', 'elfos'], ['orcs', 'humanos']];
  for (const r of reais) {
    r.relacoes = {};
    for (const k of vizinhos.get(r.k)) {
      const o = reinos[k], a = r.cultura.povo, b = o.cultura.povo;
      let tensao = rng.next() * 3 + (hostil[a] || 0) + (hostil[b] || 0) + (rivais.some(([p, q]) => (p === a && q === b) || (p === b && q === a)) ? 2 : 0) - (a === b ? 1 : 0);
      if (o.relacoes?.[r.id]) { r.relacoes[o.id] = o.relacoes[r.id]; continue; }
      r.relacoes[o.id] = RELACOES[Math.max(0, Math.min(RELACOES.length - 1, Math.round(tensao)))];
    }
  }

  return { reinos, lugares, rotas, dono };
}

export const slugify = slug;
