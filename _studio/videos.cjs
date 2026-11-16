// VOID videos (frame-exact, 1920x1080, 30 fps).  node _studio/videos.cjs [name]   ·   node _studio/videos.cjs still <name> <t,t,…>
'use strict';
const fs = require('fs'), path = require('path'), { execFileSync } = require('child_process'), { open } = require('./cdp.cjs'), { LINE, HEAD, FIELD } = require('./lib.cjs');
const B = path.join(__dirname, '..', 'brand'), K = path.join(__dirname, 'kit'), FPS = 30, url = (f) => 'file:///' + f.split(path.sep).join('/');
// market caps: CoinGecko, 16 Nov 2026 (same figures as the kit graphics)
const CAPS = [['Chainlink', 'VRF', 6.98e9, '$6.98B'], ['Pyth', 'Entropy', 423.6e6, '$424M'], ['API3', 'QRNG', 30.9e6, '$30.9M'], ['Band', 'VRF', 26.9e6, '$26.9M']];
const VCSS = `body{font-size:36px}.s{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;opacity:0}
.h{font-size:124px;line-height:1}.cap{font-size:22px}.pl{border:1px solid rgba(226,214,250,.18);background:#0e0b16;padding:38px 42px;text-align:left;position:relative}
.rowv{display:grid;grid-template-columns:330px 1fr;gap:30px;text-align:left;font-size:34px;padding:20px 0;border-bottom:1px solid rgba(226,214,250,.14);align-items:baseline}.rowv:last-child{border:0}.rowv span:first-child{color:#948ba8}.rowv span:last-child{font-family:'Geist Mono',monospace;font-size:28px;word-break:break-all}
#zw{position:absolute;left:0;right:0;top:330px;text-align:center;opacity:0}#zl{position:absolute;left:0;right:0;top:640px;text-align:center;opacity:0}#zf{position:absolute;left:0;right:0;bottom:56px;text-align:center;opacity:0}`;
const JS = `const $=(i)=>document.getElementById(i),cl=(x)=>Math.max(0,Math.min(1,x)),e=(x)=>1-Math.pow(1-cl(x),3),win=(t,a,b,f=.45)=>cl(Math.min((t-a)/f,(b-t)/f));
const show=(id,t,a,b,f)=>{const o=win(t,a,b,f),el=$(id);el.style.opacity=o;el.style.filter='blur('+((1-o)*10).toFixed(1)+'px)';el.style.transform='translateY('+((1-o)*18).toFixed(1)+'px)';};
const HX='0123456789abcdef',hr=(n,s)=>{let x=s||1,o='';for(let i=0;i<n;i++){x=(x*16807)%2147483647;o+=HX[x%16]}return o};let G=null;
// end card: the disc opens in the field and the wordmark sits inside it
const end=(t,a,seed)=>{const z=t-a;if(z<0)return;field(G,{W:1920,H:1080,cx:960,cy:500,R:430*e(z/1.6),t:t,seed:seed,a:cl(z/.5)});['zw','zl','zf'].forEach((k,i)=>{const q=cl((z-.5-i*.25)/.7);$(k).style.opacity=q;$(k).style.filter='blur('+((1-q)*10).toFixed(1)+'px)';});};`;
const page = (name, body, line, seek, endAt) => HEAD(1920, 1080, VCSS) + body + `<div id="zw"><div class="h" style="font:600 250px/1 Archivo;font-stretch:118%;letter-spacing:.02em;color:#efeaf7">VOID</div></div><div id="zl" class="h" style="font-size:66px">${line}</div><div id="zf" class="cap">${LINE} · <b>$VOID</b></div>` + FIELD +
  `<script>${JS}window.__seek=(t)=>{G.clearRect(0,0,1920,1080);const bg=1-cl((t-${endAt}+.5)/.5);if(bg>0)field(G,{W:1920,H:1080,R:0,t:t,seed:'${name}',a:.3*bg,thr:.64});${seek}end(t,${endAt},'${name}-end');};fontsReady().then(()=>{G=cvInit().g;window.__seek(0);window.__ready=true;});</script></body></html>`;

