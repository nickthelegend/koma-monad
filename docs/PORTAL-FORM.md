# KOMA: the portal form (hackathon.monad.xyz → "Complete your entry")

Every field is in the portal's order and within its limit. Paste it straight in. Fields marked **[you]** are yours to fill.

---

### 1. Primary track
**03 · Social, Attention & Culture**

### 2. Logo
`docs/brand/logo-portal.png` (1024×1024 PNG, 20 KB)

### 3. Project name
KOMA

### 4. Tagline
Fans own the comic and write the canon: AI episodes, voted on and settled on Monad.

### 5. Description

**PROBLEM**
Fans make characters famous, but they own nothing and get no say in what happens next. Creators get paid once, if
at all. Every fandom builds the story; none of them own it.

**SOLUTION**
KOMA turns a story into an economy that fans own:

- **Make.** Describe a comic. Tencent Hunyuan 3 (the editor) shapes the idea into a pitch, Kimi K2.6 writes the
  script and FLUX draws it. You pay 10¢ a page in AUSD with one signature (HTTP 402 / x402, no gas), and the issue is
  minted to you.
- **Launch.** For $1, its hero becomes a series: a Character NFT with its own ERC-6551 wallet, a 1B-supply coin on an
  AUSD bonding curve, and a canon. The character's wallet earns from every trade fee (40%, or 60% with no parent), and
  remixes pay royalties up the family tree. At its target, the curve graduates into a locked Uniswap v4 pool.
- **Vote.** Holders propose the next episode. Kimi reads the voted canon with a tool call before it writes. Holders vote
  for free with EIP-712 signatures weighted at a snapshot, and a Chainlink CRE workflow re-verifies every signature and
  weight and settles the winner on Monad.
- **Writers' Room.** Next week's twist stays encrypted to a passkey (Mera: one passkey, many keys), and each unlock is
  verified by Monad's P256 precompile.

**WHY MONAD**
Every vote, trade and payment is a transaction. That only works as a fan experience when it's instant and free:

- KOMA's relayer sends with `eth_sendRawTransactionSync`, so live buys executed in 133–450 ms and were final in under
  1 s. Receipts show both timers.
- In-flight transactions report `txpool_statusByHash`.
- `/monad` streams commit states (Proposed → Voted → Finalized → Verified) from Monad testnet.
- The relayer respects the 10 MON reserve rule with tight, limit-billed gas.
- Fans never hold MON: every action is a signature.

**WHAT'S LIVE (Monad testnet)**
The full loop runs with real signed transactions. The key ones:

| What | Tx |
|---|---|
| x402 launch | `0xe2fa666e…2d05` |
| Gasless buy | `0x2daa3fb7…0ee0d7` |
| Kimi-written episode mint | `0x6c4860be…874c` |
| Chainlink CRE settles | `0x054895f6…587e`, `0x63e90dcd…cd57` (5 verified votes), `0xffcf4bfb…c4df` |

- Signal Fire's curve filled and **graduated into a Uniswap v4 pool** (pool id `0x806903d5…e08b`).
- 14 core contracts are verified on Sourcify/MonadVision.
- Paid AI is capped per day and refused before payment.

**Team-seeded activity, labelled as such:** to show a contested round, team-controlled wallets bought, proposed and
voted (`docs/evidence/seed-13oct.md`).

### 6. First users, and how we reach them

**First users:**
- **Webcomic and manga fandoms:** readers who already theorize, ship and fan-write, and want a real say and a stake.
- **Indie comic creators and webtoon artists:** they want their characters to earn from the fandom they build, with
  remix royalties when others build on their world.

**How we reach them:**
- **Creator-led launches.** We onboard a handful of indie creators to launch their characters on KOMA, and each brings
  their community to vote on canon.
- **Share cards and embeds.** Every series has a live preview card (OG image) and a one-click `<iframe>` embed for a
  creator's site, Discord or link-in-bio.
- **Episode reveals as a social moment.** A settled round ends with "Episode N is canon", made for screenshots and
  sharing.
- **Zero-friction entry.** Privy sign-in (email, Google, passkey or wallet), no gas and no MON, so a fan's first
  action is a free vote.

### 7. Repo URL
https://github.com/nickthelegend/koma-monad

### 8. Live app URL
https://koma-comics.up.railway.app

### 9. Demo video (≤ 3:00, the working product)
Upload **`docs/demo/koma-demo.mp4`** (2:56) to YouTube or Loom (unlisted is fine) and paste the link.

It's one live take on Monad testnet:
- Privy sign-in;
- a comic over x402 (Hunyuan, Kimi, FLUX);
- a series launch;
- a gasless buy (two timers);
- a Kimi episode;
- votes;
- /monad commit states;
- the Chainlink CRE settle;
- the reveal;
- the Writers' Room with the P256 badge;
- graduation into Uniswap v4.

Waits are fast-forwarded with a visible "⏩ ×N" chip. There are no slides.

### 10. Pitch video (≤ 2:00)
Upload **`docs/demo/koma-pitch.mp4`** (1:16): hook → team → problem → why now → make / launch / vote → proof → who
it's for and how we reach them → close.

Team: **[you]** The pitch says "a small team of comic readers and Monad builders" and names no one. Replace or
record the team line if you want names in it.

### 11. Testing instructions for judges

