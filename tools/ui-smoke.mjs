// Teste de interface no navegador real (Chrome/Edge headless via DevTools Protocol, sem dependências).
// Requer o servidor rodando (npm run dev). Joga ~120 turnos clicando como um jogador, tira capturas
// (computador e celular) e falha se houver erro no console.  Uso: npm run ui [-- pasta-de-saida]
import { spawn } from 'node:child_process';
import { writeFileSync, mkdtempSync, mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const OUT = process.argv[2] || 'reports/ui';
mkdirSync(OUT, { recursive: true });
const BROWSER = process.env.CHROME || ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  '/usr/bin/google-chrome', '/usr/bin/chromium', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'].find((p) => existsSync(p));
if (!BROWSER) { console.log('Nenhum Chrome/Edge encontrado; defina CHROME=/caminho/do/navegador'); process.exit(1); }
const URL_JOGO = process.env.URL || 'http://127.0.0.1:5173/';
const chrome = spawn(BROWSER,
  ['--headless=new', '--remote-debugging-port=9333', `--user-data-dir=${mkdtempSync(join(tmpdir(), 'cdp-'))}`, '--window-size=1280,900', '--autoplay-policy=no-user-gesture-required', 'about:blank'], { stdio: 'ignore' });
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
let targets;
for (let i = 0; i < 40; i++) { try { targets = await (await fetch('http://127.0.0.1:9333/json/list')).json(); if (targets.length) break; } catch {} await wait(250); }
const page = targets.find((t) => t.type === 'page');
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((r) => (ws.onopen = r));
let id = 0; const pending = new Map(); const errors = [];
ws.onmessage = (m) => {
  const d = JSON.parse(m.data);
  if (d.id && pending.has(d.id)) { pending.get(d.id)(d.result); pending.delete(d.id); }
  if (d.method === 'Runtime.exceptionThrown') errors.push(d.params.exceptionDetails.exception?.description || d.params.exceptionDetails.text);
  if (d.method === 'Runtime.consoleAPICalled' && d.params.type === 'error') errors.push(d.params.args.map((a) => a.value || a.description).join(' '));
  if (d.method === 'Log.entryAdded' && d.params.entry.level === 'error') errors.push(d.params.entry.text + ' ' + (d.params.entry.url || ''));
};
const send = (method, params = {}) => new Promise((r) => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
const ev = async (expr) => (await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true })).result?.value;
const shot = async (name) => { await wait(1100); const r = await send('Page.captureScreenshot', { format: 'png' }); writeFileSync(join(OUT, name), Buffer.from(r.data, 'base64')); };

