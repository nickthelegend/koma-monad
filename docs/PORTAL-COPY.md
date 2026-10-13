# Portal copy: hackathon.monad.xyz (paste-ready)

## Project name
KOMA

## Tagline (≤ 80 chars)
Fans own the comic and write the canon: AI episodes, voted and settled on Monad.

## Short description (≤ 280 chars)
KOMA turns comic fandom into ownership on Monad. Make an AI comic for 10¢ a page (one AUSD signature, no gas),
launch its hero as a character with its own wallet and coin, and let holders vote on each next episode. Chainlink
CRE settles the canon on chain.

## Full description

**Problem.** Fans make characters famous but own nothing and decide nothing. Creators get paid once, if at all.

**Solution.** In KOMA, a story becomes an economy:
- **Make an issue** (10¢ a page; an episode proposed into a series is 30¢ a page). Tencent Hunyuan 3 shapes your idea into a pitch, Kimi K2.6 writes the script, and FLUX draws it.
  You pay a few cents of AUSD over x402 with one signature and no gas, and the issue is minted to you.
- **Launch the hero as a series ($1).** It gets a Character NFT with its own ERC-6551 wallet, a 1B-supply coin on an AUSD
  bonding curve, and a canon. The character's wallet earns 40% of every trade fee (60% for an original with no parent, which keeps the remix share), and remixes pay royalties up the
  family tree.
- **Fans write the canon.** Holders propose the next episode; Kimi reads the voted canon with a tool call before
  writing it. Holders vote for free with a signature. A Chainlink CRE workflow re-verifies every signature and
  snapshot weight on Monad and settles the winner.
- **Graduation.** At its target, the curve graduates into a locked Uniswap v4 pool.
  Live: Signal Fire's curve filled and graduated into a Uniswap v4 pool (pool id `0x806903d5…e08b`).
- **Writers' Room.** Next week's twist stays encrypted in a Mera passkey Writers' Room.

**Why Monad.** Every vote, trade and payment is a transaction. That only works as a fan experience when it's instant
and nearly free:
- KOMA's relayer sends with `eth_sendRawTransactionSync`. A live buy executed in **133 ms** and was final in
  **800 ms**. Across all of KOMA's live transactions, the median is about 444 ms executed and about 1.1 s final, shown on
  `/monad` and `/receipts`.
  "Executed" is measured by the relayer from the send to the receipt that the sync call returns. "Final" is when
  the `finalized` tag reaches that block. Block timestamps are whole seconds, so they can't show this.
- Receipts show both timers.
- `/monad` streams the commit states (Proposed → Voted → Finalized → Verified).
- Passkey signatures are verified by Monad's P256 precompile.
- The relayer respects the 10 MON reserve rule with tight, limit-billed gas.