const V = {
  // 1. where keys come from
  'void-hype-14s': [14, page('hype', `<div class="s" id="a"><div class="cap">where keys come from</div><div class="h" style="margin-top:30px">Every wallet starts<br>as <b>a random number.</b></div></div>
    <div class="s" id="b"><div class="cap">the usual source</div><div class="h" style="margin-top:30px">Most of them come<br>from <b>a formula.</b></div><div class="dim" style="font-size:40px;margin-top:40px">A formula can be replayed.</div></div>
    <div class="s" id="c"><div class="cap">the void source</div><div class="h" style="margin-top:30px">This one comes<br>from <b>a photon.</b></div><div class="dim" style="font-size:40px;margin-top:40px">A measurement cannot.</div></div>`,
    'Randomness, <b>out of the void.</b>', `show('a',t,0,3.2);show('b',t,3.2,6.5);show('c',t,6.5,9.7);`, 9.7)],

  // 2. one beacon round being built
  'void-round-14s': [14, page('round', `<div class="s" id="a"><div class="cap">the beacon</div><div class="h" style="margin-top:30px">Every ten seconds,<br><b>a new round.</b></div></div>
    <div class="s" id="b"><div class="pl" style="width:1500px;padding:14px 46px">${[['quantum bytes', 'q'], ['node value', 'n'], ['NIST pulse', 'i'], ['drand round', 'd'], ['output', 'o']].map(([k, id], i) => `<div class="rowv" id="r${i}" style="opacity:0"><span>${k}</span><span id="v${id}"></span></div>`).join('')}</div>
      <div id="chips" style="display:flex;gap:18px;margin-top:40px">${['signed', 'chained', 're-checkable'].map((x, i) => `<span class="cap" id="ch${i}" style="opacity:0;border:1px solid rgba(168,85,247,.8);color:#efeaf7;border-radius:999px;padding:14px 28px">✓ ${x}</span>`).join('')}</div></div>`,
    'A round is <b>a receipt.</b>', `show('a',t,0,2.6);show('b',t,2.6,10.2);for(let i=0;i<5;i++)$('r'+i).style.opacity=cl((t-3-i*.95)/.35);
    $('vq').textContent=hr(Math.floor(cl((t-3)/.9)*64),7919);$('vq').style.color='#c4b5fd';$('vn').textContent=t>3.95?hr(40,104729)+'…':'';$('vi').textContent=t>4.9?'#2,030,012 · '+hr(24,31337)+'…':'';$('vd').textContent=t>5.85?'#6,646,196 · '+hr(24,65537)+'…':'';
    const os=6.8;$('vo').textContent=t<os?'':t<os+1.1?hr(64,Math.floor(t*60)+11):hr(64,424243);$('vo').style.color=t<os+1.1?'#5d5478':'#fff';[0,1,2].forEach((i)=>{const q=cl((t-8.2-i*.4)/.3);$('ch'+i).style.opacity=q;$('ch'+i).style.transform='scale('+(1.3-.3*q).toFixed(2)+')';});`, 10.2)],

  // 3. what weak randomness has cost
  'void-price-13s': [13, page('price', `<div class="s" id="a"><div class="cap">three incidents</div><div class="h" style="margin-top:30px">Bad randomness<br><b>has a price.</b></div></div>
    <div class="s" id="b"><div class="pl" style="width:1560px;padding:10px 50px">${[['2013', 'Android SecureRandom', 'wallets emptied'], ['2022', 'Profanity', 'about $160M taken'], ['2023', 'Milk Sad', 'about $900K taken']].map(([y, a, c], i) => `<div id="r${i}" style="opacity:0;display:grid;grid-template-columns:230px 1fr auto;gap:40px;align-items:baseline;padding:34px 0;${i < 2 ? 'border-bottom:1px solid rgba(226,214,250,.14)' : ''};text-align:left"><span style="font:500 80px Archivo;font-stretch:112%;color:#e4dcf3">${y}</span><span style="font:500 52px Archivo">${a}</span><span class="mono hi" style="font-size:38px">${c}</span></div>`).join('')}</div>
      <div id="bl" class="dim" style="font-size:42px;margin-top:44px;opacity:0">Each one started from a number that could be guessed.</div></div>`,
    'Keys, <b>out of the void.</b>', `show('a',t,0,2.8);show('b',t,2.8,9.6);for(let i=0;i<3;i++){const q=cl((t-3.2-i*1.2)/.4);$('r'+i).style.opacity=q;$('r'+i).style.transform='translateY('+((1-q)*20)+'px)';}$('bl').style.opacity=cl((t-7.2)/.4);`, 9.6)],

  // 4. market caps of the networks that sell randomness, bars to scale
  'void-mcap-13s': [13, page('mcap', `<div class="s" id="a"><div class="cap">market cap · 16 nov 2026</div><div class="h" style="margin-top:30px">Randomness is<br><b>a $7 billion business.</b></div></div>
    <div class="s" id="b"><div style="width:1640px;text-align:left">${CAPS.map(([n, k, v, t], i) => `<div id="r${i}" style="opacity:0;display:grid;grid-template-columns:420px 1fr;align-items:center;padding:26px 0;border-top:1px solid rgba(226,214,250,.14)"><div><div style="font:500 52px/1.1 Archivo;font-stretch:112%">${n}</div><div class="cap" style="font-size:17px;margin-top:8px">${k}</div></div><div style="display:flex;align-items:center;gap:28px"><div id="w${i}" style="height:54px;width:0;background:linear-gradient(90deg,#6d28d9,#c084fc);box-shadow:0 0 44px rgba(168,85,247,.5)"></div><span class="mono" style="font-size:46px;color:#fff">${t}</span></div></div>`).join('')}
      <div id="r4" style="opacity:0;display:grid;grid-template-columns:420px 1fr;align-items:center;padding:26px 0;border-top:1px solid rgba(226,214,250,.14);border-bottom:1px solid rgba(226,214,250,.14)"><div><div style="font:500 52px/1.1 Archivo;font-stretch:112%;color:#c4b5fd">VOID</div><div class="cap" style="font-size:17px;margin-top:8px">quantum beacon</div></div><div style="display:flex;align-items:center;gap:28px"><div style="width:16px;height:16px;background:#fff;box-shadow:0 0 28px 8px rgba(168,85,247,.9)"></div><span class="mono lt" style="font-size:40px">day one</span></div></div></div></div>`,
    'VOID is <b>day one.</b>', `const W=${JSON.stringify(CAPS.map(([, , v]) => Math.max(8, (v / 6.98e9) * 940)))};show('a',t,0,2.8);show('b',t,2.8,9.6);for(let i=0;i<5;i++){const s0=3.2+i*.7;$('r'+i).style.opacity=cl((t-s0)/.35);if(i<4)$('w'+i).style.width=(W[i]*e((t-s0-.1)/1.2)).toFixed(1)+'px';}`, 9.6)],

  // 5. the key forge
  'void-forge-13s': [13, page('forge', `<div class="s" id="a"><div class="cap">key forge</div><div class="h" style="margin-top:30px">Keys the node<br><b>never sees.</b></div></div>
    <div class="s" id="b"><div style="display:grid;grid-template-columns:480px 90px 480px 90px 560px;align-items:stretch">${[['from the node', '64 bytes', 'Fresh quantum bytes, with a signed receipt.'], '+', ['from your device', '64 bytes', 'Your own generator. They never leave the page.'], '→', ['SHA3-512 of both', 'Your seed', 'Unknown to the node.', 1]].map((x, i) => (typeof x === 'string' ? `<div id="p${i}" style="opacity:0;display:grid;place-items:center;font:400 60px 'Geist Mono';color:#a855f7">${x}</div>` : `<div class="pl" id="p${i}" style="opacity:0;height:330px;${x[3] ? 'border-color:rgba(168,85,247,.8)' : ''}"><div class="cap">${x[3] ? '<b>' + x[0] + '</b>' : x[0]}</div><div style="font:500 64px Archivo;font-stretch:112%;margin:28px 0 16px">${x[1]}</div><div class="dim" style="font-size:30px;line-height:1.45">${x[2]}</div></div>`)).join('')}</div>
      <div style="display:flex;gap:16px;margin-top:50px">${['24 words', 'Ethereum', 'Solana', 'ML-DSA-65', 'ML-KEM-768'].map((x, i) => `<span class="cap" id="o${i}" style="opacity:0;border:1px solid rgba(226,214,250,.36);color:#efeaf7;border-radius:999px;padding:14px 26px">${x}</span>`).join('')}</div></div>`,
    'Forged <b>in your browser.</b>', `show('a',t,0,2.8);show('b',t,2.8,9.8);for(let i=0;i<5;i++){const q=cl((t-3.2-i*.6)/.4);$('p'+i).style.opacity=q;$('p'+i).style.transform='translateY('+((1-q)*22)+'px)';}for(let i=0;i<5;i++){const q=cl((t-6.8-i*.3)/.3);$('o'+i).style.opacity=q;}`, 9.8)],
};

