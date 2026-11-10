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

export const prefs = () => read(PREFS, { audio: false });
export const setPrefs = (p) => write(PREFS, { ...prefs(), ...p });
