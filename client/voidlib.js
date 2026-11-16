// VOID protocol rules, in one file shared by the node and the browser.
// Everything a third party needs to re-check a beacon round, a draw, a shuffle or an entropy receipt is here.
import { sha3_256, sha3_512 } from '@noble/hashes/sha3';
import { sha512 } from '@noble/hashes/sha512';
import { hmac } from '@noble/hashes/hmac';
import { ed25519 } from '@noble/curves/ed25519';

export const hex = (b) => Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
export const unhex = (s) => { s = String(s || ''); if (s.length % 2 || /[^0-9a-f]/i.test(s)) throw new Error('bad hex'); const o = new Uint8Array(s.length / 2); for (let i = 0; i < o.length; i++) o[i] = parseInt(s.substr(i * 2, 2), 16); return o; };
export const utf8 = (s) => new TextEncoder().encode(s);
export const cat = (...a) => { const o = new Uint8Array(a.reduce((n, x) => n + x.length, 0)); let p = 0; for (const x of a) { o.set(x, p); p += x.length; } return o; };
const u32 = (n) => new Uint8Array([(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255]);
const u64 = (n) => { const o = new Uint8Array(8); let x = BigInt(n); for (let i = 7; i >= 0; i--) { o[i] = Number(x & 255n); x >>= 8n; } return o; };
const lp = (b) => cat(u32(b.length), b);   // length-prefixed, so no two different input sets can hash the same

export const ZERO = '00'.repeat(64);
// ---- beacon ----
// output = SHA3-512( "VOID-BEACON-v1" | index | time | previous output | quantum bytes | node value | NIST value | drand value )
// Every input is published in the round itself, so anyone can recompute the output.
export function roundOutput(r) {
  return hex(sha3_512(cat(utf8('VOID-BEACON-v1'), u64(r.index), u64(r.time), unhex(r.prev), lp(unhex(r.quantum.hex)), lp(unhex(r.local)), lp(unhex(r.nist ? r.nist.value : '')), lp(unhex(r.drand ? r.drand.randomness : '')))));
}
export const roundMessage = (r) => cat(utf8('VOID-ROUND-v1'), u64(r.index), unhex(r.output));
export const commitOf = (localHex) => hex(sha3_256(unhex(localHex)));
// Checks one round. Pass the previous round to also check the chain link and the commitment the node made one round ahead.
export function verifyRound(r, nodeKeyHex, prev) {
  const checks = [];
  const add = (name, ok, note) => checks.push({ name, ok: !!ok, note: note || '' });
  let out = ''; try { out = roundOutput(r); } catch (e) {}
  add('output recomputed from the published inputs', out && out === r.output);
  let sig = false; try { sig = ed25519.verify(unhex(r.sig), roundMessage(r), unhex(nodeKeyHex)); } catch (e) {}
  add('signed by the node key', sig);
  add('carries quantum bytes', r.quantum.bytes > 0 && r.quantum.hex.length === r.quantum.bytes * 2, r.quantum.bytes + ' bytes from ' + (r.quantum.source.join(' + ') || 'no source'));
  if (prev) { add('chained to the previous round', r.prev === prev.output && r.index === prev.index + 1);
    add('node value was committed one round earlier', commitOf(r.local) === prev.commitNext); }
  return { ok: checks.every((c) => c.ok), checks };
}
// ---- draws: provably fair numbers from a beacon round and a seed you choose ----
// stream block i = HMAC-SHA512( key = round output, message = "VOID-DRAW-v1|" + seed + "|" + i )
function* stream(outputHex, seed) { const key = unhex(outputHex); for (let i = 0; ; i++) { const b = hmac(sha512, key, utf8('VOID-DRAW-v1|' + seed + '|' + i)); for (let j = 0; j + 6 <= b.length; j += 6) { let v = 0; for (let k = 0; k < 6; k++) v = v * 256 + b[j + k]; yield v; } } }   // 48-bit values
const below = (it, range) => { const lim = Math.floor(281474976710656 / range) * range; for (;;) { const v = it.next().value; if (v < lim) return v % range; } };   // rejection sampling: no modulo bias
export function draw(outputHex, seed, min, max, count = 1) {
  min = Math.trunc(min); max = Math.trunc(max); count = Math.trunc(count);
  if (!(max >= min) || max - min + 1 > 4294967296 || !(count >= 1 && count <= 1000)) throw new Error('bad range');
  const it = stream(outputHex, String(seed)), out = []; for (let i = 0; i < count; i++) out.push(min + below(it, max - min + 1)); return out;
}
export function shuffle(outputHex, seed, n) {
  n = Math.trunc(n); if (!(n >= 1 && n <= 10000)) throw new Error('bad size');
  const it = stream(outputHex, String(seed)), a = Array.from({ length: n }, (_, i) => i); for (let i = n - 1; i > 0; i--) { const j = below(it, i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a;   // Fisher-Yates
}
// ---- entropy receipts ----
// The node signs what it delivered without publishing it: the receipt carries only the SHA3-256 digest of the bytes.
export const receiptMessage = (c) => utf8(['VOID-RECEIPT-v1', c.id, c.time, c.round, c.bytes, c.quantumBytes, c.digest].join('|'));
export function verifyReceipt(resp, nodeKeyHex) {
  const checks = []; const add = (name, ok) => checks.push({ name, ok: !!ok });
  add('digest matches the bytes you received', hex(sha3_256(unhex(resp.hex))) === resp.receipt.digest);
  let sig = false; try { sig = ed25519.verify(unhex(resp.sig), receiptMessage(resp.receipt), unhex(nodeKeyHex)); } catch (e) {}
  add('receipt signed by the node key', sig);
  return { ok: checks.every((c) => c.ok), checks };
}
// ---- statistical health of a byte sample (the same tests the node runs on what its quantum sources send) ----
export function health(bytes) {
  const n = bytes.length; if (n < 64) return null;
  let ones = 0, runs = 1, prevBit = -1; const freq = new Array(256).fill(0); let sx = 0, sxx = 0, sxy = 0;
  for (let i = 0; i < n; i++) { const b = bytes[i]; freq[b]++; sx += b; sxx += b * b; if (i) sxy += b * bytes[i - 1];
    for (let k = 7; k >= 0; k--) { const bit = (b >> k) & 1; ones += bit; if (prevBit >= 0 && bit !== prevBit) runs++; prevBit = bit; } }
  const bits = n * 8, pi = ones / bits, exp = n / 256; let chi = 0, H = 0; for (const f of freq) { chi += (f - exp) * (f - exp) / exp; if (f) { const p = f / n; H -= p * Math.log2(p); } }
  const runsExp = 2 * bits * pi * (1 - pi) + 1, runsZ = (runs - runsExp) / (2 * Math.sqrt(2 * bits) * pi * (1 - pi));
  const mean = sx / n, varr = sxx / n - mean * mean, corr = varr > 0 ? ((sxy / (n - 1)) - mean * mean) / varr : 0;
  const monoZ = (ones - bits / 2) / Math.sqrt(bits / 4), chiZ = (chi - 255) / Math.sqrt(510);
  return { bytes: n, ones: +pi.toFixed(5), monobitZ: +monoZ.toFixed(3), runsZ: +runsZ.toFixed(3), chiSquare: +chi.toFixed(1), chiZ: +chiZ.toFixed(3), entropyBitsPerByte: +H.toFixed(4), serialCorrelation: +corr.toFixed(5),
    pass: Math.abs(monoZ) < 3.5 && Math.abs(runsZ) < 3.5 && Math.abs(chiZ) < 4 && Math.abs(corr) < 0.08 };
}
