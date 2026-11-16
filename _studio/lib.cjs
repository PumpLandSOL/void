// shared look for the VOID kit: page head, mark, footer and the seekable stipple field with its empty disc
'use strict';
// set these when the handle and the domain exist; every graphic footer, video end card and the X kit pick them up
const X = '', SITE = 'voidqaas.xyz', TICK = '$VOID';
const LINE = [SITE, X, 'quantum-as-a-service'].filter(Boolean).join(' · ');
const FONTS = `<link href="https://fonts.googleapis.com/css2?family=Archivo:wdth,wght@62..125,100..900&family=Geist+Mono:wght@400&display=swap" rel="stylesheet">`;
const MARK = (s = 40) => { let o = ''; for (let i = 0; i < 12; i++) { const a = (i / 12) * Math.PI * 2 - Math.PI / 2, r = i % 3 === 0 ? 1.5 : 1.1; o += `<rect x="${(12 + Math.cos(a) * 8.6 - r).toFixed(2)}" y="${(12 + Math.sin(a) * 8.6 - r).toFixed(2)}" width="${r * 2}" height="${r * 2}" fill="${i === 2 ? '#ffffff' : '#a855f7'}"/>`; } return `<svg width="${s}" height="${s}" viewBox="0 0 24 24">${o}</svg>`; };
const CSS = (W, H) => `*{margin:0;padding:0;box-sizing:border-box}
body{width:${W}px;height:${H}px;overflow:hidden;position:relative;background:#08060d;color:#efeaf7;font:400 26px/1.5 'Archivo',sans-serif;-webkit-font-smoothing:antialiased}
#cv{position:absolute;left:0;top:0;width:${W}px;height:${H}px}
.cap{font:400 16px 'Geist Mono',monospace;letter-spacing:.2em;text-transform:uppercase;color:#948ba8}.cap b{color:#a855f7;font-weight:400}
.h{font:500 100px/.98 'Archivo',sans-serif;font-stretch:118%;letter-spacing:-.03em;color:#e4dcf3}.h b{font-weight:500;color:#a855f7}
.mono{font-family:'Geist Mono',monospace}.dim{color:#948ba8}.hi{color:#a855f7}.lt{color:#c4b5fd}
.labels{display:flex;align-items:center;gap:16px}.labels span{font:400 14px 'Geist Mono',monospace;letter-spacing:.22em;text-transform:uppercase;color:#948ba8;white-space:nowrap}.labels i{flex:1;height:1px;background:rgba(226,214,250,.16)}
.fr{position:absolute;border:1px solid rgba(226,214,250,.16);background:#0e0b16}
.fr:before,.fr:after{content:'';position:absolute;width:12px;height:12px;border:1px solid #a855f7;pointer-events:none}.fr:before{left:-1px;top:-1px;border-right:0;border-bottom:0}.fr:after{right:-1px;bottom:-1px;border-left:0;border-top:0}
.kv{display:flex;justify-content:space-between;align-items:baseline;gap:30px;padding:17px 0;border-bottom:1px solid rgba(226,214,250,.14)}.kv:last-child{border:0}.kv span:first-child{color:#948ba8}.kv span:last-child{font-family:'Geist Mono',monospace;text-align:right}
.foot{position:absolute;left:70px;right:70px;bottom:44px;display:flex;justify-content:space-between;align-items:center}
.mk{display:flex;align-items:center;gap:14px;font:600 30px 'Archivo',sans-serif;font-stretch:118%;letter-spacing:.02em}.mk small{font:400 13px 'Geist Mono',monospace;letter-spacing:.22em;color:#948ba8}`;
const HEAD = (W, H, extra = '') => `<!doctype html><html><head><meta charset="utf-8">${FONTS}<style>${CSS(W, H)}${extra}</style></head><body><canvas id="cv"></canvas>`;
const FOOT = () => `<div class="foot"><span class="mk">${MARK(38)}VOID<small>PROTOCOL</small></span><span class="cap">${LINE} · <b>${TICK}</b></span></div>`;
// The field: the site's hero as a pure function of (seed, time). field(g, {W, H, cx, cy, R, t, seed, a, rim, fill})
//   R    radius of the empty disc (0 = no disc)      a    overall alpha
//   seed any string; the same seed always draws the same field      fill 0..1 how much of the canvas the noise covers
const FIELD = `<script>
window.field=function(g,o){const W=o.W,H=o.H,cx=o.cx==null?W/2:o.cx,cy=o.cy==null?H/2:o.cy,R=o.R||0,t=o.t||0,A=o.a==null?1:o.a,STEP=o.step||5,thr=o.thr==null?.57:o.thr;if(A<=0)return;
  if(!field.T||field.S!==o.seed){let h=2166136261;for(const c of String(o.seed||'void'))h=Math.imul(h^c.charCodeAt(0),16777619)>>>0;const rnd=()=>{h^=h<<13;h>>>=0;h^=h>>>17;h^=h<<5;h>>>=0;return h/4294967296;};const T=new Uint8Array(512);for(let i=0;i<256;i++)T[i]=i;for(let i=255;i>0;i--){const j=Math.floor(rnd()*(i+1));[T[i],T[j]]=[T[j],T[i]];}for(let i=0;i<256;i++)T[i+256]=T[i];field.T=T;field.S=o.seed;}
  const T=field.T,fade=(x)=>x*x*(3-2*x),lerp=(a,b,x)=>a+(b-a)*x,hv=(x,y)=>T[T[x&255]+(y&255)]/255,noise=(x,y)=>{const xi=Math.floor(x),yi=Math.floor(y),xf=x-xi,yf=y-yi;return lerp(lerp(hv(xi,yi),hv(xi+1,yi),fade(xf)),lerp(hv(xi,yi+1),hv(xi+1,yi+1),fade(xf)),fade(yf));};
  const x0=o.x0||0,x1=o.x1==null?W:o.x1,y0=o.y0||0,y1=o.y1==null?H:o.y1;
  for(let y=y0;y<y1;y+=STEP)for(let x=x0;x<x1;x+=STEP){const dist=R?Math.hypot(x-cx,(y-cy)*1.08)/R:9;if(dist<.9)continue;
    const n=noise(x/240+t*.04,y/240-t*.025)*.72+noise(x/66-t*.06,y/66)*.28,rim=R?Math.max(0,1-Math.abs(dist-1.02)/(o.rimW||.16))*(o.rim==null?1:o.rim):0,d=n-thr+rim*(o.rimGain==null?.34:o.rimGain),r=((Math.sin(x*12.9898+y*78.233)*43758.5453)%1+1)%1;
    if(d>0&&r<Math.min(.94,d*9)){g.globalAlpha=(.5+r*.5)*A;g.fillStyle=rim>.5&&r>.82?'#efeaf7':'#a855f7';const s=o.dot||2;g.fillRect(x+(r-.5)*4,y+(((r*7)%1)-.5)*4,s,s);}}
  g.globalAlpha=1;};
window.cvInit=function(){const cv=document.getElementById('cv'),W=cv.clientWidth,H=cv.clientHeight;cv.width=W;cv.height=H;return{g:cv.getContext('2d'),W,H};};
window.fontsReady=function(){return Promise.all([document.fonts.load('400 20px "Geist Mono"'),document.fonts.load('500 40px "Archivo"'),document.fonts.load('600 40px "Archivo"'),document.fonts.load('400 40px "Archivo"')]).then(()=>document.fonts.ready);};
</script>`;
module.exports = { X, SITE, LINE, TICK, FONTS, MARK, CSS, HEAD, FOOT, FIELD };
