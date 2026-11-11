// Carrega, mescla e valida pacotes de conteúdo. Independente de ambiente:
// recebe `readJson(path)` (fetch no navegador, fs no Node).
import { tableRefs } from './grammar.js';
import { CONDITION_KEYS } from './conditions.js';
import { EFFECT_KEYS } from './rules.js';

export const START_LOCATION = 'vila_bruma';
export const REQUIRED_TABLES = ['local_desc', 'local_retorno', 'chegada', 'viagem_sem_evento',
  'descanso_curto', 'acampamento', 'estalagem', 'emboscada', 'combate_inicio', 'ataque_acerto',
  'ataque_parcial', 'ataque_falha', 'vitoria', 'fuga_sucesso', 'fuga_falha', 'negociar_sucesso',
  'negociar_falha', 'epitafio', 'subir_nivel', 'item_encontrado', 'novo_dia', 'ataque_critico',
  'ataque_desastre', 'poi_descoberta', 'trabalho_intro', 'missao_entregue', 'missao_investigar_sucesso',
  'missao_investigar_parcial', 'missao_investigar_falha'];
const ARRAY_FILES = ['classes', 'traits', 'biomes', 'locations', 'enemies', 'events', 'threads', 'pois', 'quests'];
export const EVENT_TYPES = ['exploracao', 'viagem', 'fio', 'cadeia'];

function mergeById(a = [], b = []) {
  const map = new Map(a.map((x) => [x.id, x]));
  for (const x of b) map.set(x.id, x);
  return [...map.values()];
}
function mergeLists(a = {}, b = {}) {
  const out = { ...a };
  for (const [k, v] of Object.entries(b)) out[k] = [...(out[k] || []), ...v];
  return out;
}

export async function loadContent(readJson) {
  const packs = await readJson('index.json');
  const raw = { items: { raridades: [], bases: [], qualidades: [], afixos: [] }, grammar: {}, names: {},
    npcs: { oficios: [], temperamentos: [] } };
  ARRAY_FILES.forEach((f) => (raw[f] = []));
  const manifests = [];
  for (const id of packs) {
    const man = await readJson(`${id}/manifest.json`);
    manifests.push(man);
    for (const f of man.arquivos) {
      const data = await readJson(`${id}/${f}.json`);
      if (ARRAY_FILES.includes(f)) raw[f] = mergeById(raw[f], data);
      else if (f === 'items') {
        raw.items.raridades = mergeById(raw.items.raridades, data.raridades);
        raw.items.bases = mergeById(raw.items.bases, data.bases);
        raw.items.qualidades.push(...(data.qualidades || []));
        raw.items.afixos.push(...(data.afixos || []));
      } else if (f === 'npcs') {
        raw.npcs.oficios = mergeById(raw.npcs.oficios, data.oficios);
        raw.npcs.temperamentos = mergeById(raw.npcs.temperamentos, data.temperamentos);
      } else if (f === 'grammar' || f === 'names') raw[f] = mergeLists(raw[f], data);
    }
  }
  return buildContent(raw, manifests);
}

export function buildContent(raw, manifests = []) {
  const byId = (arr) => Object.fromEntries((arr || []).map((x) => [x.id, x]));
  const c = {
    manifests,
    classes: raw.classes || [],
    traits: byId(raw.traits),
    biomes: byId(raw.biomes),
    locations: byId(raw.locations),
    enemies: byId(raw.enemies),
    events: raw.events || [],
    eventMap: byId(raw.events),
    threads: byId(raw.threads),
    items: raw.items,
    grammar: raw.grammar || {},
    names: raw.names || {},
    npcs: { oficios: raw.npcs?.oficios || [], temperamentos: raw.npcs?.temperamentos || [] },
    pois: raw.pois || [],
    quests: raw.quests || [],
  };
  // Locais dinâmicos (POIs) vivem no estado e têm prioridade.
  c.location = (s) => s.locais?.[s.local] || c.locations[s.local];
  c.biome = (s) => c.biomes[c.location(s)?.bioma] || { id: '?', perigo: 0 };
  return c;
}