**No login needed to look around:** https://koma-comics.up.railway.app (Monad testnet, chain 10143). Browse the
series board, a series page (/s/1 Signal Fire: graduated into Uniswap v4, three canon episodes settled by Chainlink
CRE), any comic's reader, /monad (live commit states) and /receipts.

**To try the full loop (free; you need no MON):**
1. **Connect wallet:** Privy (email, Google or passkey) or any EVM wallet on Monad testnet.
2. **Shelf → "Get 10,000 test AUSD":** Agora's faucet, with KOMA paying the gas. There's a 60 s cooldown shared by
   everyone, and 3 claims per IP per day.
3. **Create:** type an idea; the editor (Hunyuan 3) pitches it in ~20 s. Then **Pay 0.10 AUSD & draw** (one
   signature). Kimi writes the issue, FLUX draws it, and it's minted to you in ~1–2 minutes.
4. **Launch ($1):** fill the form or pick a preset; a character sheet is drawn, and one transaction mints the NFT,
   wallet, coin and curve.
5. **Buy ≥ $3 on any series:** "Sign & buy, no gas". The receipt shows executed and final times; open Details for the
   block and gas.
6. **Holding ≥ 1M coins, "Propose episode N":** the studio writes an episode (0.30 AUSD/page), and it enters the canon
   vote. Vote with a free signature. Demo series' rounds last 5 minutes, then CRE or the keeper settles them.
7. **/room:** create a Writers' Room with a passkey; lock and reopen it to see "verified on chain by Monad's P256
   precompile".

**Notes and caps:**
- AI spend is capped per day (20 issues, 10 launches, 150 model calls). Over the cap, KOMA refuses before taking
  payment.
- Coins are testnet collectibles with no financial return.
- Some activity is team-seeded and labelled as such.

### 12. Bounties

**Kimi (Moonshot)**
- **How it's used:** Kimi K2.6 (Moonshot API) writes every script, and calls a `get_series_canon` tool to read the
  voted canon before writing an episode. It also writes the "Previously on…" recaps (cached per episode).
- **Code:** `src/lib/server/ai.ts`, `src/lib/server/providers.ts`, `src/lib/server/launchpad/recap.ts`.
- **Evidence:**
  - episode minted in `0x6c4860be7bcae73f7af6c993503ff1817ebebd91d30925806a34fe60ef82874c`;
  - the issue page credits "Written by Kimi K2.6 (read the series canon first)";
  - the demo video at 0:46.

**Tencent Hunyuan**
- **How it's used:** Hunyuan 3 is the studio's editor. It turns a one-line idea into a structured pitch (title,
  genre, style, pages, price), which becomes a valid paid order.
- **Code:** `src/lib/server/chat.ts`, `src/components/studio/chat-studio.tsx`.
- **Evidence:** /create, labelled "Editor · Hunyuan 3"; the demo video at 0:18.

**Chainlink CRE**
- **How it's used:** the `cre/koma-canon` workflow reads KOMA's due canon slots, re-verifies every EIP-712 vote and
  snapshot weight on Monad, and delivers a report through the forwarder to `CanonSettler`, which finalizes the winner
  and its votes root.
- **Code:** `cre/koma-canon/`, `contracts/src/CanonSettler.sol`.
- **Evidence (Monad testnet, `cre workflow simulate --broadcast` via Chainlink's MockKeystoneForwarder):**
  - `0x054895f670667690274759331cbb65bba0b34c9c31f691c87a52be9764a0587e`;
  - `0x63e90dcd958a40d64ea7c9de388533aeb23b4d5ab77a1dfe314143fea833cd57` (5 verified votes, contested 62%);
  - `0xffcf4bfb1a1be6df8dd51afbde4d08a4f2bc14221c3abd00339b995c67b6c4df`.

  Each series page shows "Settled by Chainlink CRE".

**Mera (One Passkey, Many Keys)**
- **How it's used:** in the Writers' Room, one passkey → WebAuthn PRF → HKDF gives an Ed25519 room identity and an
  AES-GCM draft key. Drafts are encrypted in the browser and the server stores only ciphertext. Each unlock's ES256
  passkey signature is verified on chain by Monad's P256VERIFY precompile (0x0100).
- **Code:** `src/lib/room/`, `src/lib/server/passkey.ts`.
- **Evidence:**
  - /room shows "Passkey verified on chain by Monad's P256 precompile (0x0100) · live on Monad testnet ✓";
  - the demo video at 2:15;
  - `test:room`.

**Privy** *(built; live login needs the origin allow-listed in the Privy dashboard)*
- **How it's used:** Privy is the sign-in (email, Google, passkey, external wallet) on the live app. The backer
  autopilot uses a Privy session signer under a policy; the key quorum is created on the app.
- **Code:** `src/components/wallet.tsx`, `src/lib/server/autopilot/`, `scripts/privy-setup.mjs`.
- **Evidence:** the "Connect wallet" modal on the live app; the demo video at 0:10.

**Envio** *(built; hosted indexing pending)*
- **How it's used:** an Envio HyperIndex indexer for the leaderboard (volume, top series, backers), with a parity test
  against KOMA's own index.
- **Code:** `indexer/`.
- **Evidence:** `test:envio` (local). The live board uses KOMA's own index until Envio Cloud hosting is set up.

### 13. Promo clip (optional, ≤ 0:30)
`docs/demo/koma-promo.mp4`

### 14. X link
**[you]**
