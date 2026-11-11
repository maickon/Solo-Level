// Ficha do personagem: atributos efetivos, inventário e equipamento.
export const ATRIBUTOS = ['forca', 'agilidade', 'mente', 'presenca'];
export const SLOTS_EQUIP = ['arma', 'armadura', 'amuleto'];
export const LIMITE_INVENTARIO = 12;

export function hasItemTag(heroi, tag) {
  return heroi.inventario.some((i) => i.tags?.includes(tag));
}

export function equipped(heroi) {
  return SLOTS_EQUIP.map((s) => heroi.inventario.find((i) => i.uid === heroi.equipado[s])).filter(Boolean);
}

/** Soma de mods de itens equipados + traços. */
export function mods(heroi, content) {
  const total = {};
  const add = (m) => { for (const [k, v] of Object.entries(m || {})) total[k] = (total[k] || 0) + v; };
  equipped(heroi).forEach((i) => add(i.mods));
  heroi.tracos.forEach((t) => add(content.traits[t]?.mods));
  return total;
}

/** Valores derivados usados pela UI e pelas regras. */
export function stats(heroi, content) {
  const m = mods(heroi, content);
  const attrs = Object.fromEntries(ATRIBUTOS.map((a) => [a, (heroi.atributos[a] || 0) + (m[a] || 0)]));
  const arma = heroi.inventario.find((i) => i.uid === heroi.equipado.arma);
  const defesa = equipped(heroi).reduce((d, i) => d + (i.defesa || 0), 0) + (m.defesa || 0);
  return {
    attrs, defesa,
    hpMax: heroi.hpBase + (m.hpMax || 0),
    energiaMax: heroi.energiaBase + (m.energiaMax || 0),
    arma, danoBonus: m.dano || 0,
    penalidade: heroi.exaustao >= 5 ? 2 : heroi.exaustao >= 3 ? 1 : 0,
  };
}

/** Recalcula máximos e corrige valores atuais (chamar após equipar/traço). */
export function syncMax(heroi, content) {
  const s = stats(heroi, content);
  heroi.hpMax = Math.max(1, s.hpMax);
  heroi.energiaMax = Math.max(1, s.energiaMax);
  heroi.hp = Math.min(heroi.hp, heroi.hpMax);
  heroi.energia = Math.min(heroi.energia, heroi.energiaMax);
}

export function addItem(heroi, item) {
  if (heroi.inventario.length >= LIMITE_INVENTARIO) return false;
  heroi.inventario.push(item);
  return true;
}

export function removeItem(heroi, uid) {
  const idx = heroi.inventario.findIndex((i) => i.uid === uid);
  if (idx < 0) return null;
  for (const s of SLOTS_EQUIP) if (heroi.equipado[s] === uid) heroi.equipado[s] = null;
  return heroi.inventario.splice(idx, 1)[0];
}

export function equip(heroi, uid, content) {
  const item = heroi.inventario.find((i) => i.uid === uid);
  if (!item || !SLOTS_EQUIP.includes(item.slot)) return false;
  heroi.equipado[item.slot] = heroi.equipado[item.slot] === uid ? null : uid; // alterna
  syncMax(heroi, content);
  return true;
}

/** Média de uma expressão de dado simples ("1d6+1" → 4.5). */
export function mediaDado(expr) {
  const m = /^(\d*)d(\d+)([+-]\d+)?$/.exec(String(expr || '1d3').replace(/\s/g, ''));
  if (!m) return Number(expr) || 0;
  return (+m[1] || 1) * (+m[2] + 1) / 2 + (+m[3] || 0);
}

/**
 * Diferença de ficha se `item` fosse equipado no lugar do atual do mesmo slot.
 * Retorna { atual, deltas: [{ chave, delta }] (só valores ≠ 0), ataque: {antes, depois} | null } ou null.
 * `ataque` aparece quando a arma muda o atributo usado para atacar.
 */
export function compararEquip(heroi, content, item) {
  if (!SLOTS_EQUIP.includes(item?.slot)) return null;
  const atualUid = heroi.equipado[item.slot];
  const atual = heroi.inventario.find((i) => i.uid === atualUid) || null;
  if (atual?.uid === item.uid) return null;
  const resumo = (h) => {
    const s = stats(h, content), atk = s.arma?.atributo || 'forca';
    return { ...s.attrs, defesa: s.defesa, hpMax: s.hpMax, energiaMax: s.energiaMax,
      dano: mediaDado(s.arma?.dano || '1d3') + s.danoBonus, _atk: atk, _atkVal: s.attrs[atk] };
  };
  const antes = resumo(heroi);
  const inv = heroi.inventario.some((i) => i.uid === item.uid) ? heroi.inventario : [...heroi.inventario, item];
  const depois = resumo({ ...heroi, inventario: inv, equipado: { ...heroi.equipado, [item.slot]: item.uid } });
  const ataque = antes._atk !== depois._atk
    ? { antes: { atributo: antes._atk, valor: antes._atkVal }, depois: { atributo: depois._atk, valor: depois._atkVal } } : null;
  const deltas = Object.keys(antes).filter((k) => !k.startsWith('_')).map((k) => ({ chave: k, delta: Math.round((depois[k] - antes[k]) * 10) / 10 }))
    .filter((d) => d.delta !== 0);
  return { atual, deltas, ataque };
}
