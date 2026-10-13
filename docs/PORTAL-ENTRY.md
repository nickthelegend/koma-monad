# KOMA: portal entry

Paste each field in this order. Character counts are measured on the text as written here.
One live URL everywhere: **https://koma-comics.up.railway.app**

## Primary track
> Your project is judged in one track. Choose it before you add bounties.

Social, Attention & Culture

## Project details

### Logo
> PNG, JPG, or WEBP · Max 2 MB · At least 500 px · Up to 2000 × 2000 px

docs/brand/logo-portal.png (1024×1024, 20 KB)

### Name   (4 / 120)
KOMA

### Tagline   (83 / 200)
Fans own the comic and write the canon: AI episodes, voted on and settled on Monad.

### Description   (2637 / 8,000)
PROBLEM
Fans make characters famous, but they own nothing and get no say in what happens next. Creators get paid once, if
at all. Every fandom builds the story; none of them own it.

SOLUTION
KOMA turns a story into an economy that fans own:

- Make. Describe a comic. Tencent Hunyuan 3 (the editor) shapes the idea into a pitch, Kimi K2.6 writes the
  script and FLUX draws it. You pay 10¢ a page in AUSD with one signature (HTTP 402 / x402, no gas), and the issue is
  minted to you.
- Launch. For $1, its hero becomes a series: a Character NFT with its own ERC-6551 wallet, a 1B-supply coin on an
  AUSD bonding curve, and a canon. The character's wallet earns from every trade fee (40%, or 60% with no parent), and
  remixes pay royalties up the family tree. At its target, the curve graduates into a locked Uniswap v4 pool.
- Vote. Holders propose the next episode. Kimi reads the voted canon with a tool call before it writes. Holders vote
  for free with EIP-712 signatures weighted at a snapshot, and a Chainlink CRE workflow re-verifies every signature and
  weight and settles the winner on Monad.
- Writers' Room. Next week's twist stays encrypted to a passkey (Mera: one passkey, many keys), and each unlock is
  verified by Monad's P256 precompile.

WHY MONAD
Every vote, trade and payment is a transaction. That only works as a fan experience when it's instant and free:

- KOMA's relayer sends with eth_sendRawTransactionSync, so live buys executed in 133–450 ms and were final in under
  1 s. Receipts show both timers.
- In-flight transactions report txpool_statusByHash.
- /monad streams commit states (Proposed → Voted → Finalized → Verified) from Monad testnet.
- The relayer respects the 10 MON reserve rule with tight, limit-billed gas.
- Fans never hold MON: every action is a signature.

WHAT'S LIVE (Monad testnet)
The full loop runs with real signed transactions. The key ones:

| What | Tx |
|---|---|
| x402 launch | 0xe2fa666e…2d05 |
| Gasless buy | 0x2daa3fb7…0ee0d7 |
| Kimi-written episode mint | 0x6c4860be…874c |
| Chainlink CRE settles | 0x054895f6…587e, 0x63e90dcd…cd57 (5 verified votes), 0xffcf4bfb…c4df |

- Signal Fire's curve filled and graduated into a Uniswap v4 pool (pool id 0x806903d5…e08b, graduation tx [0x0795bf54…9e0e](https://testnet.monadvision.com/tx/0x0795bf547d92f03cc1256f14ef742c7c38ddf9e0219395111c70c8a11fef9e0e)).
- 14 core contracts are verified on Sourcify/MonadVision.
- Paid AI is capped per day and refused before payment.

Team-seeded activity, labelled as such: to show a contested round, team-controlled wallets bought, proposed and
voted (docs/evidence/seed-13oct.md).

### First users + how we reach them   (868 / 8,000)
FIRST USERS
- Webcomic and manga fandoms: readers who already theorize, ship and fan-write, and want a real say and a stake.
- Indie comic creators and webtoon artists: they want their characters to earn from the fandom they build, with
  remix royalties when others build on their world.

