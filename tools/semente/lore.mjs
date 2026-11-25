// Lore da Semente: nome do mundo, continentes e mares, panteão, linha do tempo (que cria ruínas famosas),
// facções, economia, Grande Crise, mistérios, descrições de reinos e lugares, pontos de partida.
import { markovName } from '../../public/src/engine/names.js';
import { sementes } from './politica.mjs';
import { CULTURAS, POVOS, DOMINIOS, DEUSES_RAIZ, MARCOS, CORES_EVENTO, FACCOES, NOMES_CULTO, CORES_FACCAO, NOMES_INQUISICAO,
  CRISES, PRODUTOS_BIOMA, OFICIOS_POVO, PLANOS, BIOMAS, TIPOS_POVOADO } from './tabelas.mjs';

const NOMES_MUNDO = ['Aerath', 'Valdoria', 'Eryndor', 'Thalmyr', 'Orvanis', 'Kaldheim', 'Sereth', 'Myrandal', 'Ostravia', 'Lumeris'];
const ADJ_MAR = ['das Brumas', 'de Ferro', 'das Tormentas', 'Esquecido', 'de Prata', 'dos Afogados', 'Partido', 'de Âmbar'];
const ADJ_CONT = ['', ' do Norte', ' do Sol', ' das Cinzas'];

// Gênero do nome de um reino pela primeira palavra do governo ("a Liga…", "o Reino…").
const FEM_GOV = /^(Liga|Confedera|Teocracia|Rep[uú]blica|Cidade|Horda|Corte|Federa|Oligarquia|Assembleia|Talassocracia|Forja-Reino|Ilhas|Terras|Areias|Selvas|Matas|Estepes)/;
const PLU_GOV = /^(Clãs|Ilhas|Terras|Areias|Selvas|Matas|Estepes|Ermos|Brejos|Picos)/;
/** Nome com artigo: "o Reino de X", "a Cripta do Corvo", "as Ruínas Sombrias". */
export function comArtigo(nome, genero, plural, prep = '') {
  const a = (genero === 'f' ? 'a' : 'o') + (plural ? 's' : '');
  const c = { '': a, de: `d${a}`, em: `n${a}`, a: genero === 'f' ? `à${plural ? 's' : ''}` : `ao${plural ? 's' : ''}` }[prep];
  return `${c} ${nome}`;
}
const artReino = (r, prep) => comArtigo(r.nome, FEM_GOV.test(r.nome) || FEM_GOV.test(r.governo || '') ? 'f' : 'm', PLU_GOV.test(r.nome), prep);
const artLugar = (l, prep) => (l.categoria === 'povoado' ? (prep === 'de' ? `de ${l.nome}` : prep === 'em' ? `em ${l.nome}` : l.nome) : comArtigo(l.nome, l.genero, l.plural, prep));

