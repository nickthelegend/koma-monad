# KOMA — Monad Metropolis submission

| | |
|---|---|
| **Project** | KOMA: comics fans own, and characters whose stories their holders write |
| **Track** | **03 · Social, Attention & Culture** |
| **Network** | Monad testnet (10143). *Not deployed yet; awaiting the owner's go ([runbook](docs/DEPLOY-LATER.md)). Today everything runs on an anvil fork of Monad testnet with `npm run demo`: real contracts, Agora's real AUSD, real AI models, no mocks.* |
| **Live app** | `TODO after deploy` |
| **Repo** | https://github.com/nickthelegend/koma-monad (MIT) |
| **Demo video (≤ 3 min)** | `TODO` (script below) |
| **Judge login** | None needed: connect any wallet (or Privy email once keys are set) and tap **Get 10,000 test AUSD** |

## One paragraph

KOMA turns fandom into ownership. Describe a story: an AI editor (Tencent Hunyuan 3) shapes it into a pitch, Kimi
K2.6 writes it and fal draws it, and for a few cents of AUSD on Monad (one signature, no gas) the issue is minted to
you. Launch its hero as a series and the character becomes an economy: a Character NFT with its own wallet that
earns 40% of every trade, a coin on an AUSD curve, and a canon that holders write together. They propose episodes
(Kimi reads the voted canon before writing each one), vote for free, and a Chainlink CRE workflow settles the
winner on Monad. Envio powers the leaderboard, Privy lets backers put their votes and buys on autopilot under a
policy, and Mera passkeys keep next week's twist encrypted in the Writers' Room until it's pitched.

## Portal fields (copy-paste)

| Field | Value |
|---|---|
| Project name | KOMA |
| Tagline | AI comics you own, and characters whose canon their holders write, on Monad. |
| Track | 03 · Social, Attention & Culture |
| Bounties | Tencent Hunyuan · Kimi · Privy · Envio · Chainlink CRE · Mera (One Passkey, Many Keys) (+ Community Team if applicable) |
| Repo | https://github.com/nickthelegend/koma-monad |
| Live URL | `TODO after deploy` |
| Contract addresses | `TODO after deploy`: `deploy/addresses.10143.json` |
| Demo video | `TODO` |
| Pre-existing work | KOMA's comic pipeline, x402 payments, launchpad contracts and UI were first built for Arbitrum (29 Sep – 4 Oct 2026, another hackathon). The Monad port and every sponsor integration were built 5–6 Oct 2026. See README → "Built in the Metropolis window". |
| AI tools | Claude Code wrote most of the code, tests and docs under the author's direction. At runtime: Kimi K2.6, Hunyuan 3, Hunyuan Image 3, FLUX.2. |

## Bounties targeted

Status: built and verified on the local fork. What each still needs is in [docs/SPONSOR-GAP.md](docs/SPONSOR-GAP.md).

