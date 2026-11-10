// Gerador procedural de itens: base + raridade + qualidade + afixos (+ nome próprio se lendário).
import { cap } from './grammar.js';
import { markovName } from './names.js';

const EQUIPAVEL = ['arma', 'armadura', 'amuleto'];
const tierOk = (x, tier) => (x.tier ?? 1) <= tier;

function rarityWeight(r, tier) {
  // Tiers altos favorecem raridades altas.
  const idx = r.afixos ?? 0;
  return r.peso * (1 + (tier - 1) * 0.35 * idx);
}

/**
 * opts: { tier, slot, base, raridade }
 * Retorna uma instância de item serializável.
 */
export function generateItem(content, rng, state, opts = {}) {
  const I = content.items;
  const tier = Math.max(1, opts.tier ?? 1);
  let base = opts.base && I.bases.find((b) => b.id === opts.base);
  if (!base) {
    const pool = I.bases.filter((b) => tierOk(b, tier) && (!opts.slot || b.slot === opts.slot));
    base = rng.weighted(pool.length ? pool : I.bases);
  }
  const equipavel = EQUIPAVEL.includes(base.slot);
  let rar = equipavel && opts.raridade && I.raridades.find((r) => r.id === opts.raridade);
  if (!rar) rar = equipavel ? rng.weighted(I.raridades, (r) => rarityWeight(r, tier)) : I.raridades[0];

  const mods = {};
  const addMods = (m) => { for (const [k, v] of Object.entries(m || {})) mods[k] = (mods[k] || 0) + v; };
  let qualidade = null;
  const afixos = [];
  if (equipavel) {
    const qs = I.qualidades.filter((q) => q.slots.includes(base.slot) && tierOk(q, tier));
    // Itens comuns às vezes vêm sem qualidade; raros sempre têm.
    if (qs.length && (rar.afixos > 0 || rng.chance(0.6))) {
      qualidade = rng.weighted(qs);
      addMods(qualidade.mods);
    }
    const as = I.afixos.filter((a) => a.slots.includes(base.slot) && tierOk(a, tier));
    for (let i = 0; i < (rar.afixos || 0) && as.length; i++) {
      const a = rng.weighted(as.filter((x) => !afixos.includes(x)));
      if (!a) break;
      afixos.push(a);
      addMods(a.mods);
    }
  }

  let nome = cap(base.nome);
  if (qualidade) nome += ' ' + (base.genero === 'f' ? qualidade.f : qualidade.m);
  // Só o primeiro afixo entra no nome; os demais aparecem nos atributos.
  if (afixos[0]) nome += ' ' + afixos[0].texto;
  if (rar.id === 'lendario') nome = `${markovName(rng, content.names.itens)}, ${nome}`;

  state.uid = (state.uid || 0) + 1;
  return {
    uid: state.uid,
    base: base.id,
    nome,
    genero: base.genero || 'm',
    slot: base.slot,
    raridade: rar.id,
    atributo: base.atributo || null,
    dano: base.dano || null,
    defesa: (base.defesa || 0),
    efeitos: base.efeitos || null,
    tags: [...(base.tags || [])],
    mods,
    valor: Math.max(1, Math.round((base.valor || 1) * (rar.mult || 1) + afixos.length * 5)),
  };
}

/** Descrição curta dos mods para a UI: "+1 força, +3 vida". */
const ROTULO = { forca: 'força', agilidade: 'agilidade', mente: 'mente', presenca: 'presença',
  dano: 'dano', defesa: 'defesa', hpMax: 'vida máx.', energiaMax: 'energia máx.' };
export function describeMods(item) {
  const parts = [];
  if (item.dano) parts.push(`dano ${item.dano}`);
  if (item.defesa) parts.push(`defesa ${item.defesa}`);
  for (const [k, v] of Object.entries(item.mods || {})) if (v) parts.push(`${v > 0 ? '+' : ''}${v} ${ROTULO[k] || k}`);
  for (const e of item.efeitos || []) {
    if (e.cura) parts.push(`cura ${e.cura}`);
    if (e.energia) parts.push(`energia +${e.energia}`);
  }
  return parts.join(', ');
}