/** Validação de integridade. Retorna { errors, warnings }. */
export function validate(c) {
  const errors = [], warnings = [];
  const err = (m) => errors.push(m), warn = (m) => warnings.push(m);
  const refsIn = (tpl, where) => {
    for (const r of tableRefs(tpl)) if (!c.grammar[r]) err(`${where}: tabela {${r}} não existe`);
  };

  for (const t of REQUIRED_TABLES) if (!c.grammar[t]?.length) err(`grammar: tabela obrigatória "${t}" ausente`);
  for (const [k, entries] of Object.entries(c.grammar)) {
    entries.forEach((e, i) => {
      const texts = typeof e === 'string' ? [e] : [e.t, e.m, e.f].filter(Boolean);
      if (!texts.length) err(`grammar.${k}[${i}]: entrada vazia`);
      texts.forEach((t) => refsIn(t, `grammar.${k}[${i}]`));
    });
  }

  if (!c.locations[START_LOCATION]) err(`locations: local inicial "${START_LOCATION}" ausente`);
  for (const l of Object.values(c.locations)) {
    if (!c.biomes[l.bioma]) err(`location ${l.id}: bioma "${l.bioma}" não existe`);
    for (const cx of l.conexoes || []) {
      const dest = c.locations[cx.para];
      if (!dest) err(`location ${l.id}: conexão para "${cx.para}" inexistente`);
      else if (!dest.conexoes?.some((d) => d.para === l.id)) warn(`location ${l.id} → ${cx.para}: conexão não recíproca`);
    }
    if (!l.conexoes?.length) warn(`location ${l.id}: sem conexões`);
    if (l.x == null || l.y == null) warn(`location ${l.id}: sem coordenadas x/y para o mapa`);
  }
  for (const b of Object.values(c.biomes)) {
    for (const e of b.inimigos || []) if (!c.enemies[e]) err(`biome ${b.id}: inimigo "${e}" não existe`);
  }
  const baseIds = new Set(c.items.bases.map((b) => b.id));
  const oficioIds = new Set(c.npcs.oficios.map((o) => o.id));
  const cenasAlvo = new Set();
  for (const cl of c.classes) {
    for (const it of cl.inicial || []) if (!baseIds.has(it.base)) err(`classe ${cl.id}: base "${it.base}" não existe`);
    for (const t of cl.tracos || []) if (!c.traits[t]) err(`classe ${cl.id}: traço "${t}" não existe`);
  }
  for (const b of c.items.bases) for (const e of b.efeitos || []) checkEffect(e, `item ${b.id}`);

  const checkReq = (req, where) => {
    for (const k of Object.keys(req || {})) if (!CONDITION_KEYS.includes(k)) err(`${where}: condição desconhecida "${k}"`);
  };
  function checkEffect(e, where) {
    for (const [k, v] of Object.entries(e)) {
      if (!EFFECT_KEYS.includes(k)) { err(`${where}: efeito desconhecido "${k}"`); continue; }
      if (k === 'combate' && !c.enemies[v]) err(`${where}: inimigo "${v}" não existe`);
      if ((k === 'fio' || k === 'resolver_fio') && !c.threads[v]) err(`${where}: fio "${v}" não existe`);
      if (k === 'traco' && !c.traits[v]) err(`${where}: traço "${v}" não existe`);
      if (k === 'item' && v.base && !baseIds.has(v.base)) err(`${where}: base "${v.base}" não existe`);
      if (k === 'diario') refsIn(v, where);
      if (k === 'cena') { if (!c.eventMap[v]) err(`${where}: cena "${v}" não existe`); else cenasAlvo.add(v); }
    }
  }
  const checkOutcome = (o, where) => {
    if (!o) return err(`${where}: saída ausente`);
    refsIn(o.texto || '', where);
    (o.efeitos || []).forEach((e) => checkEffect(e, where));
  };
  for (const ev of c.events) {
    const w = `event ${ev.id}`;
    if (!EVENT_TYPES.includes(ev.tipo)) err(`${w}: tipo inválido "${ev.tipo}"`);
    for (const o of ev.npc?.oficios || []) if (!oficioIds.has(o)) err(`${w}: ofício "${o}" não existe`);
    refsIn(ev.texto || '', w);
    checkReq(ev.requer, w);
    if (!ev.opcoes?.length) { err(`${w}: sem opções`); continue; }
    if (!ev.opcoes.some((o) => !o.requer)) err(`${w}: precisa de ao menos 1 opção sem "requer"`);
    ev.opcoes.forEach((o, i) => {
      const ow = `${w}.opcoes[${i}]`;
      refsIn(o.rotulo || '', ow);
      checkReq(o.requer, ow);
      if (o.teste) {
        ['sucesso', 'parcial', 'falha'].forEach((k) => checkOutcome(o[k], `${ow}.${k}`));
        ['critico', 'desastre'].forEach((k) => o[k] && checkOutcome(o[k], `${ow}.${k}`));
      }
      else checkOutcome(o.resultado, `${ow}.resultado`);
    });
  }
  for (const t of Object.values(c.threads)) {
    const ev = c.eventMap[t.evento];
    if (!ev) err(`thread ${t.id}: evento "${t.evento}" não existe`);
    else if (ev.tipo !== 'fio') err(`thread ${t.id}: evento "${t.evento}" deve ter tipo "fio"`);
    checkReq(t.requer, `thread ${t.id}`);
  }
  for (const ev of c.events) if (ev.tipo === 'cadeia' && !cenasAlvo.has(ev.id)) warn(`event ${ev.id}: cadeia inalcançável (nenhuma "cena" aponta para ele)`);
  for (const p of c.pois) {
    refsIn(p.nome || '', `poi ${p.id}`);
    for (const b of p.biomas || []) if (!c.biomes[b]) err(`poi ${p.id}: bioma "${b}" não existe`);
    const n = c.events.filter((e) => e.tipo === 'exploracao' && (e.requer?.local_tags || []).some((t) => p.tags?.includes(t))).length;
    if (n < 2) warn(`poi ${p.id}: só ${n} evento(s) de exploração com suas tags`);
  }
  for (const q of c.quests) {
    const w = `quest ${q.id}`;
    if (!['vencer', 'explorar', 'chegar'].includes(q.objetivo)) err(`${w}: objetivo inválido "${q.objetivo}"`);
    for (const o of q.oficios || []) if (!oficioIds.has(o)) err(`${w}: ofício "${o}" não existe`);
    ['titulo', 'pedido', 'conclusao'].forEach((k) => (q[k] ? refsIn(q[k], `${w}.${k}`) : err(`${w}: "${k}" ausente`)));
  }
  if (c.quests.length && !c.npcs.oficios.length) err('npcs: missões exigem ofícios em npcs.json');
  for (const k of ['pessoas', 'lugares', 'itens']) if ((c.names[k]?.length || 0) < 10) warn(`names.${k}: poucas sementes`);
  return { errors, warnings };
}
