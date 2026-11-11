// Verificações de estilo e semântica sobre textos já gerados (usadas pela simulação e pelo playtest).
// Não reprovam: só avisam. Cada aviso tem um código curto para agrupar no relatório.
import { radicais, radical } from '../public/src/engine/grammar.js';

// Limites de palavra cientes de acentos (\b do JS trata "ç"/"ã" como não-letra).
const L = 'a-zà-úç';
const CONTRACAO = new RegExp(`(?<![${L}])(de|em) (o|a|os|as)(?![${L}])`, 'i'); // "de o" → "do", "em a" → "na"
const ARTIGO_DUPLO = new RegExp(`(?<![${L}])a (a|o)(?![${L}])`, 'i');            // "a a", "a o"

// Adjetivos/particípios que costumam se referir ao herói logo depois de "você …".
const ADJ = ['cansad', 'ferid', 'exaust', 'molhad', 'encharcad', 'sozinh', 'aliviad', 'tont', 'sentad', 'inteir',
  'pront', 'perdid', 'suj', 'machucad', 'assustad', 'calad', 'atent', 'preparad', 'viv', 'sedent', 'faminto', 'famint',
  'esgotad', 'ofegant', 'satisfeit', 'grat', 'derrotad', 'curad', 'abatid', 'desarmad', 'cercad', 'acordad', 'deitad'];
// "você" (não "vocês") seguido do adjetivo na mesma oração, sem artigo/possessivo/substantivo antes dele.
const CONC = (fim) => new RegExp(`(?<![${L}])(você|Você)(?![${L}])(?:[^.!?;:,"“”]{0,30}?)(?<![${L}])(?<!(?:a|as|o|os|sua|suas|seu|seus|da|das|do|dos|na|nas|no|nos|de|um|uma) )(${ADJ.join('|')})${fim}(?![${L}])`);
const MASC = CONC('os?'), FEM = CONC('as?');

/** Devolve avisos { cod, msg } para um texto narrativo. ctx = { genero } do herói (opcional). */
export function estiloDetalhado(texto, ctx = {}) {
  const av = [];
  const add = (cod, msg) => av.push({ cod, msg });
  if (CONTRACAO.test(texto)) add('contracao', `contração ausente ("${texto.match(CONTRACAO)[0]}")`);
  if (ARTIGO_DUPLO.test(texto)) add('artigo', `artigo duplicado ("${texto.match(ARTIGO_DUPLO)[0]}")`);
  if (/\s[,.!?;:]|,,|[!?.]{2}(?<!\.\.)|\.\.(?!\.)/.test(texto)) add('pontuacao', 'pontuação estranha');
  if (/[.!?…]\s+[a-zà-ú]/.test(texto)) add('maiuscula', 'frase começando com minúscula');
  const abre = (texto.match(/“/g) || []).length, fecha = (texto.match(/”/g) || []).length;
  if (abre !== fecha) add('aspas', 'aspas desbalanceadas');
  if (ctx.genero === 'f' && MASC.test(texto)) add('genero', `herói feminino com forma masculina ("${texto.match(MASC)[0].split(' ').pop()}")`);
  if (ctx.genero === 'm' && FEM.test(texto)) add('genero', `herói masculino com forma feminina ("${texto.match(FEM)[0].split(' ').pop()}")`);
  const frases = texto.split(/(?<=[.!?…]["”»]?)\s+/);
  for (const frase of frases) {
    if ((frase.match(/\S+/g) || []).length > 45) add('longa', 'frase com mais de 45 palavras');
    const vistos = new Map();
    for (const w of frase.toLowerCase().match(/[a-zà-úç]{5,}/g) || []) {
      if (!radicais(w).size) continue;
      const r = radical(w);
      if (vistos.has(r) && vistos.get(r) !== w) { add('repeticao', `palavra repetida na frase ("${vistos.get(r)}"/"${w}")`); break; }
      vistos.set(r, w);
    }
  }
  const norm = frases.map((f) => f.trim().toLowerCase()).filter((f) => f.length > 12);
  if (new Set(norm).size < norm.length) add('frase_dupla', 'a mesma frase aparece duas vezes no texto');
  return av;
}

/** Compatível com a simulação: só as mensagens. */
export const estilo = (texto, ctx) => estiloDetalhado(texto, ctx).map((a) => a.msg);

/** Verificações sobre a cena inteira (blocos + opções). */
export function cenaDetalhada(cena, ctx = {}) {
  const av = [];
  const add = (cod, msg) => av.push({ cod, msg });
  const textos = cena.blocos.filter((b) => b.tipo === 'texto').map((b) => b.texto.trim());
  if (new Set(textos).size < textos.length) add('bloco_duplo', 'o mesmo parágrafo aparece duas vezes na cena');
  if (ctx.inicioEvento && /^(Ele|Ela|Eles|Elas)\s/.test(textos[0] || '')) add('pronome', `cena começa com pronome sem antecedente ("${textos[0].slice(0, 40)}…")`);
  const rot = cena.opcoes.map((o) => o.rotulo.trim().toLowerCase());
  if (new Set(rot).size < rot.length) add('opcao_dupla', `opções repetidas: ${cena.opcoes.map((o) => o.rotulo).join(' | ')}`);
  if (cena.opcoes.some((o) => !o.rotulo.trim())) add('opcao_vazia', 'opção sem rótulo');
  if (cena.modo !== 'morte' && cena.opcoes.length && cena.opcoes.every((o) => o.desativada)) add('beco', 'todas as opções desativadas');
  return av;
}
