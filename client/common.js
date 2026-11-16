// shared pill nav, footer, CA bar, toasts, formatting
export const $ = (id) => document.getElementById(id);
export const api = (p) => fetch(p).then(async (r) => { const j = await r.json(); j.__status = r.status; return j; });
export const short = (h, n = 10) => (h ? h.slice(0, n) + '…' + h.slice(-8) : '');
export const num = (n) => Number(n).toLocaleString('en-US');
export const ago = (ts) => { const s = Math.max(0, (Date.now() - ts) / 1000); return s < 60 ? Math.floor(s) + 's ago' : s < 3600 ? Math.floor(s / 60) + 'm ago' : Math.floor(s / 3600) + 'h ago'; };
export function toast(m, err) { const t = document.createElement('div'); t.className = 'toast' + (err ? ' err' : ''); t.textContent = m; document.body.appendChild(t); setTimeout(() => t.remove(), 3600); }
export const copy = (v, what) => navigator.clipboard.writeText(v).then(() => toast((what || 'value') + ' copied'));
// the mark: a ring of stipple squares around an empty centre. The centre is the void; the dots are what comes out of it.
export const MARK = (s = 22) => { const pts = []; for (let i = 0; i < 12; i++) { const a = (i / 12) * Math.PI * 2 - Math.PI / 2; pts.push([12 + Math.cos(a) * 8.6, 12 + Math.sin(a) * 8.6, i % 3 === 0 ? 1.5 : 1.1]); }
  return `<svg width="${s}" height="${s}" viewBox="0 0 24 24" aria-hidden="true">${pts.map(([x, y, r], i) => `<rect x="${(x - r).toFixed(2)}" y="${(y - r).toFixed(2)}" width="${r * 2}" height="${r * 2}" fill="${i === 2 ? '#ffffff' : '#a855f7'}"/>`).join('')}</svg>`; };
export const LANDING = [['/#top', 'home'], ['/#problem', 'problem'], ['/#design', 'design'], ['/#beacon', 'beacon'], ['/#compare', 'compare'], ['/#roadmap', 'roadmap']];
export const APP = [['/', 'home'], ['/console', 'console'], ['/forge', 'key forge'], ['/docs', 'docs']];
const X_ICON = '<svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M18.9 1.2h3.7l-8 9.2 9.4 12.4h-7.4l-5.8-7.6-6.6 7.6H.5l8.6-9.8L.1 1.2h7.6l5.2 6.9 6-6.9Zm-1.3 19.4h2L6.5 3.3H4.3l13.3 17.3Z"/></svg>';
const GH_ICON = '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M12 .5a12 12 0 0 0-3.8 23.4c.6.1.8-.3.8-.6v-2.2c-3.3.7-4-1.4-4-1.4-.6-1.4-1.4-1.8-1.4-1.8-1.1-.7.1-.7.1-.7 1.2.1 1.8 1.2 1.8 1.2 1.1 1.8 2.8 1.3 3.5 1 .1-.8.4-1.3.8-1.6-2.7-.3-5.5-1.3-5.5-5.9 0-1.3.5-2.4 1.2-3.2-.1-.3-.5-1.5.1-3.2 0 0 1-.3 3.3 1.2a11.5 11.5 0 0 1 6 0c2.3-1.5 3.3-1.2 3.3-1.2.7 1.7.2 2.9.1 3.2.8.8 1.2 1.9 1.2 3.2 0 4.6-2.8 5.6-5.5 5.9.4.4.8 1.1.8 2.2v3.3c0 .3.2.7.8.6A12 12 0 0 0 12 .5Z"/></svg>';
let CFG = null; export const config = () => (CFG ? Promise.resolve(CFG) : api('/api/config').then((c) => (CFG = c)));
export function chrome(links = APP, cta = ['/console', 'open console ↗']) {
  const h = document.createElement('header'); h.className = 'nav';
  h.innerHTML = `<a class="logo" href="/">${MARK()}<span>VOID</span><small>PROTOCOL</small></a><nav>${links.map(([u, t]) => `<a href="${u}" class="${location.pathname === u ? 'on' : ''}">${t}</a>`).join('')}</nav><span id="navx"></span><a class="pbtn" href="${cta[0]}">${cta[1]}</a><button class="pbtn burger" aria-label="menu">menu</button>`;
  document.body.prepend(h); h.querySelector('.burger').onclick = () => h.classList.toggle('open'); h.querySelectorAll('nav a').forEach((a) => (a.onclick = () => h.classList.remove('open')));
  const f = document.createElement('footer'); f.className = 'foot';
  f.innerHTML = `<div class="wrap"><a class="logo" href="/">${MARK()}<span>VOID</span><small>PROTOCOL</small></a><p>VOID publishes a public randomness beacon and serves entropy seeded by a photonic quantum random number generator. Every beacon round can be re-checked in your browser. <span id="footx"></span></p></div>`;
  document.body.appendChild(f);
  config().then((c) => { const links2 = []; if (c.ghUrl) links2.push(`<a class="pbtn xbtn" href="${c.ghUrl}" target="_blank" rel="noopener" aria-label="VOID on GitHub">${GH_ICON}</a>`); links2.push(`<a class="pbtn xbtn" href="${c.xUrl}" target="_blank" rel="noopener" aria-label="VOID on X">${X_ICON}</a>`); $('navx').outerHTML = links2.join('');
    $('footx').innerHTML = (c.ghUrl ? `· <a href="${c.ghUrl}" target="_blank" rel="noopener">GitHub</a> ` : '') + `· <a href="${c.xUrl}" target="_blank" rel="noopener">X</a> · <a href="/docs">Docs</a>`; }).catch(() => {});
  return h;
}
export function caBar(el, token) { if (!el) return; const mint = token && token.mint; el.innerHTML = `<span class="cap">$VOID</span><code>${mint || 'launching on ' + (token && token.chain === 'Solana' ? 'pump.fun' : (token && token.chain) || 'chain')}</code>`; el.onclick = () => mint && copy(mint, '$VOID address'); }
