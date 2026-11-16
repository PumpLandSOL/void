# Security

## Reporting a vulnerability

Please report security problems privately through GitHub: **Security → Report a vulnerability** on this repository. Do not open a public issue.

Include what you found, how to reproduce it, and what you think the impact is. You will get an acknowledgement, and a fix or a written reason if we decide it is not a vulnerability.

## What counts

Reports that matter most:

- Any way to predict or bias a beacon round before it is published.
- Any way to make `verifyRound`, `verifyReceipt` or the simulator receipt check accept data the node did not sign.
- Any way to receive the same raw quantum bytes twice, or bytes that also appear in a beacon round.
- Any response that exposes the node's signing key or the pool.
- Any path that lets the node learn keys made by the Key Forge.
- Path traversal or request handling bugs in the HTTP server.

## The trust model, stated plainly

- **The node is one operator.** A round is unpredictable as long as any one of its inputs is: the quantum bytes, the NIST pulse, the drand round or the node's committed value. The node commits to its own value one round ahead so it cannot retry for a better result.
- **The quantum source is reached over HTTPS.** The node cannot prove to you that the bytes it relayed are the bytes the device produced. That is why outside beacons are mixed in and why every input is published.
- **Entropy responses are private to the caller, not to the node.** The node generates them, so it has seen them. The Key Forge exists for this reason: it mixes the node's bytes with bytes from your own device before deriving anything.
- **The simulator's sampling key is returned to the caller.** Counts can be re-derived by anyone holding it.

## Keeping a node safe

- Keep the data file private and backed up. It holds the node's signing key.
- Never commit `data.json` or `.env`. Both are git-ignored.
- Run behind TLS in production.
