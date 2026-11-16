// VOID Sim: an exact statevector simulator for quantum circuits, shared by the node and the browser.
// A circuit on n qubits is 2^n complex amplitudes. Gates are applied exactly; measuring is the only random step,
// and the node samples it with real quantum entropy (see /api/sim).
// Bit order: qubit 0 is the rightmost bit of a basis-state label, so "q2 q1 q0".
import { sha3_256 } from '@noble/hashes/sha3';
import { sha512 } from '@noble/hashes/sha512';
import { hmac } from '@noble/hashes/hmac';
import { hex, unhex, utf8 } from './voidlib.js';

export const MAX_QUBITS = 12, MAX_OPS = 400, MAX_SHOTS = 8192;
const R2 = Math.SQRT1_2;
// single-qubit gates as [a, b, c, d] with each entry [re, im]: the matrix [[a, b], [c, d]]
const U = {
  h: () => [[R2, 0], [R2, 0], [R2, 0], [-R2, 0]], x: () => [[0, 0], [1, 0], [1, 0], [0, 0]], y: () => [[0, 0], [0, -1], [0, 1], [0, 0]], z: () => [[1, 0], [0, 0], [0, 0], [-1, 0]],
  s: () => [[1, 0], [0, 0], [0, 0], [0, 1]], sdg: () => [[1, 0], [0, 0], [0, 0], [0, -1]], t: () => [[1, 0], [0, 0], [0, 0], [R2, R2]], tdg: () => [[1, 0], [0, 0], [0, 0], [R2, -R2]],
  rx: (a) => [[Math.cos(a / 2), 0], [0, -Math.sin(a / 2)], [0, -Math.sin(a / 2)], [Math.cos(a / 2), 0]],
  ry: (a) => [[Math.cos(a / 2), 0], [-Math.sin(a / 2), 0], [Math.sin(a / 2), 0], [Math.cos(a / 2), 0]],
  rz: (a) => [[Math.cos(a / 2), -Math.sin(a / 2)], [0, 0], [0, 0], [Math.cos(a / 2), Math.sin(a / 2)]],
  p: (a) => [[1, 0], [0, 0], [0, 0], [Math.cos(a), Math.sin(a)]],
};
// name -> [number of qubits, takes an angle, base single-qubit gate, number of leading control qubits]
export const GATES = { h: [1, 0, 'h', 0], x: [1, 0, 'x', 0], y: [1, 0, 'y', 0], z: [1, 0, 'z', 0], s: [1, 0, 's', 0], sdg: [1, 0, 'sdg', 0], t: [1, 0, 't', 0], tdg: [1, 0, 'tdg', 0],
  rx: [1, 1, 'rx', 0], ry: [1, 1, 'ry', 0], rz: [1, 1, 'rz', 0], p: [1, 1, 'p', 0],
  cx: [2, 0, 'x', 1], cy: [2, 0, 'y', 1], cz: [2, 0, 'z', 1], ch: [2, 0, 'h', 1], cp: [2, 1, 'p', 1], crz: [2, 1, 'rz', 1], ccx: [3, 0, 'x', 2], swap: [2, 0, null, 0] };
const ALIAS = { cnot: 'cx', toffoli: 'ccx', phase: 'p', id: null, i: null, barrier: null, measure: null };

// angle expressions: numbers and "pi" joined by * and /, with an optional leading minus. Examples: pi/2, -pi/4, 2*pi, 0.3
export function angle(src) { const s = String(src).replace(/\s+/g, '').toLowerCase(); if (!/^-?(\d*\.?\d+|pi)([*/](\d*\.?\d+|pi))*$/.test(s)) throw new Error('angle "' + src + '" is not understood; use numbers and pi with * and /');
  const neg = s[0] === '-', toks = (neg ? s.slice(1) : s).split(/([*/])/), val = (t) => (t === 'pi' ? Math.PI : parseFloat(t)); let v = val(toks[0]);
  for (let i = 1; i < toks.length; i += 2) { const b = val(toks[i + 1]); if (toks[i] === '/' && b === 0) throw new Error('division by zero in an angle'); v = toks[i] === '*' ? v * b : v / b; } return neg ? -v : v; }
