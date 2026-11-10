// Carrega pacotes de conteúdo via fs (Node) — usado por validador, testes e simulação.
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';
import { loadContent } from '../public/src/engine/content.js';

export const PACKS_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'data', 'packs');

export function loadNodeContent(dir = PACKS_DIR) {
  return loadContent(async (p) => JSON.parse(await readFile(join(dir, p), 'utf8')));
}