export function gerarLore(rng, geo, pol) {
  const { reinos, lugares, rotas } = pol;
  const reais = reinos.filter((r) => !r.selvagem);
  const porId = (id) => lugares.find((l) => l.id === id);
  const reinoDe = (id) => reinos.find((r) => r.id === id);

  // ---------- Mundo, continentes, mares ----------
  const mundoNome = markovName(rng, NOMES_MUNDO);
  const continentes = geo.massas.filter((m) => m.tipo === 'continente').map((m, k) => {
    const cel = []; for (let i = 0; i < geo.W * geo.H; i++) if (geo.massa[i] === m.id) cel.push(i);
    const cx = cel.reduce((a, c) => a + (c % geo.W), 0) / cel.length, cy = cel.reduce((a, c) => a + ((c / geo.W) | 0), 0) / cel.length;
    const reinosAqui = reais.filter((r) => geo.massa[geo.idx(r.capital.x, r.capital.y)] === m.id).map((r) => r.id);
    return { id: `continente_${k + 1}`, massa: m.id, nome: markovName(rng, NOMES_MUNDO) + ADJ_CONT[k % ADJ_CONT.length], centro: { x: Math.round(cx), y: Math.round(cy) }, tamanho: m.tamanho, reinos: reinosAqui };
  }).sort((a, b) => a.centro.x - b.centro.x);
  continentes.forEach((c, k) => { c.id = `continente_${k + 1}`; });
  const mares = [
    { id: 'mar_ocidental', nome: `Mar ${rng.pick(ADJ_MAR)}`, entre: [continentes[0]?.id, continentes[1]?.id] },
    { id: 'mar_oriental', nome: `Mar ${rng.pick(ADJ_MAR)}`, entre: [continentes[1]?.id, continentes[2]?.id] },
    { id: 'oceano_exterior', nome: `Oceano ${rng.pick(ADJ_MAR)}`, entre: [] },
  ];
  if (mares[0].nome === mares[1].nome) mares[1].nome = `Mar ${ADJ_MAR.find((a) => !mares[0].nome.includes(a))}`;

  // ---------- Panteão ----------
  const dominios = [...new Set(CULTURAS.map((c) => c.religiao))];
  const deusesUsados = new Set();
  const nomeDeus = () => { for (let t = 0; t < 40; t++) { const n = markovName(rng, DEUSES_RAIZ); if (!deusesUsados.has(n)) { deusesUsados.add(n); return n; } } return rng.pick(DEUSES_RAIZ); };
  const panteao = dominios.map((d) => ({ id: d, nome: nomeDeus(), dominio: DOMINIOS[d],
    cultos: CULTURAS.filter((c) => c.religiao === d).map((c) => c.id) }));
  const deusDe = (cul) => panteao.find((p) => p.id === cul.religiao);

  // ---------- Linha do tempo (alguns marcos batizam ruínas famosas) ----------
  const ruinas = lugares.filter((l) => l.categoria === 'ruina' || l.categoria === 'masmorra');
  const usadas = new Set();
  const ruinaFamosa = () => { const r = rng.pick(ruinas.filter((x) => !usadas.has(x.id))); if (r) usadas.add(r.id); return r; };
  const imperio = markovName(rng, sementes(CULTURAS.flatMap((c) => c.lugares)));
  const ordemSumida = `do ${rng.pick(['Véu', 'Cálice', 'Olho Aberto', 'Espinho', 'Lume'])}`;
  const marcosEscolhidos = ['era_antiga', 'imperio_caido', 'portais', ...rng.pick([['guerra', 'tratado'], ['guerra', 'peste']]), 'ordem_sumida', 'dragoes', 'cisma', 'fundacao'];
  const linhaDoTempo = marcosEscolhidos.map((id) => {
    const m = MARCOS.find((x) => x.id === id);
    const [A, B] = [rng.pick(reais), rng.pick(reais)];
    const R = m.ruina ? ruinaFamosa() : null;
    const povoAntigo = rng.pick(['Primeiros Homens', 'Gigantes', 'Elfos Antigos', 'Reis-Feiticeiros', 'Anões das Profundezas']);
    const Bk = B !== A ? B : reais.find((r) => r !== A);
    const cor = rng.pick(CORES_EVENTO);
    const txt = m.txt.replace('perto de {R}', R ? `perto ${artLugar(R, 'de')}` : 'perto de lugares esquecidos').replace('{P}', povoAntigo).replace('{X}', imperio).replace('{R}', R ? artLugar(R) : 'lugares hoje esquecidos')
      .replace('{A}', artReino(A)).replace('{B}', artReino(Bk)).replace('{N}', rng.pick(['Cem', 'Trinta', 'Sete']))
      .replace('Peste {C}', `Peste ${cor[1]}`).replace('Cisma {C}', `Cisma ${cor[0]}`)
      .replace('{L}', rng.pick(lugares.filter((l) => l.categoria === 'povoado')).nome)
      .replace('{O}', ordemSumida).replace('{G}', A.governo === 'Reino' ? 'rei' : 'soberano')
      .replace('Fundação de o ', 'Fundação do ').replace('Fundação de a ', 'Fundação da ').replace('fé de o ', 'fé do ').replace('fé de a ', 'fé da ')
      .replace('entre o ', 'entre o ');
    if (R) { R.historia = txt; R.fama = true; }
    return { marco: id, texto: txt, lugar: R?.id || null };
  });
  // Anos: marcos em ordem, terminando no ano 0 (início da era atual).
  let ano = 0;
  for (let k = linhaDoTempo.length - 1; k >= 0; k--) { linhaDoTempo[k].ano = ano; ano -= rng.int(120, 520); }
  const era = `Era ${rng.pick(['dos Portais', 'das Coroas Partidas', 'do Véu', 'das Cinzas', 'da Aurora'])}`;

  // ---------- Facções ----------
  const cidades = lugares.filter((l) => l.categoria === 'povoado' && ['capital', 'cidade', 'porto'].includes(l.tipo));
  const faccoes = FACCOES.map((f) => {
    const sede = rng.pick(cidades);
    const nome = f.nome.replace('{L}', sede.nome).replace('{X}', f.tipo === 'herdeiros' ? imperio : markovName(rng, sementes(CULTURAS.flatMap((c) => c.lugares))))
      .replace('{Y}', rng.pick(NOMES_CULTO)).replace('{Z}', rng.pick(CORES_FACCAO)).replace('{W}', rng.pick(NOMES_INQUISICAO));
    const atuacao = [...new Set([sede.reino, ...Array.from({ length: rng.int(1, 3) }, () => rng.pick(reais).id)])];
    return { id: f.tipo, nome, tipo: f.tipo, objetivo: f.objetivo, sede: sede.id, atuacao, nivel: 0 };
  });

  // ---------- Economia por reino ----------
  for (const r of reinos) {
    const cnt = {}; for (const c of r.celulas) { const b = geo.bioma[c]; cnt[b] = (cnt[b] || 0) + 1; }
    const doms = Object.entries(cnt).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([b]) => b);
    const produz = [...new Set(doms.flatMap((b) => (PRODUTOS_BIOMA[b] || []).slice(0, 2)).concat(r.cultura ? OFICIOS_POVO[r.cultura.povo].slice(0, 1) : []))].slice(0, 5);
    r.economia = { produz, precisa: [] };
  }
  for (const r of reais) {
    const todos = new Set(Object.values(PRODUTOS_BIOMA).flat());
    const faltam = [...todos].filter((p) => !r.economia.produz.includes(p));
    r.economia.precisa = Array.from({ length: 3 }, () => rng.pick(faltam)).filter((v, i, a) => a.indexOf(v) === i);
    r.economia.parceiros = reais.filter((o) => o !== r && o.economia.produz.some((p) => r.economia.precisa.includes(p))).map((o) => o.id).slice(0, 3);
  }

  // ---------- Grande Crise ----------
  const crise = rng.pick(CRISES);
  const candidatosOrigem = crise.origem.includes('mar') ? lugares.filter((l) => l.ilha || l.tipo === 'naufragio' || l.tipo === 'templo_submerso')
    : lugares.filter((l) => crise.origem.includes(l.categoria) && !usadas.has(l.id));
  const origem = rng.pick(candidatosOrigem.length ? candidatosOrigem : ruinas);
  const afetado = reinoDe(origem.reino) && !reinoDe(origem.reino).selvagem ? reinoDe(origem.reino) : rng.pick(reais);
  const pistas = [];
  for (const r of [...reais].sort(() => rng.next() - 0.5)) {
    if (pistas.length >= 4) break;
    const l = rng.pick(lugares.filter((x) => x.reino === r.id && (x.categoria === 'ruina' || x.categoria === 'masmorra') && x !== origem));
    if (l) { pistas.push(l.id); l.crise = true; }
  }
  origem.crise = true;
  const grandeCrise = { id: crise.id, nome: crise.nome, conceito: crise.conceito, origem: origem.id, reinoAfetado: afetado.id,
    atos: crise.atos.map((a, k) => ({ ato: k + 1, texto: a.replace('metade de {R}', `metade ${artReino(afetado, 'de')}`).replace('{R} se curva', `${artReino(afetado)} se curva`)
      .replace('cidades de {R}', `cidades ${artReino(afetado, 'de')}`).replace('portos de {R}', `portos ${artReino(afetado, 'de')}`)
      .replace('{R}', artReino(afetado)).replace('em {O}', artLugar(origem, 'em')).replace('{O}', artLugar(origem)) })), pistas, opcional: true };

  // ---------- Mistérios em aberto ----------
  const mist = [
    (() => { const rr = rng.pick(ruinas); return `Ninguém sabe por que ${artLugar(rr)} ${rr.plural ? 'aparecem' : 'aparece'} em mapas diferentes em lugares diferentes.`; })(),
    `Os ${POVOS[rng.pick(['anoes', 'elfos', 'gigantes'])].nome} guardam um nome que nunca dizem em voz alta.`,
    `Desde a queda do Império de ${imperio}, uma das sete coroas imperiais nunca foi encontrada.`,
    `Viajantes juram que existe uma ilha que só aparece em noites sem lua, além do ${mares[2].nome}.`,
    `A Ordem ${ordemSumida} deixou uma última mensagem gravada em pedra: “Não abram o que fechamos.”`,
    `Em ${rng.pick(lugares.filter((l) => ['capital', 'cidade', 'vila', 'aldeia'].includes(l.tipo))).nome}, os sinos tocam sozinhos uma vez por ano, sempre na mesma noite.`,
  ];
  const misterios = mist.map((t, k) => ({ id: `misterio_${k + 1}`, texto: t, resolvido: false }));

  // ---------- Descrições (conceitos de uma linha) ----------
  for (const r of reais) {
    const c = r.cultura, deus = deusDe(c);
    const rel = Object.entries(r.relacoes || {});
    const tensao = rel.find(([, v]) => ['guerra aberta', 'guerra fria', 'rivalidade'].includes(v));
    r.descricao = `${r.governo} ${c.adj[0] === c.adj[1] ? 'do povo ' + c.nome : c.adj[0]} de ${POVOS[c.povo].nome.toLowerCase()}, com ${c.arquitetura}. Valorizam ${c.valores.join(', ')} e cultuam ${deus.nome}, ${deus.dominio.toLowerCase()}.`;
    r.tensao = tensao ? `${tensao[1][0].toUpperCase() + tensao[1].slice(1)} com ${artReino(reinoDe(tensao[0]))}.` : rng.pick(['Paz frágil com os vizinhos.', 'Disputas internas pela sucessão.', 'Ameaçado por bandos vindos do ermo.', 'Rico, e por isso cobiçado.', 'Fronteiras tranquilas, por enquanto.']);
  }
  for (const r of reinos.filter((x) => x.selvagem)) {
    r.descricao = r.ilhas ? 'Ilhas sem rei, refúgio de piratas, exilados e coisas que preferem não ser vistas.'
      : `Território sem governo, ${BIOMAS[r.biomaDominante]?.nome.toLowerCase() || 'ermo'} onde só os corajosos ou desesperados vivem.`;
    r.tensao = 'Ninguém manda aqui; todos cobiçam.';
  }
  const conceitoPovoado = (l) => {
    const r = reinoDe(l.reino), cul = CULTURAS.find((c) => c.id === l.cultura);
    const ccs = {
      capital: `Capital de ${r?.raiz || 'um reino'}: ${cul?.arquitetura || 'construções antigas'}.`,
      cidade: `Cidade ${cul ? cul.adj[1] : ''} de comércio e intrigas, conhecida por ${rng.pick(r?.economia.produz || ['seus mercados'])}.`,
      vila: `Vila ${cul ? cul.adj[1] : ''} que vive de ${rng.pick(r?.economia.produz || ['sua terra'])}.`,
      aldeia: `Aldeia pequena e desconfiada de estranhos.`,
      porto: `Porto movimentado; navios para outras terras partem daqui.`,
      forte: `Fortaleza de fronteira que vigia ${rng.pick(['os passos', 'a estrada', 'os vizinhos', 'o ermo'])}.`,
      mosteiro: `Mosteiro isolado onde se guardam livros e segredos.`,
      acampamento: 'Acampamento de caçadores e foragidos no meio do ermo.',
      refugio: 'Refúgio de piratas e náufragos, sem lei e sem perguntas.',
    };
    return ccs[l.tipo] || 'Povoado.';
  };
  const CONCEITO_CAT = {
    natureza: ['Lugar de beleza perigosa.', 'Poucos passam por aqui sem um bom motivo.', 'Os locais evitam o lugar depois do anoitecer.', 'Um lugar que parece observar quem chega.'],
    ruina: ['Restos de algo que já foi grande.', 'Pedras com inscrições que ninguém mais lê.', 'Saqueadores vêm aqui; nem todos voltam.', 'Dizem que algo antigo ainda guarda o lugar.'],
    masmorra: ['Passagens que descem mais fundo do que deveriam.', 'Covil de algo que não gosta de visitas.', 'Tesouros e mortos dividem o mesmo escuro.', 'Quem entra ouve passos que não são os seus.'],
  };
  for (const l of lugares) {
    l.conceito = l.historia || (l.categoria === 'povoado' ? conceitoPovoado(l) : rng.pick(CONCEITO_CAT[l.categoria] || CONCEITO_CAT.natureza));
    const r = reinoDe(l.reino);
    l.perigo = Math.max(0, Math.min(5, (l.categoria === 'masmorra' ? 3 : l.categoria === 'ruina' ? 2 : l.categoria === 'natureza' ? 1 : 0)
      + (r?.selvagem || !r ? 1 : 0) + (['geleira', 'vulcanico', 'pantano', 'selva', 'montanha'].includes(l.bioma) ? 1 : 0) + (l.crise ? 1 : 0)));
  }

  // ---------- Planos (acesso por portais que ficarão em lugares sagrados/antigos) ----------
  const planos = PLANOS.slice(0, rng.int(5, 7)).map((p) => ({ ...p, nivel: 0, acesso: 'magia',
    portal: rng.pick(lugares.filter((l) => ['santuario', 'circulo', 'altar', 'templo', 'monolito'].includes(l.tipo)))?.id || null }));

  // ---------- Pontos de partida sugeridos ----------
  const grau = (id) => rotas.filter((r) => r.de === id || r.para === id).length;
  const candidatos = lugares.filter((l) => l.categoria === 'povoado' && ['cidade', 'vila', 'porto'].includes(l.tipo)
    && ['planicie', 'colinas', 'floresta', 'costa'].includes(l.bioma) && !Object.values(reinoDe(l.reino)?.relacoes || {}).includes('guerra aberta'))
    .map((l) => ({ l, s: grau(l.id) + (l.porto ? 1 : 0) + rng.next() })).sort((a, b) => b.s - a.s);
  const partida = [];
  for (const { l } of candidatos) { if (partida.length >= 3) break; if (partida.some((p) => p.reino === l.reino)) continue; partida.push(l); }
  const pontosDePartida = partida.map((l) => {
    const r = reinoDe(l.reino);
    const f = TIPOS_POVOADO[l.tipo].genero === 'f';
    return { lugar: l.id, nome: l.nome, reino: r.id, motivo: `${TIPOS_POVOADO[l.tipo].nome} bem ${f ? 'conectada' : 'conectado'} (${grau(l.id)} rotas)${l.porto && l.tipo !== 'porto' ? ', com porto' : ''}, em ${BIOMAS[l.bioma].nome.toLowerCase()}, ${artReino(r, 'em')}. ${r.tensao}` };
  });

  return {
    mundo: { nome: mundoNome, era, magia: 'A magia existe desde sempre, mas mudou com os portais: feitiços, relíquias, pactos e criaturas de outros planos são reais e perigosos. Magos são raros e temidos; poderes despertos aparecem em pessoas comuns.',
      linhaDoTempo, misterios, panteao, imperioCaido: imperio },
    continentes, mares, faccoes, grandeCrise, planos, pontosDePartida,
  };
}
