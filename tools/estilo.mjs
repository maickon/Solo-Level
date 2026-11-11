// Verificações de estilo sobre textos já gerados (usadas pela simulação). Não reprovam: só avisam.
import { radicais, radical } from '../public/src/engine/grammar.js';

// Limites de palavra cientes de acentos (\b do JS trata "ç"/"ã" como não-letra).
const L = 'a-zà-úç';
const CONTRACAO = new RegExp(`(?<![${L}])(de|em) (o|a|os|as)(?![${L}])`, 'i'); // "de o" → "do", "em a" → "na"
const ARTIGO_DUPLO = new RegExp(`(?<![${L}])a (a|o)(?![${L}])`, 'i');            // "a a", "a o"

/** Devolve avisos de estilo para um texto narrativo. */
export function estilo(texto) {
  const avisos = [];
  if (CONTRACAO.test(texto)) avisos.push(`contração ausente ("${texto.match(CONTRACAO)[0]}")`);
  if (ARTIGO_DUPLO.test(texto)) avisos.push(`artigo duplicado ("${texto.match(ARTIGO_DUPLO)[0]}")`);
  if (/\s[,.]|,,|\.\.(?!\.)/.test(texto)) avisos.push('pontuação');
  for (const frase of texto.split(/(?<=[.!?…])\s+/)) {
    const vistos = new Map();
    for (const w of frase.toLowerCase().match(/[a-zà-úç]{5,}/g) || []) {
      if (!radicais(w).size) continue;
      const r = radical(w);
      if (vistos.has(r) && vistos.get(r) !== w) { avisos.push(`palavra repetida na frase ("${vistos.get(r)}"/"${w}")`); break; }
      vistos.set(r, w);
    }
  }
  return avisos;
}
