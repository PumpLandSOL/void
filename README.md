# VOID

[![test](https://github.com/VoidQaas/void/actions/workflows/test.yml/badge.svg)](https://github.com/VoidQaas/void/actions/workflows/test.yml) [![license](https://img.shields.io/badge/license-MIT-a855f7)](LICENSE) [![node](https://img.shields.io/badge/node-%E2%89%A5%2022-a855f7)](.node-version)

**[voidqaas.xyz](https://voidqaas.xyz)** · [Docs](https://voidqaas.xyz/docs) · [Console](https://voidqaas.xyz/console) · [Simulator](https://voidqaas.xyz/sim) · [X](https://x.com/VoidQaas)

Quantum-as-a-Service (QaaS) for Web3: real quantum entropy over an open API. One Node.js process that pulls raw bytes from a photonic quantum random number generator and turns them into things you can use and check:

- **Public beacon.** A signed, hash-chained round every 10 seconds. Each round prints its own inputs (32 quantum bytes, the node's committed value, the latest NIST Randomness Beacon pulse and drand round), so anyone can recompute the output.
- **Entropy API.** Private random bytes with a signed receipt. Fresh quantum bytes go into every response.
- **Raw quantum bytes.** Device output with no hashing. Each byte is served once.
- **Provably fair draws and shuffles.** A pure function of a beacon round and a seed you choose.
- **Circuit simulator.** An exact statevector simulator for up to 12 qubits with a visual builder. Measurements are sampled with quantum entropy, and the node signs the counts.
- **Key Forge.** A wallet built in the browser from node entropy mixed with the device's own: a 24-word phrase, Ethereum and Solana addresses, and ML-DSA-65 and ML-KEM-768 key pairs. The node never sees the keys.

## Run it

```bash
git clone https://github.com/VoidQaas/void
cd void
npm install
npm start          # http://localhost:8294
npm test           # 74 checks, including live quantum bytes
```

Node 22 or newer. The server itself uses only Node's standard library; the dependencies are the audited `noble` and `scure` cryptography libraries, served to the browser from `/vendor`.

## Layout

| Path | What it is |
|---|---|
| `server/index.js` | The node: sources, pool, reservoir, beacon, HTTP API, static site |
| `client/voidlib.js` | The protocol rules, shared by the node and the browser: round hashing, verification, draws, receipts, health tests |
| `client/qsim.js` | The circuit simulator: gates, parser, sampling, presets |
| `client/forge-lib.js` | Key Forge derivations |
| `client/*.html` | Landing page, console, simulator, Key Forge, docs |
| `test/run.js` | The test suite |

## Sources

| Source | Kind | Notes |
|---|---|---|
| LfD QRNG | Quantum device | ID Quantique Quantis photonic QRNG at OTH Regensburg. Keyless. |
| ANU QRNG | Quantum device | Vacuum fluctuations. Enabled when `ANU_KEY` is set. |
| NIST Randomness Beacon | Public beacon | Mixed into rounds |
| drand | Public beacon | Mixed into rounds |

## Configuration

Environment variables, or a git-ignored `.env` next to `package.json`:

| Variable | Default | Purpose |
|---|---|---|
| `PORT` | `8294` | HTTP port |
| `DATA_PATH` | `./data.json` | Node key, round history and counters. Put it on a persistent disk. |
| `ROUND_SEC` | `10` | Seconds between beacon rounds |
| `SITE_URL`, `X_URL`, `GH_URL` | placeholders | Links shown on the site |
| `VOID_MINT` | empty | Token address shown on the site once it exists |
| `ANU_KEY` | empty | Adds the second quantum device |

The node's signing key is created on first start and stored in the data file. Keep that file private and backed up: a new key means a new beacon identity.

## Verify a round yourself

```js
import { verifyRound, draw } from './client/voidlib.js';

const base = 'https://voidqaas.xyz';
const { nodeKey } = await (await fetch(base + '/api/config')).json();
const r    = await (await fetch(base + '/api/beacon/12')).json();
const prev = await (await fetch(base + '/api/beacon/11')).json();

verifyRound(r, nodeKey, prev).ok;        // output, signature, chain link, commitment
draw(r.output, 'my-raffle', 1, 500, 3);  // the same numbers the node returns
```

## Contributing and security

See [CONTRIBUTING.md](CONTRIBUTING.md) for how the code is laid out and what a change needs. Report vulnerabilities privately as described in [SECURITY.md](SECURITY.md). Release notes are in [CHANGELOG.md](CHANGELOG.md).

## License

MIT