await send('Runtime.enable'); await send('Log.enable'); await send('Page.enable');
await send('Page.navigate', { url: URL_JOGO });
await wait(1500);
await shot('1-titulo.png');
await ev(`document.querySelector('[data-act="new"]').click()`); await wait(300);
await ev(`document.querySelectorAll('[data-classe]')[1].click()`); await wait(100);
await ev(`document.querySelector('[data-g="f"]').click()`); await wait(100);
await shot('2-criacao.png');
await ev(`document.querySelector('[data-act="start"]').click()`); await wait(500);
await shot('3a-tutorial.png');
const tut = await ev(`!!document.querySelector('.modal')`);
if (!tut) errors.push('tutorial não abriu');
await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
await wait(200);
if (await ev(`!!document.querySelector('.modal')`)) errors.push('Esc não fechou modal');
await ev(`document.querySelector('[data-act="audio"]').click()`); await wait(300);
await ev(`document.querySelector('[data-act="ajustes"]').click()`); await wait(300);
await ev(`(() => { const r=document.querySelector('[data-k="vol.musica"]'); r.value=30; r.dispatchEvent(new Event('input')); const c=document.querySelector('[data-k="voz.on"]'); if(c){c.checked=true;c.dispatchEvent(new Event('change'));} document.querySelector('[data-acao="testar-som"]').click(); })()`);
await wait(800);
await shot('3b-ajustes.png');
await ev(`document.querySelector('.modal [data-close]').click()`); await wait(200);
const before = await ev(`document.querySelector('.scene:not(.old)').innerText.length`);
await send('Input.dispatchKeyEvent', { type: 'keyDown', key: '1', code: 'Digit1', text: '1', windowsVirtualKeyCode: 49 });
await wait(400);
const kb = await ev(`document.querySelectorAll('.cartao.antigo').length`);
if (!kb) errors.push('atalho 1 não escolheu opção');
await shot('3-jogo.png');
const st = await ev(`JSON.stringify({audioOn: document.querySelector('[data-act="audio"]').innerText, prefs: JSON.parse(localStorage.getItem('sololevel.prefs'))})`);
console.log(st);
// Joga: prefere explorar/lutar; usa poção quando ferida.
let combatShot = false, marketShot = false, invShot = false;
for (let t = 0; t < 200; t++) {
  const info = await ev(`(() => { const b=[...document.querySelectorAll('.cartao.atual [data-opt]:not([disabled])')]; return { n:b.length, labels:b.map(x=>x.innerText), dead: !!document.querySelector('[data-act="again"]'), foe: !!document.querySelector('.inimigo') }; })()`);
  if (info.dead) { await shot('6-morte.png'); break; }
  if (info.foe && !combatShot) { combatShot = true; await shot('4-combate.png'); }
  if (!info.n) { errors.push('sem opções clicáveis'); break; }
  const labels = info.labels;
  let idx = labels.findIndex((l) => /^Visitar o mercado/.test(l));
  if (idx >= 0 && !marketShot) { await ev(`document.querySelectorAll('.cartao.atual [data-opt]:not([disabled])')[${idx}].click()`); await wait(150); await shot('5-mercado.png'); marketShot = true; continue; }
  if (t === 20 && !invShot) { await ev(`document.querySelector('#abas [data-tab="mochila"]').click()`); await wait(100); await shot('7-mochila.png'); invShot = true; }
  const wi = labels.findIndex((l) => /^Procurar trabalho/.test(l));
  if (wi >= 0 && !globalThis.workDone) {
    globalThis.workDone = true;
    await ev(`document.querySelectorAll('.cartao.atual [data-opt]:not([disabled])')[${wi}].click()`); await wait(150);
    await shot('10-trabalho.png');
    await ev(`document.querySelectorAll('.cartao.atual [data-opt]:not([disabled])')[0].click()`); await wait(150);
    continue;
  }
  if (t === 40) { await ev(`document.querySelector('#abas [data-tab="mapa"]').click()`); await wait(150); await shot('11-mapa.png'); }
  if (t === 41) { await ev(`document.querySelector('#abas [data-tab="jornada"]').click()`); await wait(150); await shot('12-jornada.png'); await ev(`document.querySelector('#abas [data-tab="mapa"]').click()`); }
  if (t > 41 && t % 3 === 0) {
    const mt = await ev(`(() => { const n=document.querySelectorAll('[data-maptravel]'); if(!n.length) return false; n[0].dispatchEvent(new MouseEvent('click',{bubbles:true})); return true; })()`);
    if (mt) { await wait(60); continue; }
  }
  // Desbrava fronteiras quando puder (para ver regiões novas no navegador) e fotografa as duas primeiras.
  const di = labels.findIndex((l) => /^Desbravar/.test(l));
  if (di >= 0 && (globalThis.regioesVistas || 0) < 2) {
    globalThis.regioesVistas = (globalThis.regioesVistas || 0) + 1;
    await ev(`document.querySelectorAll('.cartao.atual [data-opt]:not([disabled])')[${di}].click()`);
    await shot(`13-regiao-${globalThis.regioesVistas}.png`);
    continue;
  }
  const vi = labels.findIndex((l) => /^Viajar para/.test(l) && /inexplorado/.test(l));
  if (vi >= 0 && Math.random() < 0.5) { await ev(`document.querySelectorAll('.cartao.atual [data-opt]:not([disabled])')[${vi}].click()`); await wait(60); continue; }
  idx = Math.floor(Math.random() * info.n);
  if (t === 50) { await ev(`(()=>{const m=document.querySelector('.map'); if(!m) return; m.dispatchEvent(new WheelEvent('wheel',{deltaY:-100,clientX:m.getBoundingClientRect().left+50,clientY:m.getBoundingClientRect().top+50,bubbles:true,cancelable:true})); document.querySelector('[data-zoom="in"]')?.click();})()`); await wait(100); await shot('11b-mapa-zoom.png'); }
  if (labels.some((l) => /^Sair do mercado/.test(l))) idx = labels.findIndex((l) => /^Sair do mercado/.test(l));
  await ev(`document.querySelectorAll('.cartao.atual [data-opt]:not([disabled])')[${idx}].click()`);
  await wait(60);
  if (t === 30) { await ev(`document.querySelector('#abas [data-tab="mochila"]').click()`); await wait(100); await shot('7b-comparar.png'); }
}
await shot('8-final.png');
await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
await ev(`window.scrollTo(0,0)`); await wait(600);
await shot('9-mobile.png');
await ev(`document.querySelector('#navinf [data-tab="mapa"]')?.click()`); await wait(500);
await shot('9b-mobile-mapa.png');
const saved = await ev(`!!localStorage.getItem('sololevel.save') || !!localStorage.getItem('sololevel.memorial')`);
const unicos = [...new Set(errors)];
console.log(JSON.stringify({ errors: unicos, saved, capturas: OUT }, null, 1));
ws.close(); chrome.kill();
process.exit(unicos.length || !saved ? 1 : 0);