HOW WE REACH THEM?
- Creator-led launches. We onboard a handful of indie creators to launch their characters on KOMA, and each brings
  their community to vote on canon.
- Share cards and embeds. Every series has a live preview card (OG image) and a one-click <iframe> embed for a
  creator's site, Discord or link-in-bio.
- Episode reveals as a social moment. A settled round ends with "Episode N is canon", made for screenshots and
  sharing.
- Zero-friction entry. Privy sign-in (email, Google, passkey or wallet), no gas and no MON, so a fan's first
  action is a free vote.

### Repository
> Public, or shared with metropolis@hackathon.monad.xyz.

https://github.com/nickthelegend/koma-monad

## Demo and pitch

### Live URL
> Must run on Monad Mainnet or Testnet.

https://koma-comics.up.railway.app

### Demo video
> Show the working product, not slides or a code walkthrough. Up to 3 minutes.

Upload `docs/demo/koma-demo.mp4` (2:56) to YouTube (unlisted), Loom or Vimeo, then paste ONE video link. Don't paste a Drive folder.
[x] Let organizers show it publicly (your call)

### Pitch video
> Introduce your team, the problem you solve, and why you are building it. Up to 2 minutes.

Upload `docs/demo/koma-pitch.mp4` (1:16), then paste ONE video link.

### Judge testing instructions   (1647 / 8,000)
> Private to your team, judges, and organizers.

No login needed to look around: https://koma-comics.up.railway.app (Monad testnet, chain 10143). Browse the
series board, a series page (/s/1 Signal Fire: graduated into Uniswap v4, three canon episodes settled by Chainlink
CRE), any comic's reader, /monad (live commit states) and /receipts.

To try the full loop (free; you need no MON):
1. Connect wallet: Privy (email, Google or passkey) or any EVM wallet on Monad testnet.
2. Shelf → "Get 10,000 test AUSD": Agora's faucet, with KOMA paying the gas. There's a 60 s cooldown shared by
   everyone, and 3 claims per IP per day.
3. Create: type an idea; the editor (Hunyuan 3) pitches it in ~20 s. Then Pay 0.10 AUSD & draw (one
   signature). Kimi writes the issue, FLUX draws it, and it's minted to you in ~1–2 minutes.
4. Launch ($1): fill the form or pick a preset; a character sheet is drawn, and one transaction mints the NFT,
   wallet, coin and curve.
5. Buy ≥ $3 on any series: "Sign & buy, no gas". The receipt shows executed and final times; open Details for the
   block and gas.
6. Holding ≥ 1M coins, "Propose episode N": the studio writes an episode (0.30 AUSD/page), and it enters the canon
   vote. Vote with a free signature. Demo series' rounds last 5 minutes, then CRE or the keeper settles them.
7. /room: create a Writers' Room with a passkey; lock and reopen it to see "verified on chain by Monad's P256
   precompile".

Notes and caps:
- AI spend is capped per day (20 issues, 10 launches, 150 model calls). Over the cap, KOMA refuses before taking
  payment.
- Coins are testnet collectibles with no financial return.
- Some activity is team-seeded and labelled as such.

## Bounties

