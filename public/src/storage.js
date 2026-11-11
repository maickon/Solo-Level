// Persistência local (localStorage, protegido por try/catch). Futuro: IndexedDB + sync Firestore.
import { SAVE_VERSION } from './engine/game.js';

const KEY = 'sololevel.save', MEMORIAL = 'sololevel.memorial', PREFS = 'sololevel.prefs';
const read = (k, d) => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; } };
const write = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch { return false; } };

export function loadSave() {
  const s = read(KEY, null);
  return s && s.versao === SAVE_VERSION && !s.morto ? s : null;
}
export const saveGame = (s) => write(KEY, s);
export const clearSave = () => { try { localStorage.removeItem(KEY); } catch { /* ignora */ } };

export const memorial = () => read(MEMORIAL, []);
export function addMemorial(entry) { write(MEMORIAL, [entry, ...memorial()].slice(0, 30)); }

// Preferências do jogador (som, narração, texto). Objetos aninhados são mesclados com o padrão.
export const PREFS_PADRAO = {
  audio: false,
  vol: { master: 0.8, ambiente: 0.7, musica: 0.55, efeitos: 0.8 },
  voz: { on: false, auto: true, opcoes: false, voz: '', taxa: 1, motor: 'navegador', neural: 'pt_BR-faber-medium' },
  animar: true,
  tutorial: false,
};
export function prefs() {
  const p = read(PREFS, {});
  return { ...PREFS_PADRAO, ...p, vol: { ...PREFS_PADRAO.vol, ...p.vol }, voz: { ...PREFS_PADRAO.voz, ...p.voz } };
}
export const setPrefs = (p) => write(PREFS, { ...prefs(), ...p });
