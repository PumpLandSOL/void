// writes brand/X-KIT.md and checks every tweet is ≤245 characters.  node _studio/tweets.cjs
// v3 (2026-11-16, user: "hammering home the qaas narrative in most (not all) tweets and a bio").
// Quantum-as-a-Service is the story: 14 of the 19 tweets say it outright, the other 5 carry proof points.
// Voice: bullish and direct. Comparisons use MARKET CAPS only (CoinGecko, 16 Nov 2026): Chainlink $6.98B, Pyth $424M,
// API3 $30.9M, Band $26.9M, QRL $73.8M, Qubic $49.0M, QANplatform $13.5M. Losses: Profanity about $160M, Milk Sad about $900K.
'use strict';
const fs = require('fs'), path = require('path'), len = (s) => [...s].length;
const L = require('./lib.cjs');
const SITE = L.SITE ? 'https://' + L.SITE.replace(/^https?:\/\//, '') : '', HANDLE = L.X || '(handle not set yet)', NAME = 'VOID | QaaS | $VOID';
// tweets in LINK get the site link added before the ticker
const LINK = new Set(['What is in QaaS', 'Simulator', 'The round (video)', 'Fair draws', 'Entropy API', 'Launch (fill CA)']);
const BIO = 'Quantum-as-a-Service for Web3. One open API, six quantum services: beacon, entropy, raw quantum bytes, fair draws, simulator, Key Forge. QaaS. $VOID';
const DEX = 'VOID is Quantum-as-a-Service (QaaS) for Web3: real quantum hardware behind one open API. Its node pulls raw random bytes from a photonic quantum random number generator, mixes them with the NIST Randomness Beacon and drand, and publishes a signed, hash-chained beacon round every 10 seconds with every input printed, so anyone can recompute it. The same API serves private entropy with signed receipts, raw quantum bytes that are each delivered once, and provably fair draws and shuffles. A circuit simulator runs quantum circuits exactly and samples their measurements with quantum entropy. The Key Forge builds a wallet in the browser from node entropy mixed with the device\'s own: a 24-word phrase, Ethereum and Solana addresses, and ML-DSA-65 and ML-KEM-768 post-quantum key pairs. The node never sees the keys. No key and no account are needed to use any of it.';
const T = [
['Pinned · QaaS (video)', 'void-hype-14s.mp4', `AWS turned servers into a service. Stripe did it for payments.

VOID does it for quantum.

Quantum-as-a-Service: real quantum hardware behind one open API, live for Web3 today. No lab, no key, no account.

$VOID`],
['Key art', 'void-g01-keyart.png', `Web3 has compute as a service, storage as a service and data as a service.

It did not have quantum as a service. Now it does.

VOID is QaaS: six quantum services, one API, running today.

$VOID`],
['What is in QaaS', 'void-g13-qaas.png', `What's inside Quantum-as-a-Service?

A public beacon. Private entropy. Raw quantum bytes. Provably fair draws. A circuit simulator. A Key Forge.

Six services, one API, zero setup. That's VOID.

$VOID`],
['Simulator', 'void-g14-sim.png', `QaaS isn't only randomness. VOID runs quantum circuits too.

Build one in your browser, from a Bell pair to Grover search. When you measure, real photons pick the outcome.

$VOID`],
['The problem', 'void-g02-problem.png', `Weak randomness has already cost crypto real money.

One tool seeded keys from 32 bits and about $160M walked out. Another used the clock and lost about $900K.

The fix is a number nobody can guess. That's what VOID serves.

$VOID`],
['The price (video)', 'void-price-13s.mp4', `2013: Android wallets emptied. 2022: about $160M taken. 2023: about $900K taken.

Three hacks with one cause: a random number that wasn't random.

The fix isn't a better formula. It's no formula at all.

$VOID`],
['The source', 'void-g03-source.png', `Quantum-as-a-Service means the hardware is our problem.

Behind VOID sits a real photonic quantum generator measuring single photons. The node pulls 1,024 bytes every 20 seconds and tests every batch. You just call the API.

$VOID`],
['The round (video)', 'void-round-14s.mp4', `The first QaaS product is a beacon.

Every 10 seconds VOID publishes a round: 32 quantum bytes, a NIST pulse, a drand round, one hash, one signature. Every input is printed, so you can recompute it.

$VOID`],
['A round is a receipt', 'void-g04-round.png', `If you can't recompute a random number, you're taking someone's word for it.

VOID shows its working. Each round prints what went in, is signed by the node and is chained to the one before. Check any of them in your browser.

$VOID`],
['Fair draws', 'void-g05-draw.png', `QaaS for anyone running a raffle, a mint or an airdrop:

Name a VOID round before it exists, pick a seed, then draw. Nobody could have known the result, including us, and anyone can recompute it.

$VOID`],
['Key Forge (video)', 'void-forge-13s.mp4', `Quantum-as-a-Service, for your keys.

The VOID Key Forge builds a wallet from quantum entropy mixed with your own device's: 24 words, Ethereum, Solana and two post-quantum key pairs. The node never sees any of it.

$VOID`],
['Key Forge', 'void-g06-forge.png', `A wallet made on someone's server is a wallet they could have copied.

VOID sends you half the randomness and your device supplies the rest, so no server ever holds your key. Import the phrase into Phantom or Rabby and go.

$VOID`],
['Three sources', 'void-g07-vs.png', `There are three ways to get a random number on-chain.

Compute it from a formula. Take it from a block someone produced. Or measure it.

Only one of those leaves an attacker nothing to learn in advance.

$VOID`],
['Market cap (video)', 'void-mcap-13s.mp4', `The market already pays for services like this.

Chainlink: $6.98B. Pyth: $424M. API3: $30.9M. Band: $26.9M.

VOID is the Quantum-as-a-Service entry on that chart, and it's at day one.

$VOID`],
['Market cap', 'void-g08-mcap.png', `Selling randomness as a service built a $6.98B network in Web3.

Quantum-as-a-Service is the next category over: the same demand, with real quantum hardware behind the API. VOID is already shipping it.

$VOID`],
['The quantum names', 'void-g09-quantum.png', `QRL: $73.8M. Qubic: $49.0M. QANplatform: $13.5M.

That's what the market pays for a quantum narrative.

VOID is the QaaS one: real quantum bytes over an open API today, at day-one size.

$VOID`],
['Entropy API', 'void-g10-api.png', `This is what QaaS looks like: one call to VOID returns 32 bytes that nobody else will ever receive.

Fresh quantum bytes go into every response, the node signs a receipt, and you need no key to use it.

$VOID`],
['Roadmap', 'void-g11-roadmap.png', `The QaaS roadmap.

Live now: beacon, entropy, raw bytes, draws, simulator, Key Forge. Next: rounds on Solana for programs to read, a second quantum device and independent operators.

One node today. A network next.

$VOID`],
['Launch (fill CA)', 'void-g12-live.png', `$VOID is live on Solana.

Quantum-as-a-Service for Web3: six quantum services behind one open API, running today.

Chainlink sells randomness at a $6.98B market cap. This is day one.

CA:

$VOID`],
];
let md = `# VOID X kit\n\n## Handle\n\`\`\`\n${HANDLE}\n\`\`\`\n\n## Display name\n\`\`\`\n${NAME}\n\`\`\`\n\n## Bio (${len(BIO)}/160)\n\`\`\`\n${BIO}\n\`\`\`\n\n## DexScreener description\n\`\`\`\n${DEX}\n\`\`\`\n\n` + (SITE ? `## Website\n\`\`\`\n${SITE}\n\`\`\`\n\n` : '') + `## Profile images\n- Avatar: \`void-pfp.png\`\n- Header: \`void-banner.png\`\n- Share image: \`void-og.png\`\n\n## Tweets (all ≤245)\n`;
let bad = 0, qaas = 0; T.forEach(([title, media, text0], i) => { const tail = '\n\n$VOID', text = SITE && LINK.has(title) && text0.endsWith(tail) ? text0.slice(0, -tail.length) + '\n\n' + SITE + tail : text0, n = len(text);
  if (/qaas|quantum-as-a-service|quantum as a service/i.test(text)) qaas++;
  if (n > 245) { bad++; console.log('TOO LONG', title, n); } if (!fs.existsSync(path.join(__dirname, '..', 'brand', media))) console.log('MISSING MEDIA', media);
  md += `\n### ${i + 1}. ${title} · ${n} chars · media: \`${media}\`\n\`\`\`\n${text}\n\`\`\`\n`; console.log(String(n).padStart(4), title); });
if (len(BIO) > 160) { bad++; console.log('BIO TOO LONG', len(BIO)); }
fs.writeFileSync(path.join(__dirname, '..', 'brand', 'X-KIT.md'), md); console.log(T.length, 'tweets', bad ? 'FAILED' : 'ok', '· QaaS in', qaas, '· bio', len(BIO)); process.exit(bad ? 1 : 0);