**What's live.** The core loop ran on Monad testnet with real signed transactions: x402 launch → gasless buy →
Kimi-written episode → vote → Chainlink CRE settlement.
- Votes are off-chain EIP-712 signatures that CRE re-verifies. The settle tx commits their Merkle root on chain.
- Verified on Sourcify: the 14 core contracts (KOMA's 11 plus Uniswap v4), and series #1's coin, curve and vesting
  wallet. Its character wallet is an ERC-6551 proxy to the verified AccountProxy.
- Team-seeded, and labelled so: 5 wallets, 2 series, and a contested episode 2 that CRE settled from 5 verified votes ([0x63e90dcd…cd57](https://testnet.monadvision.com/tx/0x63e90dcd958a40d64ea7c9de388533aeb23b4d5ab77a1dfe314143fea833cd57); `docs/evidence/seed-13oct.md`).
- Graduation is live: Signal Fire graduated into Uniswap v4 (pool id `0x806903d5…e08b`). Remix royalties are built and fork-tested; no live remix yet.

## Track
03 · Social, Attention & Culture

## Bounties

| Bounty | What we built | Where | Proof |
|---|---|---|---|
| **Kimi (Moonshot)** | Kimi K2.6 writes every script. It calls a `get_series_canon` tool to read the voted canon first, and writes the "Previously on…" recaps | `src/lib/server/ai.ts`, `providers.ts` | episode mint [0x6c4860be…874c](https://testnet.monadvision.com/tx/0x6c4860be7bcae73f7af6c993503ff1817ebebd91d30925806a34fe60ef82874c); credits on the issue page |
| **Tencent Hunyuan** | Hunyuan 3 is the studio's editor (idea → pitch, JSON) | `/create`, `src/lib/server/ai.ts` | `test:ai`; "Editor · Hunyuan 3" in the studio |
| **Chainlink CRE** | `cre/koma-canon` re-verifies every EIP-712 vote and snapshot weight, then settles the winner through `CanonSettler` | `cre/`, `contracts/src/CanonSettler.sol` | settle [0x054895f6…587e](https://testnet.monadvision.com/tx/0x054895f670667690274759331cbb65bba0b34c9c31f691c87a52be9764a0587e) |
| **Mera (One Passkey, Many Keys)** | One passkey → WebAuthn PRF → an Ed25519 identity key plus an AES draft key. The server stores only ciphertext. Each unlock's passkey signature is checked with P256VERIFY (0x0100) by `eth_call` | `/room`, `src/lib/room/` | `test:room` R1–R4b (fork, virtual authenticator). Try `/room` with a passkey on the live app; `/monad` shows the live precompile check |
| **Privy** *(built, not live yet)* | Account layer, plus the backer autopilot as a Privy session signer under a policy | `src/lib/server/autopilot/`, `scripts/privy-setup.mjs` | The key quorum is created on the app. Live login waits for the owner to allow-list the origin, so we don't claim it as working |
| **Envio** *(built, local only)* | HyperIndex indexer for the `/series` leaderboard (volume, top series, backers) | `indexer/` | `test:envio` parity on the fork. The live board reads KOMA's own index until Envio Cloud hosting is set up |
| Agora AUSD (payments) | Every payment and trade is in AUSD (EIP-3009 + permit) | everywhere | launch [0xe2fa666e…2d05](https://testnet.monadvision.com/tx/0xe2fa666e80c40503be3a753ed18c61566cb9c568fe1e311d5f3794fb16582d05) |

## Links
- Demo video (≤3:00): `docs/demo/koma-demo.mp4` (2:56). Upload it to YouTube/Loom and paste the link.
- Pitch video (≤2:00): `docs/demo/koma-pitch.mp4` (1:16)
- Full walkthrough: `docs/demo/koma-walkthrough.mp4` (4:00)
- Repo: https://github.com/nickthelegend/koma-monad (MIT)
- Live app: https://koma-comics.up.railway.app

## Contracts (Monad testnet 10143; all verified on MonadVision)

| Contract | Address |
|---|---|
| SeriesFactory | [0x7e413097F12eB49f26bBf8bc5F1a7fcf38370431](https://testnet.monadvision.com/address/0x7e413097F12eB49f26bBf8bc5F1a7fcf38370431) |
| KomaIssues | [0x4e4Bad3f390A55F4F5f10F4c6f5E867B2F0B77A5](https://testnet.monadvision.com/address/0x4e4Bad3f390A55F4F5f10F4c6f5E867B2F0B77A5) |
| CanonRegistry | [0x6ee09Bc9ad42EdD588C97AcC4eb1665f080455ea](https://testnet.monadvision.com/address/0x6ee09Bc9ad42EdD588C97AcC4eb1665f080455ea) |
| CanonSettler (CRE receiver) | [0x5e307d014eb2d46B02cbed483a9fd32b23144825](https://testnet.monadvision.com/address/0x5e307d014eb2d46B02cbed483a9fd32b23144825) |
| CharacterNFT | [0x654B3A435e6d8E6128FD20159aCb4d4E787cb00B](https://testnet.monadvision.com/address/0x654B3A435e6d8E6128FD20159aCb4d4E787cb00B) |
| Uniswap v4 PoolManager | [0xFd518a5caCDC7cAd0Bc77421b02Ca0dD7fc25cCc](https://testnet.monadvision.com/address/0xFd518a5caCDC7cAd0Bc77421b02Ca0dD7fc25cCc) |

The full list is in `deploy/addresses.10143.json`.

## Best 3 transactions
1. Chainlink CRE settles the fan-voted canon: [0x054895f6…587e](https://testnet.monadvision.com/tx/0x054895f670667690274759331cbb65bba0b34c9c31f691c87a52be9764a0587e)
2. A gasless buy via `eth_sendRawTransactionSync` (executed 133 ms, final 800 ms): [0x2daa3fb7…0ee0d7](https://testnet.monadvision.com/tx/0x2daa3fb7262915375d8b03fd1f3c98fac2471821beac57de8a6e1630340ee0d7)
3. A Kimi-written episode, minted: [0x6c4860be…874c](https://testnet.monadvision.com/tx/0x6c4860be7bcae73f7af6c993503ff1817ebebd91d30925806a34fe60ef82874c)

## Team and attribution
- Built by nickthelegend.
- **Pre-existing work:** KOMA's comic pipeline, x402 payments, launchpad contracts and UI were first built for
  Arbitrum (29 Sep – 4 Oct 2026). The Monad port, every sponsor integration and all Monad-native features were built
  during Metropolis (5–13 Oct 2026). See README → "Built in the Metropolis window".

## AI tools disclosure
- Claude Code wrote most of the code, tests and docs under the author's direction.
- At runtime: Kimi K2.6 (scripts, recaps), Tencent Hunyuan 3 (editor) and FLUX.2 via fal (all images).
