// VOID tests: boots the node on a scratch data file with 1-second rounds, then checks the beacon rules, the API,
// the receipts, the one-time delivery of quantum bytes and the Key Forge against published wallet test vectors.
import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path';
const tmp = path.join(os.tmpdir(), 'void-test-' + Date.now() + '.json');
Object.assign(process.env, { PORT: '8395', DATA_PATH: tmp, ROUND_SEC: '1', LFD_EVERY: '5' });
const S = await import('../server/index.js');
const L = await import('../client/voidlib.js');
const F = await import('../client/forge-lib.js');
const Q = await import('../client/qsim.js');
const B = 'http://127.0.0.1:8395';
let pass = 0, fail = 0, skip = 0;
const ok = (name, cond, extra) => { if (cond) { pass++; console.log('PASS', name); } else { fail++; console.log('FAIL', name, extra === undefined ? '' : JSON.stringify(extra).slice(0, 300)); } };
const skipT = (name, why) => { skip++; console.log('SKIP', name, '·', why); };
const get = async (u) => { const r = await fetch(B + u); const j = await r.json(); j.__status = r.status; return j; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

await S.start(); await sleep(4500);
// ---- pages ----
for (const p of ['/', '/console', '/sim', '/forge', '/docs']) { const r = await fetch(B + p), t = await r.text(); ok('page ' + p + ' serves with no template tokens left', r.status === 200 && t.includes('VOID') && !/\{\{[A-Z_]+\}\}/.test(t)); }
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
// ---- simulator: the engine ----
const pm = (code, n) => Q.probMap(Q.run(Q.parse(code, n), n)), near = (a, b) => Math.abs(a - b) < 1e-9;
const bell = pm('h 0\ncx 0 1', 2); ok('sim: a Bell pair is 00 or 11, half each', Object.keys(bell).sort().join() === '00,11' && near(bell['00'], 0.5) && near(bell['11'], 0.5), bell);
const ghz = pm('h 0; cx 0 1; cx 1 2', 3); ok('sim: a GHZ state is 000 or 111', Object.keys(ghz).sort().join() === '000,111' && near(ghz['000'], 0.5));
ok('sim: Grover search finds the marked item with certainty', near(pm(Q.PRESETS.grover.text, 2)['11'], 1), pm(Q.PRESETS.grover.text, 2));
ok('sim: interference cancels a path (H Z H gives 1)', near(pm('h 0; z 0; h 0', 1)['1'], 1) && near(pm('h 0; h 0', 1)['0'], 1));
ok('sim: X flips, and qubit 0 is the rightmost bit', near(pm('x 0', 3)['001'], 1) && near(pm('x 2', 3)['100'], 1));
ok('sim: Toffoli flips the target only when both controls are 1', near(pm('x 0; x 1; ccx 0 1 2', 3)['111'], 1) && near(pm('x 0; ccx 0 1 2', 3)['001'], 1));
ok('sim: swap exchanges two qubits', near(pm('x 0; swap 0 2', 3)['100'], 1));
ok('sim: the Fourier transform of a basis state is uniform', Object.values(pm(Q.PRESETS.qft.text, 3)).every((v) => near(v, 0.125)));
ok('sim: rotations follow the textbook (RY(pi/2) is a fair coin, RX(pi) is a flip)', near(pm('ry(pi/2) 0', 1)['1'], 0.5) && near(pm('rx(pi) 0', 1)['1'], 1));
const busy = Q.run(Q.parse('h 0;h 1;h 2;h 3;rx(0.3) 0;ry(1.1) 1;rz(2) 2;cx 0 3;ccx 0 1 2;swap 1 3;cp(pi/3) 2 0;t 3;sdg 1;cy 0 2;ch 3 1;crz(0.7) 1 0', 4), 4);
ok('sim: total probability stays 1 through every gate type', near(Q.probabilities(busy).reduce((a, b) => a + b, 0), 1));
ok('sim: twelve qubits run (4,096 amplitudes)', near(Q.probabilities(Q.run(Q.parse(Array.from({ length: 12 }, (_, i) => 'h ' + i).join(';'), 12), 12)).reduce((a, b) => a + b, 0), 1));
const throws = (f) => { try { f(); return false; } catch (e) { return true; } };
ok('sim: bad circuits are refused with a reason', throws(() => Q.parse('foo 0', 2)) && throws(() => Q.parse('cx 0 0', 2)) && throws(() => Q.parse('h 5', 2)) && throws(() => Q.parse('rx 0', 1)) && throws(() => Q.parse('h 0', 13)) && throws(() => Q.angle('alert(1)')));
ok('sim: angles parse (pi/2, -pi/4, 2*pi)', near(Q.angle('pi/2'), Math.PI / 2) && near(Q.angle('-pi/4'), -Math.PI / 4) && near(Q.angle('2*pi'), 2 * Math.PI));
// ---- simulator: the API ----
const sim = (b) => fetch(B + '/api/sim', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(b) }).then(async (r) => { const j = await r.json(); j.__status = r.status; return j; });
const s1 = await sim({ qubits: 2, code: 'h 0\ncx 0 1', shots: 2000 }), s2 = await sim({ qubits: 2, code: 'h 0\ncx 0 1', shots: 2000 });
ok('sim api: counts add up to the shots and land only on possible outcomes', Object.values(s1.counts).reduce((a, b) => a + b, 0) === 2000 && Object.keys(s1.counts).every((k) => k === '00' || k === '11'), s1.counts);
ok('sim api: a Bell pair measures about half and half', s1.counts['00'] > 850 && s1.counts['00'] < 1150, s1.counts);
ok('sim api: the counts can be re-derived from the sampling key', JSON.stringify(Q.countMap(Q.sample(Q.probabilities(Q.run(Q.parse('h 0\ncx 0 1', 2), 2)), 2000, s1.sampleKey), 2)) === JSON.stringify(s1.counts));
ok('sim api: every run uses a new sampling key', s1.sampleKey !== s2.sampleKey && JSON.stringify(s1.counts) !== JSON.stringify(s2.counts));
ok('sim api: the receipt is signed and binds the circuit and the counts', L.verifySig(Q.simMessage(s1.receipt), s1.sig, cfg.nodeKey) && s1.receipt.circuit === Q.circuitDigest(Q.parse('h 0\ncx 0 1', 2), 2) && s1.receipt.counts === Q.countsDigest(s1.counts));
ok('sim api: a receipt with altered counts is rejected', !L.verifySig(Q.simMessage({ ...s1.receipt, counts: Q.countsDigest({ '00': 2000 }) }), s1.sig, cfg.nodeKey));
if (quantumLive) ok('sim api: the sampling was seeded with fresh quantum bytes', s1.receipt.quantumBytes === 32 && s1.quantumSource.includes('lfd'), s1.receipt); else skipT('sim quantum seed', 'LfD QRNG unreachable');
const s0 = await sim({ qubits: 3, ops: [{ g: 'h', q: [0] }, { g: 'cx', q: [0, 2] }], shots: 0 }); ok('sim api: shots 0 returns the exact state only', s0.__status === 200 && !s0.counts && s0.amplitudes.length === 8 && near(s0.probabilities['101'], 0.5), s0);
ok('sim api: limits and bad input are refused', (await sim({ qubits: 13, code: 'h 0' })).__status === 400 && (await sim({ qubits: 2, code: 'h 0', shots: 99999 })).__status === 400 && (await sim({ qubits: 2, code: 'nope 0' })).__status === 400 && (await fetch(B + '/api/sim')).status === 405);
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
