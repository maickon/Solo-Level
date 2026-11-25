// Mundo autoral: converte a Semente do Mundo (exportada em public/data/mundo/) nos locais do motor.
// Cada lugar vira um local com bioma do jogo, tags (povoado, tipo, cultura), conexões pelas rotas e um
// estado de construção: só lugares jogáveis podem ser visitados; os demais aparecem no mapa, bloqueados.

// Tags por tipo de povoado (ligam estabelecimentos, atividades e textos já existentes).
const TAGS_POVOADO = {
  capital: ['seguro', 'estalagem', 'mercado', 'cidade', 'vila'],
  cidade: ['seguro', 'estalagem', 'mercado', 'cidade', 'vila'],
  vila: ['seguro', 'estalagem', 'mercado', 'vila'],
  aldeia: ['seguro', 'mercado', 'aldeia'],
  porto: ['seguro', 'estalagem', 'mercado', 'porto'],
  forte: ['seguro', 'castelo'],
  mosteiro: ['seguro', 'mosteiro', 'sagrado'],
  acampamento: ['acampamento', 'perigoso'],
  refugio: ['pirata', 'perigoso'],
};
const TAGS_POVO = { anoes: 'anao', halflings: 'halfling', elfos: 'elfica', orcs: 'orc', marinos: 'mar' };
// Tags por tipo de lugar (natureza, ruína, masmorra).
const TAGS_TIPO = {
  caverna: ['caverna', 'subterraneo'], mina: ['mina', 'subterraneo'], cripta: ['cripta', 'subterraneo', 'antigo'],
  tumulo: ['cripta', 'antigo'], tumba: ['cripta', 'antigo'], catacumbas: ['subterraneo', 'antigo'], gruta: ['caverna', 'subterraneo'],
  santuario: ['sagrado', 'antigo'], circulo: ['sagrado', 'antigo'], altar: ['sagrado', 'antigo'], templo: ['templo', 'sagrado', 'antigo'],
  monolito: ['antigo'], totem: ['antigo', 'totens'], ruina: ['ruinas', 'antigo'], cidade_enterrada: ['ruinas', 'antigo'],
  fortaleza: ['ruinas', 'antigo'], torre: ['torre', 'antigo'], farol: ['farol'], naufragio: ['naufragio'], oasis: ['oasis', 'agua'],
  lago: ['lago', 'agua'], rio: ['rio', 'agua'], cachoeira: ['agua'], piramide: ['templo', 'antigo'], forja: ['forja', 'antigo'],
  ninho: ['covil_fera', 'perigoso'], covil: ['covil_fera', 'perigoso'], labirinto: ['labirinto', 'antigo'], templo_submerso: ['afundado', 'antigo'],
};
// Motivo de bloqueio por tipo de rota (enquanto o destino não foi construído).
export const MOTIVO_BLOQUEIO = {
  estrada: 'a fronteira está fechada', trilha: 'a trilha está tomada pelo mato', passo: 'o passo está fechado pela neve',
  mar: 'nenhum barco faz essa rota ainda', magia: 'só por meios mágicos',
};

/** Converte a Semente exportada em { locations, inicio }. */
export function locaisDoMundo(mundo, biomasDoJogo) {
  const { indice, reinos } = mundo;
  const regiao = new Set(indice.regiaoInicial || []);
  const todos = [...reinos.flatMap((r) => r.lugares), ...indice.ermos];
  const povoDe = new Map(reinos.map((r) => [r.id, r.povo]));
  const mapaBioma = indice.biomaNoJogo || {};
  const locations = {};
  for (const l of todos) {
    const bioma = biomasDoJogo[mapaBioma[l.bioma]] ? mapaBioma[l.bioma] : biomasDoJogo[l.bioma] ? l.bioma : 'estrada';
    const tags = l.categoria === 'povoado' ? [...(TAGS_POVOADO[l.tipo] || ['seguro'])] : [...(TAGS_TIPO[l.tipo] || [])];
    const povo = TAGS_POVO[povoDe.get(l.reino)];
    if (povo && l.categoria === 'povoado') tags.push(povo);
    if (povo === 'orc' && l.categoria === 'povoado') tags.splice(tags.indexOf('seguro'), 1); // acampamentos orcs não são seguros
    if (l.categoria === 'masmorra') tags.push('perigoso');
    if (l.crise) tags.push('crise');
    if (l.ilha) tags.push('ilha');
    locations[l.id] = {
      id: l.id, nome: l.nome, genero: l.genero || 'm', artigo: l.categoria !== 'povoado', plural: !!l.plural,
      bioma, tags: [...new Set(tags)], conexoes: [], x: l.x, y: l.y,
      reino: l.reino, categoria: l.categoria, tipoLugar: l.tipo, nivel: l.nivel || 0, conceito: l.conceito,
      jogavel: (l.nivel || 0) >= 1 || regiao.has(l.reino), autoral: true,
      biblia: l.biblia || null, sublugares: l.sublugares || null,
    };
  }
  const rotas = [...reinos.flatMap((r) => r.rotas), ...indice.rotasEntreReinos];
  for (const r of rotas) {
    const a = locations[r.de], b = locations[r.para];
    if (!a || !b) continue;
    a.conexoes.push({ para: b.id, tempo: r.tempo, tipo: r.tipo });
    b.conexoes.push({ para: a.id, tempo: r.tempo, tipo: r.tipo });
  }
  return { locations, inicio: indice.partida };
}
