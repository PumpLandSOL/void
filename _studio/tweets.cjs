// writes brand/X-KIT.md and checks every tweet is ≤245 characters.  node _studio/tweets.cjs
// Lead line everywhere: Quantum-as-a-Service (QaaS). User, 2026-11-16: "that is literally the main selling point".
// Voice: bullish and direct. Randomness is priced infrastructure; VOID is the quantum entry at day one.
// Comparisons use MARKET CAPS only (CoinGecko, 16 Nov 2026): Chainlink $6.98B, Pyth $424M, API3 $30.9M, Band $26.9M,
// QRL $73.8M, Qubic $49.0M, QANplatform $13.5M. Loss figures: Profanity about $160M (2022), Milk Sad about $900K (2023).
'use strict';
const fs = require('fs'), path = require('path'), len = (s) => [...s].length;
const L = require('./lib.cjs');
// set X and SITE in lib.cjs once the handle and the domain exist: tweets in LINK then carry the site link
const SITE = L.SITE ? 'https://' + L.SITE.replace(/^https?:\/\//, '') : '', HANDLE = L.X || '(handle not set yet)', NAME = 'VOID | $VOID';
const LINK = new Set(['Key art', 'QaaS', 'The round (video)', 'Fair draws', 'Key Forge (video)', 'Entropy API', 'Launch (fill CA)']);
const BIO = 'Quantum-as-a-Service for Web3. Real quantum entropy over an open API: a public beacon, private bytes, fair draws and a Key Forge. QaaS. $VOID';
const DEX = 'VOID is Quantum-as-a-Service (QaaS) for Web3: real quantum entropy over an open API. Its node pulls raw random bytes from a photonic quantum random number generator, mixes them with the NIST Randomness Beacon and drand, and publishes a signed, hash-chained beacon round every 10 seconds with every input printed, so anyone can recompute it. An open API serves private entropy with signed receipts, raw quantum bytes that are each delivered once, and provably fair draws and shuffles. The Key Forge builds a wallet in the browser from node entropy mixed with the device\'s own: a 24-word phrase, Ethereum and Solana addresses, and ML-DSA-65 and ML-KEM-768 post-quantum key pairs. The node never sees the keys.';
const T = [
['Pinned · hype (video)', 'void-hype-14s.mp4', `Every wallet you own started as one random number.

Most apps get it from a formula. VOID gets it from a photon and serves it over an API.

That's Quantum-as-a-Service. Randomness networks are worth billions, and this is the quantum one.

$VOID`],
['Key art', 'void-g01-keyart.png', `Chainlink is worth $6.98B. Pyth is worth $424M. Both sell randomness to Web3, and both make it with math.

VOID makes it with physics. Quantum-as-a-Service: real quantum hardware behind an open API, with a public beacon anyone can check.

$VOID`],
['QaaS', 'void-g13-qaas.png', `Quantum-as-a-Service, in one line: the quantum hardware is our problem and the result is your HTTP call.

Five services behind one API: a beacon, private entropy, raw quantum bytes, fair draws and a Key Forge. No key. No account.

$VOID`],
['The problem', 'void-g02-problem.png', `Weak randomness has already cost crypto real money.

One tool seeded keys from 32 bits and about $160M walked out. Another used the clock and lost about $900K.

VOID seeds keys from quantum measurements. Nothing to guess.

$VOID`],
['The price (video)', 'void-price-13s.mp4', `2013: Android wallets emptied. 2022: about $160M taken. 2023: about $900K taken.

Three hacks with one cause: a random number that wasn't random.

The fix isn't a better formula. It's no formula at all.

$VOID`],
['The source', 'void-g03-source.png', `The bytes behind VOID come out of a real machine: an ID Quantique photonic generator in a university lab, measuring single photons.

The node pulls 1,024 of them every 20 seconds and shows you the tests they pass.

$VOID`],
['The round (video)', 'void-round-14s.mp4', `Every 10 seconds VOID publishes a round: 32 quantum bytes, a NIST pulse, a drand round, one hash, one signature.

Every input is printed, so you can recompute the whole thing yourself.

$VOID`],
['A round is a receipt', 'void-g04-round.png', `If you can't recompute a random number, you're taking someone's word for it.

VOID shows its working. Each round prints what went in, is signed by the node and is chained to the one before. Check any of them in your browser.

$VOID`],
['Fair draws', 'void-g05-draw.png', `Running a raffle, a mint or an airdrop? Name a VOID round before it exists, pick a seed, then draw.

Nobody could have known the result, including us, and anyone can recompute it. That's what fair looks like.

$VOID`],
['Key Forge (video)', 'void-forge-13s.mp4', `The VOID Key Forge builds a wallet from quantum entropy mixed with your own device's.

24 words, an Ethereum address, a Solana address and two post-quantum key pairs, all made in your browser. The node never sees any of it.

$VOID`],
['Key Forge', 'void-g06-forge.png', `A wallet made on someone's server is a wallet they could have copied.

VOID sends you half the randomness and your device supplies the rest, so no server ever holds your key. Import the phrase into Phantom or Rabby and go.

$VOID`],
['Three sources', 'void-g07-vs.png', `There are three ways to get a random number on-chain.

Compute it from a formula. Take it from a block someone produced. Or measure it.

Only one of those leaves an attacker nothing to learn in advance.

$VOID`],
['Market cap (video)', 'void-mcap-13s.mp4', `The market already prices randomness.

Chainlink: $6.98B. Pyth: $424M. API3: $30.9M. Band: $26.9M.

VOID is on that chart at day one, with a live quantum beacon you can open right now.

$VOID`],
['Market cap', 'void-g08-mcap.png', `Randomness is infrastructure, and infrastructure gets valued.

The networks that sell it range from $26.9M to $6.98B in market cap today. VOID starts at the bottom of that ladder with the product already running.

$VOID`],
['The quantum names', 'void-g09-quantum.png', `What does the market pay for the word quantum?

QRL: $73.8M. Qubic: $49.0M. QANplatform: $13.5M.

VOID isn't selling the word. It serves real quantum bytes over an open API today, at day-one size.

$VOID`],
['Entropy API', 'void-g10-api.png', `This is what QaaS looks like: one call to VOID returns 32 bytes that nobody else will ever receive.

Fresh quantum bytes go into every response, the node signs a receipt, and you need no key to use it.

$VOID`],
['Roadmap', 'void-g11-roadmap.png', `Where VOID goes from here.

The node, the beacon and the Key Forge are live. Next: rounds posted on Solana for programs to read, a second quantum device and independent operators.

One node today. A network next.

$VOID`],
['Launch (fill CA)', 'void-g12-live.png', `$VOID is live on Solana.

Quantum-as-a-Service: a beacon round every 10 seconds, an open entropy API, wallets forged in your browser.

Chainlink sells randomness at a $6.98B market cap. This is day one.

CA:

$VOID`],
];
let md = `# VOID X kit\n\n## Handle\n\`\`\`\n${HANDLE}\n\`\`\`\n\n## Display name\n\`\`\`\n${NAME}\n\`\`\`\n\n## Bio (${len(BIO)}/160)\n\`\`\`\n${BIO}\n\`\`\`\n\n## DexScreener description\n\`\`\`\n${DEX}\n\`\`\`\n\n` + (SITE ? `## Website\n\`\`\`\n${SITE}\n\`\`\`\n\n` : '') + `## Profile images\n- Avatar: \`void-pfp.png\`\n- Header: \`void-banner.png\`\n- Share image: \`void-og.png\`\n\n## Tweets (all ≤245)\n`;
let bad = 0; T.forEach(([title, media, text0], i) => { const tail = '\n\n$VOID', text = SITE && LINK.has(title) && text0.endsWith(tail) ? text0.slice(0, -tail.length) + '\n\n' + SITE + tail : text0, n = len(text);
  if (n > 245) { bad++; console.log('TOO LONG', title, n); } if (!fs.existsSync(path.join(__dirname, '..', 'brand', media))) console.log('MISSING MEDIA', media);
  md += `\n### ${i + 1}. ${title} · ${n} chars · media: \`${media}\`\n\`\`\`\n${text}\n\`\`\`\n`; console.log(String(n).padStart(4), title); });
if (len(BIO) > 160) { bad++; console.log('BIO TOO LONG', len(BIO)); }
fs.writeFileSync(path.join(__dirname, '..', 'brand', 'X-KIT.md'), md); console.log(T.length, 'tweets', bad ? 'FAILED' : 'ok', 'bio', len(BIO)); process.exit(bad ? 1 : 0);
