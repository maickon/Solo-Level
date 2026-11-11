// Ícones SVG em linha (traço, herdam a cor do texto). Sem dependências.
const P = {
  vida: '<path d="M12 20s-7-4.35-7-10a4 4 0 0 1 7-2.65A4 4 0 0 1 19 10c0 5.65-7 10-7 10z"/>',
  energia: '<path d="M13 3 5 14h6l-1 7 8-11h-6z"/>',
  exaustao: '<path d="M4 12h3l2-5 4 10 2-5h5"/>',
  sol: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  lua: '<path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z"/>',
  chuva: '<path d="M7 15a4 4 0 0 1 .5-8A5.5 5.5 0 0 1 18 8a3.5 3.5 0 0 1 0 7H7z"/><path d="M8 19l-1 2M12 19l-1 2M16 19l-1 2"/>',
  nevoa: '<path d="M4 9h16M2 13h20M5 17h14"/>',
  vento: '<path d="M3 9h11a3 3 0 1 0-3-3M3 15h15a3 3 0 1 1-3 3"/>',
  neve: '<path d="M12 3v18M4.2 7.5l15.6 9M4.2 16.5l15.6-9"/>',
  dia: '<rect x="4" y="5" width="16" height="16" rx="2"/><path d="M4 10h16M9 3v4M15 3v4"/>',
  ficha: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
  mochila: '<path d="M6 8a6 6 0 0 1 12 0v11a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2z"/><path d="M9 8V6a3 3 0 0 1 6 0v2M9 14h6"/>',
  mapa: '<path d="M9 4 3 6v14l6-2 6 2 6-2V4l-6 2z"/><path d="M9 4v14M15 6v14"/>',
  jornada: '<path d="M6 3h11a2 2 0 0 1 2 2v14l-3-2-3 2-3-2-3 2V5a2 2 0 0 0-2-2z"/><path d="M9 8h6M9 12h4"/>',
  diario: '<path d="M4 4h7a3 3 0 0 1 3 3v13a2 2 0 0 0-2-2H4z"/><path d="M20 4h-4a3 3 0 0 0-3 3"/><path d="M20 4v14h-6"/>',
  som: '<path d="M4 9v6h4l5 4V5L8 9z"/><path d="M16 9a4 4 0 0 1 0 6M19 6a8 8 0 0 1 0 12"/>',
  mudo: '<path d="M4 9v6h4l5 4V5L8 9z"/><path d="m17 9 5 6M22 9l-5 6"/>',
  ouvir: '<path d="M3 12a9 9 0 0 1 18 0v5a2 2 0 0 1-2 2h-2v-6h4M3 13h4v6H5a2 2 0 0 1-2-2z"/>',
  ajustes: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
  menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
  fechar: '<path d="M6 6l12 12M18 6 6 18"/>',
  dado: '<rect x="4" y="4" width="16" height="16" rx="3"/><circle cx="9" cy="9" r="1" fill="currentColor"/><circle cx="15" cy="15" r="1" fill="currentColor"/>',
  tempo: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  espada: '<path d="M14.5 17.5 3 6V3h3l11.5 11.5M13 19l6-6M16 16l4 4M19 21l2-2"/>',
  alvo: '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/>',
  ouro: '<circle cx="12" cy="12" r="8"/><path d="M12 8v8M9.5 10h4a1.5 1.5 0 0 1 0 3h-3a1.5 1.5 0 0 0 0 3h4"/>',
};
export const icone = (nome, cls = '') =>
  `<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${P[nome] || ''}</svg>`;

/** Faces do dado: posições (0–8) dos pontos numa grade 3×3. */
const FACES = { 1: [4], 2: [0, 8], 3: [0, 4, 8], 4: [0, 2, 6, 8], 5: [0, 2, 4, 6, 8], 6: [0, 2, 3, 5, 6, 8] };
export const dadoHtml = (n, anim = true) =>
  `<span class="dado ${anim ? 'rolando' : ''}">${Array.from({ length: 9 }, (_, i) => `<i style="${FACES[n]?.includes(i) ? 'visibility:visible' : ''}"></i>`).join('')}</span>`;
