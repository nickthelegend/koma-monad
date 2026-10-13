# Sponsor coverage (13 Oct 2026)

Each sponsor, what KOMA does with it, and where it's proven. "Working" means it ran for real on the live Monad testnet
app (https://koma-comics.up.railway.app) or, where noted, on the local fork with the same code.

| Sponsor | What KOMA does with it | Status | Proof |
|---|---|---|---|
| **Agora AUSD** | Every payment (x402, EIP-3009), every curve trade (gasless: the user signs, KOMA's relayer sends) | **working, live** | launch `0xe2fa666e…2d05`, gasless buy `0x2daa3fb7…0ee0d7` (SUBMISSION → evidence) |
| **Kimi K2.6** (Moonshot direct) | Writes every script; reads the voted canon first with a `get_series_canon` tool call; writes "Previously on…" | **working, live** | episode 1 of series #1, minted [`0x6c4860be…874c`](https://testnet.monadvision.com/tx/0x6c4860be7bcae73f7af6c993503ff1817ebebd91d30925806a34fe60ef82874c); credits show `kimi-k2.6` + `get_series_canon` |
| **Tencent Hunyuan 3** | The studio's editor: turns an idea into a pitch (text only; images are FLUX by the owner's rule) | **working** (via fal's OpenRouter route) | `/create` chat; `test:ai` |
| **Chainlink CRE** | `koma-canon` re-verifies every signed vote and snapshot weight on Monad and settles the winner through the forwarder | **working, live** (testnet `--broadcast`; fork: `test:cre`) | testnet settle [`0x054895f6…587e`](https://testnet.monadvision.com/tx/0x054895f670667690274759331cbb65bba0b34c9c31f691c87a52be9764a0587e): series #1 episode 1, `settledBy: cre` |
| **Mera** (One Passkey, Many Keys) | Writers' Room: one passkey → PRF → an Ed25519 identity + an AES draft key; each unlock's passkey signature verified by Monad's P256 precompile | **working** | `test:room` (R1–R4b); `/room` |
| **Privy** | Account layer and the backer autopilot's session signer (key quorum created on the shared app) | **configured**; live login waits for the owner to add the origin in the Privy dashboard | `scripts/privy-setup.mjs`; `doitlater.md` |
| **Envio HyperIndex** | `/series` leaderboard (volume, top series, backers) | **working locally** (`test:envio` parity); Envio Cloud hosting waits for the owner | `npm run demo` → "Indexed by Envio HyperIndex" |

Five of seven are working (AUSD, Kimi, Hunyuan, CRE, Mera); Privy and Envio need one dashboard step each from the
owner (listed in `/Volumes/Extreme SSD/Projects/doitlater.md`).

## Monad-native, live on testnet

- `eth_sendRawTransactionSync`: relayed trades come back with their receipt (buy executed in 133 ms, final in 800 ms).
- `txpool_statusByHash`: an in-flight tx reported `tracked` → `committed` (`0xe353700d…06b3`).
- `monadNewHeads` / `monadLogs` commit states (Proposed → Voted → Finalized → Verified), live on `/monad`.
- P256VERIFY (0x0100) for passkeys, staking (0x1000) and reserve (0x1001) precompiles read live; the relayer
  respects the 10 MON reserve rule and sets tight gas limits.
- Canonical contracts: Permit2, ERC-6551, Multicall3; Uniswap v4 deployed and verified (KOMA graduates curves into it).

## Cost guards

Paid AI is capped per UTC day and refused before payment: 20 issues, 10 launches, 150 model calls, plus the USD cap.
Every LLM answer is cached by its exact request, so a retry never pays twice.
