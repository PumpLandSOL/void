// VOID node. One process that
//   1. pulls real quantum random bytes from a photonic QRNG (and, with a key, a vacuum-fluctuation QRNG),
//   2. mixes them with the NIST Randomness Beacon, drand and the operating system's generator,
//   3. publishes a signed, hash-chained public beacon round every ROUND_SEC seconds, with every input revealed,
//   4. serves entropy, raw quantum bytes and provably fair draws over a small HTTP API,
//   5. serves the site (landing, console, key forge, docs).
// The rules a third party needs to re-check any of it live in client/voidlib.js, which this file imports too.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { roundOutput, roundMessage, commitOf, draw, shuffle, receiptMessage, health, ZERO, hex } from '../client/voidlib.js';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
// private settings can live in a git-ignored .env next to package.json; real environment variables win
try { for (const l of fs.readFileSync(path.join(ROOT, '.env'), 'utf8').split(/\r?\n/)) { const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/); if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2]; } } catch (e) {}

// ---------- PLACEHOLDERS: the only place the domain, the X handle and the repository are set (or use the env vars) ----------
const SITE_URL = (process.env.SITE_URL || 'http://localhost:8294').replace(/\/$/, '');
const X_URL = process.env.X_URL || 'https://x.com';
const GH_URL = process.env.GH_URL || '';
const TOKEN_CHAIN = process.env.TOKEN_CHAIN || 'Robinhood Chain';
const VOID_MINT = process.env.VOID_MINT || '';

const PORT = +(process.env.PORT || 8294);
const DATA_PATH = process.env.DATA_PATH || path.join(ROOT, 'data.json');
const ROUND_SEC = +(process.env.ROUND_SEC || 10);
const KEEP_ROUNDS = +(process.env.KEEP_ROUNDS || 3000);
const RESERVOIR_MAX = 32768, ROUND_Q = 32, MAX_BYTES = 1024, MAX_RAW = 64;
const BOOT = Date.now();
const sha3 = (alg, ...parts) => { const h = crypto.createHash(alg); for (const p of parts) h.update(p); return h.digest(); };

// ---------- state ----------
let db = { n: 0, last: ZERO, nextLocal: '', rounds: [], key: null, c: { quantumIn: 0, quantumBeacon: 0, quantumServed: 0, entropyReq: 0, entropyBytes: 0, rawReq: 0, draws: 0 } };
try { db = Object.assign(db, JSON.parse(fs.readFileSync(DATA_PATH, 'utf8'))); } catch (e) { try { db = Object.assign(db, JSON.parse(fs.readFileSync(DATA_PATH + '.bak', 'utf8'))); } catch (e2) {} }
// the node's signing key (ed25519). Made once, kept in the data file, never served.
if (!db.key) { const k = crypto.generateKeyPairSync('ed25519'); db.key = { priv: k.privateKey.export({ format: 'der', type: 'pkcs8' }).toString('base64'), pub: k.publicKey.export({ format: 'der', type: 'spki' }).subarray(12).toString('hex') }; }
const PRIV = crypto.createPrivateKey({ key: Buffer.from(db.key.priv, 'base64'), format: 'der', type: 'pkcs8' }), NODE_KEY = db.key.pub;
const sign = (msg) => crypto.sign(null, Buffer.from(msg), PRIV).toString('hex');
if (!db.nextLocal) db.nextLocal = crypto.randomBytes(32).toString('hex');
function saveNow() { try { fs.mkdirSync(path.dirname(DATA_PATH), { recursive: true }); const tmp = DATA_PATH + '.tmp'; fs.writeFileSync(tmp, JSON.stringify(db)); try { fs.copyFileSync(DATA_PATH, DATA_PATH + '.bak'); } catch (e) {} fs.renameSync(tmp, DATA_PATH); } catch (e) {} }