| Bounty | How KOMA meets the stated requirement | Evidence |
|---|---|---|
| **Tencent Hunyuan** (T3: "a multimodal or interactive experience genuinely powered by Hunyuan") | **Interactive:** Hunyuan 3 is the studio's editor. You talk your idea through and it answers with a priced, valid pitch you can pay for. **Multimodal:** Hunyuan Image 3 draws every series' character sheet, and that sheet keeps the hero on model in every episode; it also draws issue covers. Both are in the core path; nothing is drawn or pitched without them. | `test:ai` A1–A3; `test:browser` W2 (real Hunyuan pitch → paid → minted), W3 (the issue page credits "Art by Hunyuan Image 3"), W6 (a real launch's Hunyuan sheet) |
| **Kimi** ("genuinely powered by Kimi") | Kimi K2.6 writes every comic. For a series episode it runs an agentic tool loop: it calls `get_series_canon` to read what holders voted into canon, then writes the episode to continue it. Every issue records the model and tool calls, and its page shows them. | `test:ai` A3/A4: credits on real issues (`moonshotai/kimi-k2.6`, tool calls `get_series_canon`) |
| **Privy** ("beyond authentication"; bonus for multiple features) | (1) **Embedded wallets** as the account layer (email, Google, passkey). (2) **Native gas sponsorship**: the embedded wallet's own transactions go out with `sponsor: true`. (3) **Session signer + policy engine**: the backer autopilot adds KOMA's key quorum to your wallet with a default-deny policy that allows only canon votes on that series and AUSD `ReceiveWithAuthorization` to that curve, capped per buy. KOMA's server then votes and buys for you while you're away, and Privy enforces the policy. | Policy unit tests; build compiles; `test:autopilot` P0. **Live run needs the Privy app credentials** |
| **Envio** (HyperIndex powering a core feature; derived/aggregated entities) | A HyperIndex V3 indexer over 9 contracts. It registers curves and coins dynamically and derives series aggregates (volume, buys and sells, fee split character / ancestors / treasury, holders, canon count), a backer leaderboard, daily volume and close, canon rounds (including which were settled by CRE), comics and global stats. The **/series leaderboard** reads it over GraphQL. | `test:envio` 7/7: synced to head; parity with chain and app on every series; a live trade indexed in < 5 s; the board served from Envio |
| **Chainlink CRE** ("a workflow used as an orchestration layer") | `koma-canon` is the settlement layer for canon. A cron trigger reads due slots and signed votes over HTTP (identical-bytes consensus). EVM reads on Monad check each slot, its proposals and the character owner. Every EIP-712 vote is recovered and its weight re-read at the snapshot. KOMA's tie rules then pick the winner, and `writeReport` sends it to `CanonSettler`, a `ReceiverTemplate` that holds the registry's relayer role and calls `finalize`. The server's keeper is only a fallback. | `bun test` 8/8; WASM compile; `forge test` CanonSettler 9/9; `test:cre` 7/7: real votes on the fork are settled through the MockKeystoneForwarder, the on-chain votes root equals the keeper's, and the UI shows "Settled by Chainlink CRE". **`cre workflow simulate` needs `cre login`** |
| **Mera: One Passkey, Many Keys** (non-wallet use of PRF; namespaced salts; nothing sensitive persisted; cross-device) | The **Writers' Room** (`/room`). A KOMA-specific PRF salt (`koma.writers-room.v1`, never the wallet salt) goes through HKDF into an Ed25519 identity (a Mera signing session; its public key is the room id and it signs every request) and an AES-256-GCM key that encrypts each draft, bound by AAD to its room and draft. The server holds only ciphertext under a room id unlinked to any wallet. Keys live in memory and are zeroed on lock (10 min) or when you leave. "Take the pitch to the studio" hands a draft over in-tab, never in a URL. | `test:room` 7/7 (virtual PRF authenticator): ciphertext-only DB, forged requests 401, wiped storage → the same room is rebuilt and decrypted, another passkey → another room. **Cross-device on two real devices pending** |

**Also integrated (no separate bounty):** Agora AUSD is the currency of every payment, curve, pool and fee
(EIP-3009, permit), and the faucet in the app calls Agora's faucet contract.

**Not claimed:** Mera UX (Privy is the account layer), Dynamic, Kuru, Perpl, MetaMask, Agora (T1/T2), Alchemy,
Nansen.

## Monad integration (Monad-native)

Every vote, trade, payment and launch is a Monad transaction or an EIP-712 signature settled by one, relayed
gaslessly. Beyond that, KOMA uses what only Monad has. Each item says where it runs; the full table is in
`docs/ROADMAP-WIN.md` → "Monad-native coverage".

| Monad-native | KOMA | Where it runs |
|---|---|---|
| `monadNewHeads` / `monadLogs` commit states | `/monad`: Monad testnet's block pipeline live (Proposed → Voted ~280 ms → Finalized ~560 ms → Verified ~1.4 s, measured in the browser) and a live AUSD tape with commit states | live testnet read |
| P256VERIFY precompile `0x0100` | Every Writers' Room unlock's passkey signature, over a one-time server challenge, verified with `eth_call` on KOMA's chain and live on Monad testnet; `/monad` verifies a fresh signature each refresh and rejects a tampered one | built + live read |
| Fast receipts and finality | Two-timer receipts on every KOMA transaction (executed / final), with block, gas and the Ethereum cost of that gas | built (fork: executed only, labelled) |
| Gas billed on the limit; 10 MON reserve (`0x1001`) | Explicit rounded gas limits; the relayer refuses relays that would break the reserve rule | built |
| Staking precompile `0x1000` | `getEpoch()` live | live read (no MON to delegate) |
| x402 on Monad | AUSD settlement via KOMA's facilitator; switchable to Monad's hosted facilitator, which verified a signed AUSD authorization live | built; settlement through it awaits the testnet go |
| Canonical contracts; Uniswap v4 | Permit2, Multicall3, ERC-6551, x402 proxy, CreateX, EntryPoint, WMON checked on KOMA's chain; v4 deployed by the deploy script on testnet, where it's missing | built |
| 300 ms blocks (MIP-12) | KOMA's chain definitions and copy say 300 ms / ~600 ms finality (viem still says 400) | built |

## Evidence

Full run on 6 Oct 2026 on a **clean** local deployment (`npm run demo` from an empty `.data`), Monad testnet fork, real models. Live tx hashes get added after the deploy:

| Suite | Result |
|---|---|
| `forge test` (unit + fuzz) | 168 passed |
| `forge test` fork (live Monad testnet state) | 5 passed |
| `bun test` (CRE workflow) + WASM compile | 8 passed, compiled |
| `npm run test:unit` | 6 passed |
| `test:api` (x402 + issues, real models) | 13/13 |
| `test:launchpad` (launch → trade → canon → graduate) | 18/18 |
| `check-economics` (fees, royalties, pool on chain) | 9/9 |
| `test:ai` (real Kimi / Hunyuan, credits, episode tool call) | 4/4 |
| `test:cre` (CRE settlement) | 7/7 |
| `test:envio` (indexer) | 7/7 |
| `test:room` (Mera + P256 on chain) | 8/8 (+1 skipped: cross-device) |
| `test:browser` (UI flows, real signatures) | 8/8 |
| `test:walk` (16 pages at 375 px) | 16/16 |
| `test:monad` (Monad-native, live testnet reads) | 5/5 |
| `test:speed` (two-timer receipts) | 4/4 |
| `test:reader` (page turns, guided, full screen; desktop + 390 px) | 12/12 |
| `test:timeline` (canon timeline) | 3/3 |
| `test:home` (first 60 seconds, presets, board curation; desktop + 390 px) | 8/8 |
| `test:share` (series share card, 1200×630 OG image) | 3/3 |
| `test:wave2` (creator page, new-wallet shelf + real faucet, episode reveal, remix tree; desktop + 390 px) | 8/8 |
| `test:autopilot` | P0 pass (honestly off); P1–P6 untested (Privy keys) |
| lint, typecheck (`next build`), slither | clean; slither 8 low/medium findings triaged (see `docs/TEST-PLAN-ZERO-MOCK.md`) |
| secret scan (13 real secrets checked against the whole history and tree) | none found |

## Demo script (3:00)

| Time | Shot | Say |
|---|---|---|
| 0:00 | Home: "Fans write the canon.", the live numbers and who-makes-what strip | "KOMA: comics where fans own the character and vote its canon. On Monad." |
| 0:10 | `/monad`: Monad testnet's block pipeline, blocks turning Voted → Finalized → Verified with live milliseconds | "That's Monad right now: 300 ms blocks, final in about 600 ms. Every KOMA vote and trade rides on this." |
| 0:25 | `/create`: an idea → the editor (labelled Hunyuan 3) answers with a pitch | "Tencent's Hunyuan 3 is the editor. Talk it through and it pitches the issue." |
| 0:40 | Pay 0.10 AUSD: one signature, no gas; panels ink in; the speed receipt | "One AUSD signature, settled on Monad by x402, no gas. Kimi K2.6 writes; fal draws." |
| 1:00 | The reader in guided mode on a phone: panel by panel, swipe | "Read it panel by panel, like a real comic app." |
| 1:15 | `/launch`: a preset, the Hunyuan Image 3 character sheet, launch | "A dollar launches the hero as a series: a character with its own wallet, and a coin." |
| 1:35 | Series page: a $3 gasless buy → "Executed in 3xx ms · gas paid by KOMA · ≈ $X on Ethereum today" | "One signature, no gas. Forty percent of every fee goes to the character's wallet." |
| 1:55 | Propose (Kimi read the canon: `get_series_canon` in the credits) → vote | "Holders write the canon. Kimi reads what's been voted before it writes the next episode." |
| 2:10 | `cre workflow simulate … --broadcast`, MonadVision tx; the canon timeline: "Settled by Chainlink CRE" with its tx | "Chainlink CRE re-checks every signature and weight on Monad and settles the winner. Here's the story so far." |
| 2:28 | The splash: "Episode 2 is canon", 67% of the vote, settled by Chainlink CRE; tap the creator's name → `/creator` earnings | "The fans pick it, and the creator's characters get paid." |
| 2:35 | `/room`: passkey → "verified on chain by Monad's P256 precompile · live on testnet ✓" | "Next week's twist stays secret, encrypted to a passkey, and Monad's P256 precompile verifies that passkey on chain." |
| 2:50 | Leaderboard ("Indexed by Envio"), back to home | "KOMA. Fans write the canon." |
