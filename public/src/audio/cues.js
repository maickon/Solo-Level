// Traduz a mudança de cena em deixas sonoras. Puro (sem DOM/áudio): a UI compara a cena anterior
// com a atual e toca a sequência devolvida. As classes dos blocos são o contrato com o motor.

/** @returns {string[]} nomes de sons na ordem em que devem tocar. */
export function cuesFrom(prev, cur) {
  if (!prev || !cur) return [];
  const vistos = new Set(prev.blocos || []);
  const novos = (cur.blocos || []).filter((b) => !vistos.has(b));
  const out = [];
  if (cur.local && prev.local && cur.local !== prev.local) out.push('viagem');
  for (const b of novos) {
    const c = ` ${b.classe || ''} `;
    if (b.tipo === 'rolagem') {
      out.push('dado');
      const r = ['critico', 'desastre', 'sucesso', 'parcial', 'falha'].find((k) => c.includes(` ${k} `));
      if (r) out.push(r);
    } else if (b.tipo === 'nota') {
      if (c.includes(' golpe ')) out.push(c.includes(' critico ') ? 'golpe_critico' : 'golpe');
      else if (c.includes(' nivel ')) out.push('nivel');
      else if (c.includes(' vitoria ')) out.push('vitoria');
      else if (c.includes(' dano ') && c.includes(' vida ')) out.push('ferido');
      else if (c.includes(' cura ') && c.includes(' vida ')) out.push('cura');
      else if (c.includes(' ouro ')) out.push('ouro');
      else if (c.includes(' item ')) out.push(c.includes(' r-lendario ') ? 'item_lendario' : c.includes(' r-raro ') ? 'item_raro' : 'item');
      else if (c.includes(' fio ')) out.push('fio');
    }
  }
  if (cur.modo === 'morte' && prev.modo !== 'morte') out.push('morte');
  if (cur.modo === 'combate' && prev.modo !== 'combate') out.unshift('alerta');
  // Sem repetições seguidas e no máximo 7 sons por cena.
  return out.filter((n, i) => n !== out[i - 1]).slice(0, 7);
}