// ---------- the pool and the quantum reservoir ----------
// pool: 64 bytes of secret state. Everything the node receives is hashed into it; it never leaves the process.
let pool = sha3('sha3-512', crypto.randomBytes(64), Buffer.from(db.last, 'hex'));
const absorb = (tag, bytes) => { const t = Buffer.from(tag), l = Buffer.alloc(8); l.writeUInt32BE(t.length, 0); l.writeUInt32BE(bytes.length, 4); pool = sha3('sha3-512', pool, l, t, bytes); };
// reservoir: raw quantum bytes waiting to be used. A byte leaves it exactly once: into one beacon round or one API response.
const reservoir = []; let reservoirLen = 0; const recent = Buffer.alloc(4096); let recentLen = 0, recentPos = 0;
function deposit(src, buf) { absorb('q:' + src, buf); for (const b of buf) { recent[recentPos] = b; recentPos = (recentPos + 1) % recent.length; if (recentLen < recent.length) recentLen++; }
  db.c.quantumIn += buf.length; const room = RESERVOIR_MAX - reservoirLen; if (room <= 0) return; const keep = buf.subarray(0, room); reservoir.push({ src, buf: keep }); reservoirLen += keep.length; }
function take(n) { const parts = [], srcs = new Set(); while (n > 0 && reservoir.length) { const c = reservoir[0], k = Math.min(n, c.buf.length); parts.push(c.buf.subarray(0, k)); srcs.add(c.src); if (k === c.buf.length) reservoir.shift(); else c.buf = c.buf.subarray(k); n -= k; reservoirLen -= k; } return { bytes: Buffer.concat(parts), source: [...srcs] }; }

// ---------- sources ----------
const getJson = async (url, headers) => { const r = await fetch(url, { headers: Object.assign({ accept: 'application/json', 'user-agent': 'void-node/0.1' }, headers || {}), signal: AbortSignal.timeout(15000) }); if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); };
const isHex = (s, min) => typeof s === 'string' && s.length >= min && s.length % 2 === 0 && /^[0-9a-f]+$/i.test(s);
const SOURCES = {
  lfd: { name: 'LfD QRNG', kind: 'quantum', device: 'ID Quantique Quantis photonic QRNG', operator: 'OTH Regensburg, Laboratory for Digitalisation', url: 'https://lfdr.de/QRNG/', every: +(process.env.LFD_EVERY || 20),
    pull: async () => { const j = await getJson('https://lfdr.de/qrng_api/qrng?length=1024&format=HEX'); if (!isHex(j.qrn, 64)) throw new Error('bad payload'); deposit('lfd', Buffer.from(j.qrn, 'hex')); return j.qrn.length / 2; } },
  anu: { name: 'ANU QRNG', kind: 'quantum', device: 'vacuum fluctuations of the electromagnetic field', operator: 'Australian National University', url: 'https://quantumnumbers.anu.edu.au', every: +(process.env.ANU_EVERY || 600), needs: 'ANU_KEY',
    pull: async () => { const j = await getJson('https://api.quantumnumbers.anu.edu.au?length=1024&type=uint8', { 'x-api-key': process.env.ANU_KEY }); if (!j.success || !Array.isArray(j.data)) throw new Error('bad payload'); deposit('anu', Buffer.from(j.data)); return j.data.length; } },
  nist: { name: 'NIST Randomness Beacon', kind: 'beacon', device: 'signed 512-bit pulse every 60 seconds', operator: 'US National Institute of Standards and Technology', url: 'https://beacon.nist.gov/home', every: 30,
    pull: async () => { const p = (await getJson('https://beacon.nist.gov/beacon/2.0/pulse/last')).pulse; if (!isHex(p.outputValue, 128)) throw new Error('bad payload'); if (ext.nist && ext.nist.pulse === p.pulseIndex) return 0; ext.nist = { pulse: p.pulseIndex, value: p.outputValue.toLowerCase() }; absorb('nist', Buffer.from(p.outputValue, 'hex')); return 64; } },
  drand: { name: 'drand', kind: 'beacon', device: 'threshold BLS randomness from the League of Entropy', operator: 'League of Entropy', url: 'https://drand.love', every: 15,
    pull: async () => { const j = await getJson('https://api.drand.sh/public/latest'); if (!isHex(j.randomness, 64)) throw new Error('bad payload'); if (ext.drand && ext.drand.round === j.round) return 0; ext.drand = { round: j.round, randomness: j.randomness.toLowerCase() }; absorb('drand', Buffer.from(j.randomness, 'hex')); return 32; } },
};
const ext = { nist: null, drand: null };
const status = {}; for (const id in SOURCES) status[id] = { ok: false, enabled: !SOURCES[id].needs || !!process.env[SOURCES[id].needs], lastOk: 0, lastTry: 0, error: '', bytes: 0, pulls: 0, fails: 0 };
async function pull(id) { const s = status[id]; if (!s.enabled) return; s.lastTry = Date.now(); try { const n = await SOURCES[id].pull(); s.ok = true; s.lastOk = Date.now(); s.error = ''; s.bytes += n; s.pulls++; } catch (e) { s.ok = false; s.fails++; s.error = String(e.message || e).slice(0, 80); } }