### Best workflow with CRE   (Chainlink)
**Describe how CRE is used as an orchestration layer**   (2118 chars)
KOMA's canon is decided by a Chainlink CRE workflow, not by KOMA's server. Holders of a series coin vote on the next episode with free EIP-712 signatures. The workflow cre/koma-canon (TypeScript, cron trigger) orchestrates the settlement end to end:
(1) HTTP capability with consensus: it fetches the due rounds and their signed votes from KOMA's public API (https://koma-comics.up.railway.app/api/canon/due), and refuses to run if KOMA serves a different registry or chain than its config;
(2) EVM read capability: for each round it reads CanonRegistry on Monad (slot end time, finalized flag, proposals, series config) and the character NFT's owner (the tie-breaker);
(3) it re-verifies every vote: it recovers each EIP-712 signature (domain "KOMA Canon" v1, chain 10143) and reads each voter's weight from the coin's ERC20Votes at the round's snapshot (votingPower). It drops non-proposals, bad signatures and zero-weight voters, and logs each drop;
(4) it tallies by weight (tie: the character owner's vote, else the earliest proposal) and computes the votes root, keccak256 of the counted votes sorted by voter;
(5) EVM write capability: it signs a report and writes it through the forwarder to CanonSettler (a ReceiverTemplate holding the registry's RELAYER_ROLE), which calls CanonRegistry.finalize per settlement.
So KOMA's server only lists the votes. The winner is a function of signatures and on-chain balances, delivered through Chainlink.
On Monad testnet we ran `cre workflow simulate koma-canon --target staging-settings --broadcast`, which delivers through Chainlink's MockKeystoneForwarder (0xB9F79d86…). It settled four rounds, including a contested one with 5 verified votes. A keeper fallback settles a round only if CRE hasn't within 15 minutes. DON deployment (cre account access) isn't done yet.
Code: cre/koma-canon/workflow.ts, cre/koma-canon/canon.ts, contracts/src/cre/CanonSettler.sol, contracts/src/CanonRegistry.sol. Tests: forge test --match-path test/cre/* (9/9) and npm run test:cre on a Monad fork. Write-up: https://github.com/nickthelegend/koma-monad/blob/main/docs/CHAINLINK-CRE.md

**Video (required, ≤ 2:00)**
`docs/demo/bounty-cre.mp4` (1:00): upload it and paste the link. It shows a real `cre workflow simulate koma-canon --target staging-settings --broadcast` run (terminal output replayed at its recorded timing, waits fast-forwarded with a chip): 4 verified votes, then the settle tx [0xd73ea019…0d2a](https://testnet.monadvision.com/tx/0xd73ea01980379dc499286330abceaf1850800978a16a76acb738f1119a380d2a). After that come the episode reveal in the app and the tx on Monad testnet.

**What we did**
- A CRE workflow (cron, HTTP and EVM read/write capabilities) settles every canon vote on Monad.
- Every EIP-712 vote is re-verified, and each weight is read at the snapshot from chain, inside the workflow.
- CanonSettler receives the report through the forwarder only, and finalizes in CanonRegistry with a votes root.
- Five settles ran live on Monad testnet, including a contested round with 5 verified votes.

**Evidence**
- [0x054895f6…587e](https://testnet.monadvision.com/tx/0x054895f670667690274759331cbb65bba0b34c9c31f691c87a52be9764a0587e): Signal Fire episode 1.
- [0x63e90dcd…cd57](https://testnet.monadvision.com/tx/0x63e90dcd958a40d64ea7c9de388533aeb23b4d5ab77a1dfe314143fea833cd57): episode 2, 5 verified votes, 62%.
- [0x16d3a3ad…f144a75](https://testnet.monadvision.com/tx/0x16d3a3ad75dd3ef84c2139dc325f919afe3f746f361cf23931308c5f5f144a75): episode 3.
- [0xffcf4bfb…c4df](https://testnet.monadvision.com/tx/0xffcf4bfb1a1be6df8dd51afbde4d08a4f2bc14221c3abd00339b995c67b6c4df): Ferry of Lost Things episode 1.
- [0xd73ea019…0d2a](https://testnet.monadvision.com/tx/0xd73ea01980379dc499286330abceaf1850800978a16a76acb738f1119a380d2a): Ferry of Lost Things episode 2, 4 verified votes (the run in the video).
- CanonSettler `0x5e307d014eb2d46B02cbed483a9fd32b23144825` (verified).
- Multi-vote rounds are team-seeded (labelled).

### Best Builds Powered by KIMI   (Moonshot)
**Published article describing how KIMI was used and what value KIMI brought to the project**
https://koma-comics.up.railway.app/blog/kimi

**What we did**
- Kimi K2.6 (Moonshot API) writes every comic script as structured JSON, which goes straight to drawing and minting.
- Kimi calls a get_series_canon tool to read the fan-voted canon before writing each episode, so votes change the story.
- Kimi writes the cached "Previously on…" recaps.

**Evidence**
- Episode 3 of Signal Fire ("Ada's Echo") credits writer kimi-k2.6 with tool call get_series_canon.
- Mint [0x6c4860be…874c](https://testnet.monadvision.com/tx/0x6c4860be7bcae73f7af6c993503ff1817ebebd91d30925806a34fe60ef82874c).
- The demo video at 0:46.

### Build with Hunyuan: Multimodal & Interactive Experiences   (Tencent)
**Published article link**
https://koma-comics.up.railway.app/blog/hunyuan

**What we did**
- Hunyuan 3 is the studio's interactive editor: a multi-turn chat that turns a one-line idea into a valid, priced comic pitch (title, synopsis, genre, style, pages, cast).
- Remixes and series episodes are pitched in context.
- Hunyuan Image 3 is integrated for character sheets and covers (HUNYUAN_IMAGE / HUNYUAN_COVERS). It was used on the fork, and is off on the live app to save credits.

**Evidence**
- https://koma-comics.up.railway.app/create ("Editor · Hunyuan 3").
- The demo video at 0:18.

### Mera: One Passkey, Many Keys   (Mera)
**Describe how Mera is used in non-account work (a PRF namespace)**   (1726 chars)
KOMA's Writers' Room (https://koma-comics.up.railway.app/room) uses Mera for non-account work: a PRF namespace that derives encryption and signing keys from one passkey. Holders draft next week's twist there before they pitch it, so drafts must stay private even from KOMA.
- One WebAuthn PRF evaluation under KOMA's own salt (sha256("koma.writers-room.v1"), never Mera's wallet salt), through createPasskeyWithPrfOutput / getPasskeyPrfOutput.
- HKDF with distinct info labels gives (a) an Ed25519 identity key in a Mera signing session (createEd25519SigningSession), whose public key is the room id and which signs every request, with no account, email or wallet address; and (b) a non-extractable AES-256-GCM key that encrypts each draft in the browser, with AAD bound to the room and draft ids.
- The server stores ciphertext only; unsigned or forged requests get a 401. The PRF bytes and seed are zeroed after derivation, and the session ends on lock or after 10 minutes.
- The same synced passkey on another device rebuilds the same room. Neither key is a wallet.
- Monad-native: a custom WebAuthnClient captures the passkey's P-256 public key and each unlock's assertion over a one-time server challenge. The server checks the challenge, origin and user-verification flag, then verifies the signature with Monad's P256VERIFY precompile (0x0100) by eth_call, live on Monad testnet. The room shows "Passkey verified on chain by Monad's P256 precompile (0x0100) · live on Monad testnet ✓".
Code: src/lib/room/keys.ts, src/lib/room/webauthn.ts, src/lib/server/passkey.ts. Tests: npm run test:room (R1–R4b, virtual WebAuthn authenticator with PRF). Write-up: https://github.com/nickthelegend/koma-monad/blob/main/docs/MERA.md

**Video (optional, ≤ 2:00)**
The demo video at 2:15 shows the Writers' Room unlock verified on chain. `docs/demo/bounty-mera.mp4` will be added if time allows.

**What we did**
- One passkey → PRF → HKDF gives an Ed25519 room identity and an AES-GCM draft key.
- The server is ciphertext-only.
- Each unlock is verified by Monad's P256 precompile, live on testnet.

**Evidence**
- https://koma-comics.up.railway.app/room
- The demo video at 2:15.
- npm run test:room.

## Optional promotion

### Promo video (≤ 30 s)
`docs/demo/koma-promo.mp4` (0:29): upload it and paste the link.

### X link
[you fill this in]
