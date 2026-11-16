// VOID tests: boots the node on a scratch data file with 1-second rounds, then checks the beacon rules, the API,
// the receipts, the one-time delivery of quantum bytes and the Key Forge against published wallet test vectors.
import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path';
const tmp = path.join(os.tmpdir(), 'void-test-' + Date.now() + '.json');
Object.assign(process.env, { PORT: '8395', DATA_PATH: tmp, ROUND_SEC: '1', LFD_EVERY: '5' });
const S = await import('../server/index.js');
const L = await import('../client/voidlib.js');
const F = await import('../client/forge-lib.js');
const B = 'http://127.0.0.1:8395';
let pass = 0, fail = 0, skip = 0;
const ok = (name, cond, extra) => { if (cond) { pass++; console.log('PASS', name); } else { fail++; console.log('FAIL', name, extra === undefined ? '' : JSON.stringify(extra).slice(0, 300)); } };
const skipT = (name, why) => { skip++; console.log('SKIP', name, '·', why); };
const get = async (u) => { const r = await fetch(B + u); const j = await r.json(); j.__status = r.status; return j; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

await S.start(); await sleep(4500);
// ---- pages ----
for (const p of ['/', '/console', '/forge', '/docs']) { const r = await fetch(B + p), t = await r.text(); ok('page ' + p + ' serves with no template tokens left', r.status === 200 && t.includes('VOID') && !/\{\{[A-Z_]+\}\}/.test(t)); }
ok('unknown page is a 404', (await fetch(B + '/nope')).status === 404);
ok('path traversal out of the site folder is blocked', (await fetch(B + '/..%2fserver/index.js')).status !== 200 && (await fetch(B + '/vendor/..%2f..%2fserver/index.js')).status !== 200);
ok('crypto libraries are served to the browser', (await fetch(B + '/vendor/@noble/hashes/esm/sha3.js')).status === 200 && (await fetch(B + '/vendor/@noble/post-quantum/node_modules/@noble/hashes/esm/_assert.js')).status === 200);
// ---- config and stats ----
const cfg = await get('/api/config'); ok('config: node key, 1-second rounds, limits', /^[0-9a-f]{64}$/.test(cfg.nodeKey) && cfg.roundSec === 1 && cfg.limits.entropyBytes === 1024, cfg);
const st = await get('/api/stats'); const lfd = st.sources.find((x) => x.id === 'lfd'), quantumLive = lfd && lfd.ok && lfd.bytes > 0;
ok('stats: sources listed with their kind', st.sources.length === 4 && st.sources.filter((x) => x.kind === 'quantum').length === 2 && st.sources.find((x) => x.id === 'anu').enabled === false);
// the node's private key must never be served
S.saveNow(); const privB64 = JSON.parse(fs.readFileSync(tmp, 'utf8')).key.priv;
let leak = 0; for (const u of ['/api/config', '/api/stats', '/api/beacon/latest', '/api/beacon?limit=5', '/']) if ((await (await fetch(B + u)).text()).includes(privB64)) leak++;
ok('node signing key and pool never appear in any response', leak === 0 && !JSON.stringify(st).includes('pool'));
// ---- beacon ----
const hist = (await get('/api/beacon?limit=6')).rounds.reverse();
ok('beacon produced several rounds', hist.length >= 3, hist.length);
ok('every round re-verifies: output, signature, chain link and the commitment made one round earlier', hist.slice(1).every((r, i) => L.verifyRound(r, cfg.nodeKey, hist[i]).ok), hist.slice(1).map((r, i) => L.verifyRound(r, cfg.nodeKey, hist[i]).checks.filter((c) => !c.ok)));
const r0 = hist[hist.length - 1];
ok('a tampered output is rejected', !L.verifyRound({ ...r0, output: r0.output.replace(/^../, r0.output.startsWith('00') ? 'ff' : '00') }, cfg.nodeKey).ok);
ok('a tampered quantum input is rejected', r0.quantum.hex.length < 2 || !L.verifyRound({ ...r0, quantum: { ...r0.quantum, hex: (r0.quantum.hex[0] === 'a' ? 'b' : 'a') + r0.quantum.hex.slice(1) } }, cfg.nodeKey).ok);
ok('a signature from another key is rejected', !L.verifyRound(r0, 'ab'.repeat(32)).ok);
ok('a swapped node value breaks the commitment', !L.verifyRound({ ...r0, local: 'cd'.repeat(32) }, cfg.nodeKey, hist[hist.length - 2]).checks.find((c) => /committed/.test(c.name)).ok);
if (quantumLive) { ok('rounds carry 32 real quantum bytes from the photonic source', hist.slice(-2).every((r) => r.quantum.bytes === 32 && r.quantum.source.includes('lfd')), hist.slice(-2).map((r) => r.quantum));
  ok('no two rounds reuse the same quantum bytes', new Set(hist.filter((r) => r.quantum.bytes).map((r) => r.quantum.hex)).size === hist.filter((r) => r.quantum.bytes).length);
  ok('quantum sample passes the health tests', st.health && st.health.pass, st.health);
} else skipT('quantum source checks', 'LfD QRNG unreachable: ' + (lfd && lfd.error));
if (st.sources.find((x) => x.id === 'nist').ok) ok('rounds mix in a NIST pulse', hist.some((r) => r.nist && /^[0-9a-f]{128}$/.test(r.nist.value))); else skipT('NIST mix', 'NIST beacon unreachable');
if (st.sources.find((x) => x.id === 'drand').ok) ok('rounds mix in a drand round', hist.some((r) => r.drand && /^[0-9a-f]{64}$/.test(r.drand.randomness))); else skipT('drand mix', 'drand unreachable');
const one = await get('/api/beacon/' + r0.index); ok('a round can be fetched by index', one.output === r0.output);
const fut = await get('/api/beacon/' + (r0.index + 500)); ok('a future round answers 425 with an eta', fut.__status === 425 && fut.eta > 0, fut);
// server-sent events deliver a round
const ev = await new Promise(async (res) => { const c = new AbortController(), t = setTimeout(() => { c.abort(); res(null); }, 4000); try { const r = await fetch(B + '/api/stream', { signal: c.signal }), rd = r.body.getReader(); const { value } = await rd.read(); clearTimeout(t); c.abort(); res(new TextDecoder().decode(value)); } catch (e) { res(null); } });
ok('the stream pushes rounds as server-sent events', !!ev && ev.startsWith('data: {') && JSON.parse(ev.slice(6).split('\n')[0]).output.length === 128);
// ---- draws ----
const d = await get(`/api/draw?round=${r0.index}&seed=raffle&min=1&max=500&count=20`);
ok('draw matches the published rule recomputed locally', JSON.stringify(d.values) === JSON.stringify(L.draw(r0.output, 'raffle', 1, 500, 20)) && d.values.every((v) => v >= 1 && v <= 500), d);
ok('the same round and seed always give the same draw', JSON.stringify((await get(`/api/draw?round=${r0.index}&seed=raffle&min=1&max=500&count=20`)).values) === JSON.stringify(d.values));
ok('a different seed gives a different draw', JSON.stringify((await get(`/api/draw?round=${r0.index}&seed=raffle2&min=1&max=500&count=20`)).values) !== JSON.stringify(d.values));
ok('a draw from a round that does not exist yet is refused', (await get(`/api/draw?round=${r0.index + 500}&seed=x`)).__status === 425);
ok('bad ranges are refused', (await get('/api/draw?min=5&max=1')).__status === 400 && (await get('/api/draw?count=5000')).__status === 400);
const big = L.draw(r0.output, 'dist', 0, 5, 1000), counts = [0, 0, 0, 0, 0, 0]; big.forEach((v) => counts[v]++);
ok('draws are spread evenly (1,000 rolls of a die, every face 120 to 215 times)', counts.every((c) => c > 120 && c < 215), counts);
const sh = await get(`/api/shuffle?round=${r0.index}&seed=deck&n=52`);
ok('shuffle matches the published rule and is a true permutation', JSON.stringify(sh.order) === JSON.stringify(L.shuffle(r0.output, 'deck', 52)) && [...sh.order].sort((a, b) => a - b).every((v, i) => v === i));
// ---- entropy ----
const e1 = await get('/api/entropy?bytes=48'), e2 = await get('/api/entropy?bytes=48');
ok('entropy returns the requested number of bytes', e1.hex.length === 96 && Buffer.from(e1.base64, 'base64').toString('hex') === e1.hex);
ok('two requests never return the same bytes', e1.hex !== e2.hex && e1.receipt.id !== e2.receipt.id);
ok('the receipt verifies against the node key', L.verifyReceipt(e1, cfg.nodeKey).ok);
ok('a receipt with altered bytes is rejected', !L.verifyReceipt({ ...e1, hex: e2.hex }, cfg.nodeKey).ok);
ok('a receipt with an altered byte count is rejected', !L.verifyReceipt({ ...e1, receipt: { ...e1.receipt, quantumBytes: 999 } }, cfg.nodeKey).ok);
ok('entropy bounds are enforced', (await get('/api/entropy?bytes=0')).__status === 400 && (await get('/api/entropy?bytes=1025')).__status === 400 && (await get('/api/entropy?bytes=abc')).__status === 400);
if (quantumLive) { ok('each entropy response consumed fresh quantum bytes', e1.receipt.quantumBytes === 32 && e1.quantumSource.includes('lfd'), e1.receipt);
  const before = (await get('/api/stats')).reservoir, q1 = await get('/api/quantum?bytes=24'), q2 = await get('/api/quantum?bytes=24'), after = (await get('/api/stats')).reservoir;
  ok('raw quantum bytes are delivered once: two calls differ', q1.bytes === 24 && q2.bytes === 24 && q1.hex !== q2.hex, [q1, q2]);
  ok('served bytes leave the reservoir', after <= before - 48 + 1024 && after !== before, { before, after });
  ok('raw bytes are not the bytes of any beacon round', !(await get('/api/beacon?limit=50')).rounds.some((r) => r.quantum.hex.includes(q1.hex)));
} else skipT('raw quantum delivery', 'LfD QRNG unreachable');
ok('raw byte bounds are enforced', (await get('/api/quantum?bytes=65')).__status === 400);
// ---- rate limit ----
let limited = 0; for (let i = 0; i < 34; i++) if ((await fetch(B + '/api/quantum?bytes=1')).status === 429) limited++;
ok('the raw endpoint is rate limited per address', limited > 0, limited);
// ---- health statistics ----
const bad = L.health(new Uint8Array(2048).fill(0x55)), good = L.health((() => { const b = new Uint8Array(4096); crypto.getRandomValues(b); return b; })());
ok('health tests fail a patterned sample and pass a random one', bad.pass === false && good.pass === true, { bad, good });
// ---- Key Forge ----
const v = F.fromMnemonic('abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about');
ok('EVM derivation matches the standard test vector', v.evm.address === '0x9858EfFD232B4033E47d90003D41EC34EcaEda94', v.evm.address);
ok('Solana derivation matches the standard test vector', v.solana.address === 'HAgk14JpMQLgt6rVgv7cBQFJWFto5Dqxi472uT3DKpqk', v.solana.address);
const local = crypto.getRandomValues(new Uint8Array(64)), w = F.forge(F.mix(L.unhex((await get('/api/entropy?bytes=64')).hex), local));
ok('forge: 24-word phrase, addresses and post-quantum keys', w.mnemonic.split(' ').length === 24 && /^0x[0-9a-fA-F]{40}$/.test(w.evm.address) && w.solana.address.length >= 32 && w.mldsa.publicKeyBytes === 1952 && w.mlkem.publicKeyBytes === 1184);
ok('forge: the phrase alone reproduces the same accounts', F.fromMnemonic(w.mnemonic).evm.address === w.evm.address && F.fromMnemonic(w.mnemonic).solana.address === w.solana.address);
ok('forge: the ML-DSA key pair signs and verifies', F.selfTest(w) === true);
ok('forge: the same node bytes with different local bytes give a different wallet', F.forge(F.mix(new Uint8Array(64).fill(1), new Uint8Array(64).fill(2))).evm.address !== F.forge(F.mix(new Uint8Array(64).fill(1), new Uint8Array(64).fill(3))).evm.address);
ok('forge: an invalid phrase is refused', (() => { try { F.fromMnemonic('void void void'); return false; } catch (e) { return true; } })());

await S.stop(); for (const f of [tmp, tmp + '.bak', tmp + '.tmp']) try { fs.unlinkSync(f); } catch (e) {}
console.log('\n' + pass + ' passed, ' + fail + ' failed, ' + skip + ' skipped'); process.exit(fail ? 1 : 0);