// ---------- beacon ----------
const streams = new Set();
function makeRound() {
  const q = take(ROUND_Q), local = db.nextLocal, next = crypto.randomBytes(32).toString('hex');
  // a NIST pulse or drand round is mixed into one VOID round only; older than two minutes counts as stale and is left out
  const fresh = (s, id) => (s && status[id].lastOk > Date.now() - 120000 ? s : null);
  const r = { index: db.n, time: Date.now(), prev: db.last, quantum: { bytes: q.bytes.length, source: q.source, hex: q.bytes.toString('hex') }, local, nist: fresh(ext.nist, 'nist'), drand: fresh(ext.drand, 'drand'), commitNext: commitOf(next) };
  r.output = roundOutput(r); r.sig = sign(roundMessage(r));
  db.rounds.push(r); if (db.rounds.length > KEEP_ROUNDS) db.rounds.splice(0, db.rounds.length - KEEP_ROUNDS);
  db.n++; db.last = r.output; db.nextLocal = next; db.c.quantumBeacon += q.bytes.length;
  absorb('round', Buffer.concat([Buffer.from(r.output, 'hex'), crypto.randomBytes(32)]));
  const line = 'data: ' + JSON.stringify(r) + '\n\n'; for (const s of streams) { try { s.write(line); } catch (e) { streams.delete(s); } }
  if (r.index % 6 === 0) saveNow();
  return r;
}
const latest = () => db.rounds[db.rounds.length - 1] || null;
const roundAt = (i) => { const first = db.rounds.length ? db.rounds[0].index : 0; return db.rounds[i - first] || null; };