// circuit text: one gate per line or separated by ";". "h 0", "cx 0 1", "rz(pi/2) 2", "ccx 0 1 2". "//" and "#" start comments.
export function parse(text, qubits) {
  const ops = []; if (String(text).length > 20000) throw new Error('circuit text is too long');
  for (const raw of String(text).split(/[\n;]/)) { const line = raw.replace(/(\/\/|#).*$/, '').trim(); if (!line) continue;
    const m = line.match(/^([a-z]+)\s*(?:\(([^)]*)\))?\s*(.*)$/i); if (!m) throw new Error('cannot read "' + line + '"');
    let g = m[1].toLowerCase(); if (g in ALIAS) { g = ALIAS[g]; if (!g) continue; } const def = GATES[g]; if (!def) throw new Error('unknown gate "' + m[1] + '"');
    const q = m[3].split(/[\s,]+/).filter(Boolean).map((x) => { const v = Number(x.replace(/^q\[?|\]$/gi, '')); if (!Number.isInteger(v)) throw new Error('bad qubit "' + x + '" in "' + line + '"'); return v; });
    const op = { g, q }; if (def[1]) { if (m[2] === undefined || m[2].trim() === '') throw new Error(g + ' needs an angle, for example ' + g + '(pi/2) 0'); op.a = angle(m[2]); }
    ops.push(op); }
  return check(ops, qubits);
}
export function check(ops, qubits) {
  if (!Number.isInteger(qubits) || qubits < 1 || qubits > MAX_QUBITS) throw new Error('qubits must be between 1 and ' + MAX_QUBITS);
  if (!Array.isArray(ops) || ops.length > MAX_OPS) throw new Error('a circuit can hold at most ' + MAX_OPS + ' gates');
  return ops.map((o) => { const def = GATES[o && o.g]; if (!def) throw new Error('unknown gate "' + (o && o.g) + '"'); const q = (o.q || []).map(Number);
    if (q.length !== def[0]) throw new Error(o.g + ' acts on ' + def[0] + ' qubit' + (def[0] > 1 ? 's' : '')); if (q.some((x) => !Number.isInteger(x) || x < 0 || x >= qubits)) throw new Error(o.g + ' names a qubit outside 0 to ' + (qubits - 1));
    if (new Set(q).size !== q.length) throw new Error(o.g + ' needs different qubits'); const out = { g: o.g, q }; if (def[1]) { if (!Number.isFinite(o.a)) throw new Error(o.g + ' needs an angle'); out.a = o.a; } return out; });
}
export const toText = (ops) => ops.map((o) => o.g + (GATES[o.g][1] ? '(' + +o.a.toFixed(6) + ')' : '') + ' ' + o.q.join(' ')).join('\n');

// Runs the circuit from |0…0> and returns the final amplitudes.
export function run(ops, qubits) {
  ops = check(ops, qubits); const N = 1 << qubits, re = new Float64Array(N), im = new Float64Array(N); re[0] = 1;
  for (const o of ops) { const def = GATES[o.g];
    if (o.g === 'swap') { const a = 1 << o.q[0], b = 1 << o.q[1]; for (let i = 0; i < N; i++) if ((i & a) && !(i & b)) { const j = i ^ a ^ b; let t = re[i]; re[i] = re[j]; re[j] = t; t = im[i]; im[i] = im[j]; im[j] = t; } continue; }
    const m = U[def[2]](o.a), nc = def[3], tb = 1 << o.q[nc]; let cm = 0; for (let k = 0; k < nc; k++) cm |= 1 << o.q[k];
    for (let i = 0; i < N; i++) { if ((i & tb) || (i & cm) !== cm) continue; const j = i | tb, ar = re[i], ai = im[i], br = re[j], bi = im[j];
      re[i] = m[0][0] * ar - m[0][1] * ai + m[1][0] * br - m[1][1] * bi; im[i] = m[0][0] * ai + m[0][1] * ar + m[1][0] * bi + m[1][1] * br;
      re[j] = m[2][0] * ar - m[2][1] * ai + m[3][0] * br - m[3][1] * bi; im[j] = m[2][0] * ai + m[2][1] * ar + m[3][0] * bi + m[3][1] * br; } }
  return { qubits, re, im };
}
export const probabilities = (sv) => { const p = new Float64Array(sv.re.length); for (let i = 0; i < p.length; i++) p[i] = sv.re[i] * sv.re[i] + sv.im[i] * sv.im[i]; return p; };
export const label = (i, qubits) => i.toString(2).padStart(qubits, '0');
// probabilities as { "010": 0.25, … }, leaving out states below 1e-12
export const probMap = (sv) => { const p = probabilities(sv), o = {}; for (let i = 0; i < p.length; i++) if (p[i] > 1e-12) o[label(i, sv.qubits)] = +p[i].toFixed(12); return o; };

// Measurement: each shot picks a basis state with its probability. The uniform numbers come from
// HMAC-SHA512(key, "VOID-SIM-v1|" + block), 48 bits per shot, so anyone holding the key can re-derive the counts.
export function sample(probs, shots, keyHex) {
  shots = Math.trunc(shots); if (!(shots >= 1 && shots <= MAX_SHOTS)) throw new Error('shots must be between 1 and ' + MAX_SHOTS);
  const key = unhex(keyHex), n = probs.length, cum = new Float64Array(n); let s = 0; for (let i = 0; i < n; i++) { s += probs[i]; cum[i] = s; }
  const counts = new Uint32Array(n); let block = null, pos = 60, bi = 0;
  for (let k = 0; k < shots; k++) { if (pos + 6 > 60) { block = hmac(sha512, key, utf8('VOID-SIM-v1|' + bi++)); pos = 0; } let v = 0; for (let j = 0; j < 6; j++) v = v * 256 + block[pos + j]; pos += 6;
    const u = (v / 281474976710656) * s; let lo = 0, hi = n - 1; while (lo < hi) { const mid = (lo + hi) >> 1; if (cum[mid] > u) hi = mid; else lo = mid + 1; } counts[lo]++; }
  return counts;
}
export const countMap = (counts, qubits) => { const o = {}; for (let i = 0; i < counts.length; i++) if (counts[i]) o[label(i, qubits)] = counts[i]; return o; };
// what the node signs for a sampled run
export const circuitDigest = (ops, qubits) => hex(sha3_256(utf8(qubits + '\n' + toText(ops))));
export const countsDigest = (map) => hex(sha3_256(utf8(Object.keys(map).sort().map((k) => k + ':' + map[k]).join(','))));
export const simMessage = (c) => utf8(['VOID-SIM-RECEIPT-v1', c.id, c.time, c.round, c.qubits, c.shots, c.quantumBytes, c.circuit, c.counts].join('|'));

// ready-made circuits for the builder
export const PRESETS = {
  bell: { name: 'Bell pair', qubits: 2, text: 'h 0\ncx 0 1', note: 'Two qubits that always agree. Measure them and you get 00 or 11, never 01 or 10.' },
  ghz: { name: 'GHZ state', qubits: 3, text: 'h 0\ncx 0 1\ncx 1 2', note: 'Three qubits entangled together: all zeros or all ones.' },
  coin: { name: 'Quantum coin', qubits: 1, text: 'h 0', note: 'One qubit in an equal superposition. This is the physics inside a quantum random number generator.' },
  dice: { name: 'Eight-sided die', qubits: 3, text: 'h 0\nh 1\nh 2', note: 'Three coins at once: eight outcomes, each with probability 1/8.' },
  grover: { name: 'Grover search', qubits: 2, text: 'h 0\nh 1\ncz 0 1\nh 0\nh 1\nz 0\nz 1\ncz 0 1\nh 0\nh 1', note: 'Finds the marked item 11 among four in a single step. A classical search needs about two tries on average.' },
  qft: { name: 'Fourier transform', qubits: 3, text: 'x 0\nh 2\ncp(pi/2) 1 2\ncp(pi/4) 0 2\nh 1\ncp(pi/2) 0 1\nh 0\nswap 0 2', note: 'The quantum Fourier transform of the state 001, the core of Shor\'s algorithm. Every outcome is equally likely; the information is in the phases.' },
  w: { name: 'Interference', qubits: 1, text: 'h 0\nz 0\nh 0', note: 'Two paths that cancel. H then Z then H always gives 1: the amplitudes for 0 interfere away.' },
};
