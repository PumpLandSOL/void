# Contributing

Thanks for taking a look. VOID is small on purpose: one server file, a handful of shared modules and static pages.

## Getting set up

```bash
git clone https://github.com/VoidQaas/void
cd void
npm install
npm start      # http://localhost:8294
npm test
```

Node 22 or newer.

## Where things live

- `client/voidlib.js` holds the protocol rules: how a round is hashed, how draws and shuffles are derived, how receipts are checked. The node imports this same file, so a change here changes both sides at once.
- `client/qsim.js` is the circuit simulator.
- `client/forge-lib.js` is the Key Forge.
- `server/index.js` is the node and the HTTP API.
- `test/run.js` boots a node on a scratch data file and exercises everything.

## Ground rules

1. **A rule change is a protocol change.** If you alter how a round, a draw or a sample is computed, update the docs page and add a test that pins the new behaviour. Old rounds must keep verifying, or the version string in the hashed message must change.
2. **Every claim on the site must be checkable.** If a page shows a tick, the page has recomputed the result itself.
3. **Nothing is served twice.** Raw quantum bytes leave the reservoir once. Do not add a path that can replay them.
4. **No new runtime dependencies in the server** without a good reason. The server uses Node's standard library; the browser uses the audited `noble` and `scure` packages.
5. **Tests pass before you open a pull request.** They talk to the live quantum source and skip those checks cleanly when it is unreachable.

## Branches

- `main` is what the public node runs.
- `dev` is where work lands first. Open pull requests against `dev`.

## Commit messages

Start with the area, then say what changed: `beacon: reject stale NIST pulses`, `sim: add controlled-phase gate`, `docs: explain the commitment`.

## Reporting security issues

See [SECURITY.md](SECURITY.md). Please do not open a public issue for a vulnerability.