// ---------- http ----------
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json', '.map': 'application/json' };
const PAGES = { '/': 'index.html', '/console': 'console.html', '/forge': 'forge.html', '/docs': 'docs.html' };
const fill = (s) => s.replace(/\{\{SITE_URL\}\}/g, SITE_URL).replace(/\{\{X_URL\}\}/g, X_URL);
const json = (res, code, o) => { res.writeHead(code, { 'content-type': 'application/json', 'access-control-allow-origin': '*', 'cache-control': 'no-store' }); res.end(JSON.stringify(o)); };
// simple per-address rate limit: N requests a minute per bucket
const hits = new Map(); setInterval(() => hits.clear(), 60000).unref();
const limited = (req, bucket, max) => { const ip = String(req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').split(',')[0].trim(), k = bucket + '|' + ip, n = (hits.get(k) || 0) + 1; hits.set(k, n); return n > max; };
const intq = (q, k, d) => { const v = q.get(k); return v === null || v === '' ? d : Number(v); };

function stats() {
  const l = latest(), sample = recentLen === recent.length ? Buffer.concat([recent.subarray(recentPos), recent.subarray(0, recentPos)]) : recent.subarray(0, recentLen);
  return { version: '0.1.0', nodeKey: NODE_KEY, roundSec: ROUND_SEC, round: l ? l.index : -1, roundTime: l ? l.time : 0, nextRoundIn: l ? Math.max(0, ROUND_SEC - (Date.now() - l.time) / 1000) : ROUND_SEC, uptime: Math.round((Date.now() - BOOT) / 1000),
    reservoir: reservoirLen, reservoirMax: RESERVOIR_MAX, counters: db.c, health: health(sample),
    sources: Object.entries(SOURCES).map(([id, s]) => ({ id, name: s.name, kind: s.kind, device: s.device, operator: s.operator, url: s.url, every: s.every, ...status[id] })),
    token: { ticker: 'VOID', chain: TOKEN_CHAIN, mint: VOID_MINT } };
}

const server = http.createServer(async (req, res) => {
  const u = new URL(req.url, 'http://x'), p = u.pathname, q = u.searchParams;
  try {
    if (p === '/api/health') return json(res, 200, { ok: true, round: db.n - 1, reservoir: reservoirLen });
    if (p === '/api/config') return json(res, 200, { siteUrl: SITE_URL, xUrl: X_URL, ghUrl: GH_URL, nodeKey: NODE_KEY, roundSec: ROUND_SEC, token: { ticker: 'VOID', chain: TOKEN_CHAIN, mint: VOID_MINT }, limits: { entropyBytes: MAX_BYTES, rawBytes: MAX_RAW } });
    if (p === '/api/stats') return json(res, 200, stats());
    // ---- beacon ----
    if (p === '/api/beacon/latest') { const r = latest(); return r ? json(res, 200, r) : json(res, 503, { error: 'the first round is being produced' }); }
    if (p === '/api/beacon') { const n = Math.max(1, Math.min(100, intq(q, 'limit', 20) || 20)); return json(res, 200, { nodeKey: NODE_KEY, rounds: db.rounds.slice(-n).reverse() }); }
    if (p.startsWith('/api/beacon/')) { const i = Number(p.slice(12)); if (!Number.isInteger(i) || i < 0) return json(res, 400, { error: 'round must be a whole number' });
      if (i >= db.n) return json(res, 425, { error: 'round ' + i + ' has not been produced yet', eta: Math.ceil((i - db.n + 1) * ROUND_SEC) });
      const r = roundAt(i); return r ? json(res, 200, r) : json(res, 410, { error: 'this node keeps the latest ' + KEEP_ROUNDS + ' rounds; round ' + i + ' is older' }); }
    if (p === '/api/stream') { res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-store', connection: 'keep-alive', 'access-control-allow-origin': '*' }); const l = latest(); if (l) res.write('data: ' + JSON.stringify(l) + '\n\n'); streams.add(res); req.on('close', () => streams.delete(res)); return; }
    // ---- entropy: N bytes nobody else receives ----
    // HKDF-SHA-512 over ( fresh raw quantum bytes that are used once | the secret pool | 32 OS bytes ), salted with the latest beacon output.
    if (p === '/api/entropy') {
      if (limited(req, 'e', 120)) return json(res, 429, { error: 'rate limit: 120 requests a minute' });
      const n = intq(q, 'bytes', 32); if (!Number.isInteger(n) || n < 1 || n > MAX_BYTES) return json(res, 400, { error: 'bytes must be between 1 and ' + MAX_BYTES });
      const qb = take(Math.min(32, n)), id = crypto.randomBytes(16).toString('hex'), l = latest();
      const out = Buffer.from(crypto.hkdfSync('sha512', Buffer.concat([qb.bytes, pool, crypto.randomBytes(32)]), Buffer.from(db.last, 'hex'), 'VOID-ENTROPY-v1|' + id, n));
      absorb('req', Buffer.concat([Buffer.from(id, 'hex'), crypto.randomBytes(16)]));
      db.c.entropyReq++; db.c.entropyBytes += n; db.c.quantumServed += qb.bytes.length;
      const receipt = { id, time: Date.now(), round: l ? l.index : -1, bytes: n, quantumBytes: qb.bytes.length, digest: sha3('sha3-256', out).toString('hex') };
      return json(res, 200, { hex: out.toString('hex'), base64: out.toString('base64'), quantumSource: qb.source, receipt, sig: sign(receiptMessage(receipt)), nodeKey: NODE_KEY });
    }
    // ---- raw quantum bytes, exactly as the device produced them, delivered once ----
    if (p === '/api/quantum') {
      if (limited(req, 'q', 30)) return json(res, 429, { error: 'rate limit: 30 requests a minute' });
      const n = intq(q, 'bytes', 32); if (!Number.isInteger(n) || n < 1 || n > MAX_RAW) return json(res, 400, { error: 'bytes must be between 1 and ' + MAX_RAW });
      if (reservoirLen < n) return json(res, 503, { error: 'the reservoir is refilling, try again in a few seconds', reservoir: reservoirLen });
      const qb = take(n); db.c.rawReq++; db.c.quantumServed += qb.bytes.length;
      return json(res, 200, { hex: qb.bytes.toString('hex'), bytes: qb.bytes.length, source: qb.source, device: qb.source.map((s) => SOURCES[s].device), note: 'raw device output, removed from the reservoir on delivery' });
    }
    // ---- provably fair draws and shuffles from a beacon round and a caller-chosen seed ----
    if (p === '/api/draw' || p === '/api/shuffle') {
      const l = latest(); if (!l) return json(res, 503, { error: 'the first round is being produced' });
      const i = q.get('round') === null || q.get('round') === '' ? l.index : Number(q.get('round')), seed = String(q.get('seed') || '');
      if (!Number.isInteger(i) || i < 0) return json(res, 400, { error: 'round must be a whole number' }); if (seed.length > 200) return json(res, 400, { error: 'seed is limited to 200 characters' });
      if (i >= db.n) return json(res, 425, { error: 'round ' + i + ' has not been produced yet', eta: Math.ceil((i - db.n + 1) * ROUND_SEC), hint: 'commit to a future round and a seed, then ask again once it exists' });
      const r = roundAt(i); if (!r) return json(res, 410, { error: 'round ' + i + ' is older than this node keeps' });
      db.c.draws++;
      try { if (p === '/api/draw') { const min = intq(q, 'min', 1), max = intq(q, 'max', 6), count = intq(q, 'count', 1); return json(res, 200, { round: i, output: r.output, seed, min, max, count, values: draw(r.output, seed, min, max, count), rule: 'HMAC-SHA512(round output, "VOID-DRAW-v1|seed|i"), 48-bit chunks, rejection sampling' }); }
        const n = intq(q, 'n', 52); return json(res, 200, { round: i, output: r.output, seed, n, order: shuffle(r.output, seed, n), rule: 'Fisher-Yates over the same stream as /api/draw' });
      } catch (e) { return json(res, 400, { error: p === '/api/draw' ? 'need min ≤ max, a range of at most 2^32 and count from 1 to 1000' : 'n must be between 1 and 10000' }); }
    }
    if (p.startsWith('/api/')) return json(res, 404, { error: 'unknown endpoint' });
    // ---- site ----
    if (p.startsWith('/vendor/')) { const base = path.join(ROOT, 'node_modules'); let f = path.normalize(path.join(base, decodeURIComponent(p.slice(8)))); if (!f.startsWith(base + path.sep)) { res.writeHead(403); return res.end('no'); }
      // a bare import such as '@noble/hashes/sha3' arrives without an extension: redirect to the real file so each module loads once
      if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) { if (fs.existsSync(f + '.js')) { res.writeHead(302, { location: p + '.js' }); return res.end(); } res.writeHead(404); return res.end('not found'); }
      res.writeHead(200, { 'content-type': 'text/javascript', 'cache-control': 'public, max-age=86400' }); return fs.createReadStream(f).pipe(res); }
    const file = PAGES[p] || path.normalize(decodeURIComponent(p)).replace(/^[\\/]+/, ''), full = path.join(ROOT, 'client', file);
    if (!full.startsWith(path.join(ROOT, 'client') + path.sep) || !fs.existsSync(full) || fs.statSync(full).isDirectory()) { res.writeHead(404, { 'content-type': 'text/html; charset=utf-8' }); return res.end(fs.existsSync(path.join(ROOT, 'client', '404.html')) ? fs.readFileSync(path.join(ROOT, 'client', '404.html')) : 'not found'); }
    const ext2 = path.extname(full); res.writeHead(200, { 'content-type': MIME[ext2] || 'application/octet-stream', 'cache-control': 'no-cache' });
    return ext2 === '.html' ? res.end(fill(fs.readFileSync(full, 'utf8'))) : fs.createReadStream(full).pipe(res);
  } catch (e) { try { json(res, 500, { error: 'internal error' }); } catch (e2) {} }
});

let timers = [];
export async function start() {
  for (const id in SOURCES) { if (!status[id].enabled) continue; pull(id); timers.push(setInterval(() => pull(id), SOURCES[id].every * 1000)); }
  // the first round waits briefly for the first quantum bytes; after that rounds fall on a fixed cadence
  const first = Date.now(); while (reservoirLen < ROUND_Q && Date.now() - first < 8000) await new Promise((r) => setTimeout(r, 200));
  makeRound(); timers.push(setInterval(makeRound, ROUND_SEC * 1000));
  process.on('SIGTERM', () => { saveNow(); process.exit(0); });
  await new Promise((r) => server.listen(PORT, r));
  console.log('VOID node · :' + PORT + ' · round every ' + ROUND_SEC + 's · key ' + NODE_KEY.slice(0, 16) + '… · quantum sources: ' + Object.keys(SOURCES).filter((k) => SOURCES[k].kind === 'quantum' && status[k].enabled).join(', '));
  return server;
}
export function stop() { timers.forEach(clearInterval); timers = []; for (const s of streams) try { s.end(); } catch (e) {} saveNow(); return new Promise((r) => server.close(r)); }
export { NODE_KEY, saveNow, stats };
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) start();
