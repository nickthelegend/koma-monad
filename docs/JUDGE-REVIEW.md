# Judge review of the live app (13 Oct 2026, 18:40 IST)

Read-only pass over https://koma-comics.up.railway.app at 390 px and 1440 px (home, /series, /s/1,
/create, /monad, plus test:walk's 15 pages). It reads it the way a judge has three minutes to: what does it do,
does it really run on Monad, and does it hold up.

## What lands

- **The loop is clear in three seconds.** "Fans write the canon." with three captions (launch → vote → remix) over a
  real issue's cover, and two actions.
- **It's real.** Series #1 "Signal Fire" was launched over x402, bought gaslessly, its episode 1 was written by Kimi
  (after reading the canon with a tool call), drawn by FLUX, voted, and settled by Chainlink CRE, all on Monad
  testnet, all linked to MonadVision (SUBMISSION → evidence).
- **Monad is visible, not just claimed:** the top bar's live block ticker, receipts that say "Executed in 133 ms ·
  final 800 ms", and /monad's commit-state pipeline, precompiles and coverage table.
- **Readable:** one headline per card; details sit under collapsed "Details" (40–58% fewer words than a week ago).

## Issues found → fixed

| # | Issue | Fix | Status |
|---|---|---|---|
| 1 | /monad's block pipeline said "can't reach Monad testnet" when the public WebSocket refused the handshake (rate-limited); the page's centrepiece went blank | Falls back to polling latest/safe/finalized over HTTP (Proposed/Voted/Finalized), still timed in the browser and labelled; retries the socket every 15 s | fixed (a14b42f) |
| 2 | Kimi via Moonshot direct returned 400 (temperature) / empty answers (thinking) | thinking off + temperature 0.6 | fixed (d81fee3) |
| 3 | Strangers could spend the owner's Moonshot/fal credit with free testnet AUSD | Daily caps (20 issues, 10 launches, 150 model calls + USD cap), refused before payment; every answer cached | fixed (6275609) |
| 4 | A prose line under the board's progress bar | a chip ("then Uniswap v4"; the sentence is its tooltip) | fixed (a14b42f) |

## Known, not fixable today

- **Thin board:** one series, one issue. More content needs MON, which is reserved for the recording (MON reserve
  policy). The recording itself will add series, trades and a graduation.
- **Privy login** waits for the owner to add the origin in the Privy dashboard; **Envio Cloud** waits for its dashboard
  step (`doitlater.md`). Until then the board says "From KOMA's own event index".
- The CRE run on testnet is `cre workflow simulate --broadcast` through Chainlink's MockKeystoneForwarder; deploying to
  the DON needs `cre account access`.

## MON for the recording

Measured: the smoke test (faucet claim, x402 launch, gasless buy, x402 episode + mint, settlements) used ≈0.9 MON of
relayer gas at ~203 gwei, billed on the limit. A recording with 3 launches, ~10 trades, 3 episodes, votes, one
graduation into Uniswap v4 and faucet claims ≈ 4–5 MON. The relayer must also stay above Monad's 10 MON reserve.

- **Relayer / deployer `0x2318FcA151391251E9c691638aCfb342AEec694c`: +6 MON** (10.70 → ~16.7)
- CRE key `0x4d9e1a826a6DBE986EF8997E57464A2a3443DAb2`: enough (2.7 MON; one settle ≈ 0.1)