async function render(c, name, dur, html) { const FR = path.join(__dirname, 'frames-' + name); fs.rmSync(FR, { recursive: true, force: true }); fs.mkdirSync(FR, { recursive: true });
  const f = path.join(K, name + '.html'); fs.writeFileSync(f, html); await c.load(url(f), 1920, 1080); if (!(await c.ev('window.__ready===true'))) throw new Error('page did not load: ' + name);
  const N = Math.round(dur * FPS); for (let i = 0; i < N; i++) { await c.ev('__seek(' + (i / FPS).toFixed(4) + ')'); await c.shot(path.join(FR, 'f_' + String(i).padStart(4, '0') + '.jpg'), 'jpeg'); }
  execFileSync('ffmpeg', ['-loglevel', 'error', '-y', '-framerate', String(FPS), '-i', path.join(FR, 'f_%04d.jpg'), '-vf', 'format=yuv420p', '-c:v', 'libx264', '-crf', '18', '-preset', 'slow', '-movflags', '+faststart', path.join(B, name + '.mp4')]);
  fs.rmSync(FR, { recursive: true, force: true }); console.log('OK', name + '.mp4'); }

(async () => {
  fs.mkdirSync(K, { recursive: true }); fs.mkdirSync(B, { recursive: true }); const c = await open('about:blank', 1920, 1080, 9382);
  try {
    if (process.argv[2] === 'still') { const name = Object.keys(V).find((n) => n.includes(process.argv[3])); const f = path.join(K, name + '.html'); fs.writeFileSync(f, V[name][1]); await c.load(url(f), 1920, 1080);
      for (const t of process.argv[4].split(',')) { await c.ev('__seek(' + t + ')'); await c.shot(path.join(K, 'still-' + name + '-' + t + '.jpg'), 'jpeg'); } console.log('stills', name); }
    else for (const n of Object.keys(V).filter((x) => !process.argv[2] || x.includes(process.argv[2]))) await render(c, n, V[n][0], V[n][1]);
  } finally { c.close(); }
})().catch((e) => { console.error(e); process.exit(1); });
