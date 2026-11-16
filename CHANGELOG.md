# Changelog

All notable changes to VOID are listed here. Versions follow [Semantic Versioning](https://semver.org).

## [0.1.0] - 2026-11-16

First public release.

### Added

- **Node.** Pulls raw bytes from a photonic quantum random number generator, keeps a secret SHA3-512 pool and a reservoir of unused quantum bytes that are each served once.
- **Beacon.** A signed, hash-chained round every 10 seconds. Each round publishes its inputs: 32 quantum bytes, the node's committed value, the latest NIST Randomness Beacon pulse and drand round.
- **Commitment one round ahead.** Every round carries the hash of the node's next contribution.
- **Entropy API.** Up to 1,024 private bytes per request, derived with HKDF-SHA-512, with a signed receipt.
- **Raw quantum bytes.** Up to 64 device bytes per request, removed from the reservoir on delivery.
- **Draws and shuffles.** Deterministic from a round output and a caller-chosen seed, with rejection sampling.
- **Circuit simulator.** Exact statevector simulation for up to 12 qubits, a text format, a visual builder and measurement sampled with quantum entropy.
- **Key Forge.** In-browser wallet generation from node entropy mixed with local entropy: BIP-39 phrase, EVM and Solana accounts, ML-DSA-65 and ML-KEM-768 key pairs.
- **Health tests.** Frequency, runs, chi-square, serial correlation and a Shannon estimate on the latest quantum sample.
- **Site.** Landing page, console, simulator, Key Forge and docs.
- **Tests.** 74 checks, including live quantum bytes, tamper rejection and published wallet test vectors.

[0.1.0]: https://github.com/VoidQaas/void/releases/tag/v0.1.0
