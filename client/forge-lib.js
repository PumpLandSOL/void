// Key Forge: turns mixed entropy into keys. Runs in your browser; the node never sees the result.
// seed material = SHA3-512( bytes from the VOID node | bytes from this device's own generator )
// so the node alone cannot know your keys, and neither can a weak local generator alone.
import { sha3_512, keccak_256 } from '@noble/hashes/sha3';
import { sha512 } from '@noble/hashes/sha512';
import { hmac } from '@noble/hashes/hmac';
import { hkdf } from '@noble/hashes/hkdf';
import { ed25519 } from '@noble/curves/ed25519';
import { secp256k1 } from '@noble/curves/secp256k1';
import { base58 } from '@scure/base';
import { HDKey } from '@scure/bip32';
import { entropyToMnemonic, mnemonicToSeedSync, validateMnemonic } from '@scure/bip39';
import { wordlist } from '@scure/bip39/wordlists/english';
import { ml_dsa65 } from '@noble/post-quantum/ml-dsa';
import { ml_kem768 } from '@noble/post-quantum/ml-kem';
import { hex, cat, utf8 } from './voidlib.js';

export const mix = (nodeBytes, localBytes) => sha3_512(cat(utf8('VOID-FORGE-v1'), nodeBytes, localBytes));
// EIP-55 checksum address from an uncompressed secp256k1 public key
export function evmAddress(pubUncompressed) { const a = hex(keccak_256(pubUncompressed.subarray(1)).subarray(12)), h = hex(keccak_256(utf8(a))); return '0x' + [...a].map((c, i) => (parseInt(h[i], 16) >= 8 ? c.toUpperCase() : c)).join(''); }
// SLIP-0010 hardened derivation for ed25519 (the scheme Solana wallets use)
export function slip10(seed, pathStr) { let I = hmac(sha512, utf8('ed25519 seed'), seed), k = I.subarray(0, 32), c = I.subarray(32);
  for (const seg of pathStr.split('/').slice(1)) { const i = (parseInt(seg, 10) | 0x80000000) >>> 0, d = new Uint8Array(37); d.set(k, 1); d[33] = i >>> 24; d[34] = (i >>> 16) & 255; d[35] = (i >>> 8) & 255; d[36] = i & 255; I = hmac(sha512, c, d); k = I.subarray(0, 32); c = I.subarray(32); }
  return k; }
export function fromMnemonic(mnemonic) {
  if (!validateMnemonic(mnemonic, wordlist)) throw new Error('not a valid recovery phrase');
  const seed = mnemonicToSeedSync(mnemonic);
  const evm = HDKey.fromMasterSeed(seed).derive("m/44'/60'/0'/0/0"), sol = slip10(seed, "m/44'/501'/0'/0'");
  return { mnemonic, evm: { path: "m/44'/60'/0'/0/0", address: evmAddress(secp256k1.getPublicKey(evm.privateKey, false)), privateKey: '0x' + hex(evm.privateKey) },
    solana: { path: "m/44'/501'/0'/0'", address: base58.encode(ed25519.getPublicKey(sol)), secretKey: base58.encode(cat(sol, ed25519.getPublicKey(sol))) } };
}
// 64 mixed bytes -> a 24-word phrase (first 32 bytes), plus post-quantum key pairs derived from the rest
export function forge(mixed) {
  const w = fromMnemonic(entropyToMnemonic(mixed.subarray(0, 32), wordlist));
  const pq = (label, n) => hkdf(sha512, mixed.subarray(32), utf8('VOID-FORGE-v1'), utf8(label), n);
  const dsa = ml_dsa65.keygen(pq('ml-dsa-65', 32)), kem = ml_kem768.keygen(pq('ml-kem-768', 64));
  const fp = (b) => hex(sha3_512(b)).slice(0, 32);
  w.mldsa = { scheme: 'ML-DSA-65 (FIPS 204)', publicKeyBytes: dsa.publicKey.length, secretKeyBytes: dsa.secretKey.length, fingerprint: fp(dsa.publicKey), publicKey: hex(dsa.publicKey), secretKey: hex(dsa.secretKey) };
  w.mlkem = { scheme: 'ML-KEM-768 (FIPS 203)', publicKeyBytes: kem.publicKey.length, secretKeyBytes: kem.secretKey.length, fingerprint: fp(kem.publicKey), publicKey: hex(kem.publicKey), secretKey: hex(kem.secretKey) };
  return w;
}
// proves the ML-DSA key pair works: sign a message and verify it
export function selfTest(w, msg = 'VOID') { const m = utf8(msg), sk = Uint8Array.from(w.mldsa.secretKey.match(/../g).map((x) => parseInt(x, 16))), pk = Uint8Array.from(w.mldsa.publicKey.match(/../g).map((x) => parseInt(x, 16))); return ml_dsa65.verify(pk, m, ml_dsa65.sign(sk, m)); }
