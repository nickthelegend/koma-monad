# Judge round 2: independent review

Round 1 is by a fresh subagent that had not seen the code or the chat. It was given only the live URL, the public
repo, `docs/PORTAL-COPY.md` and the official rubric. Verdict below, verbatim. The fixes and round 2 follow it.

---

## Round 1 (13 Oct 2026, ~20:05 IST)

# KOMA: judge's report (Monad Metropolis, Track 03)

I checked everything on 2026-10-13 against the live app, the public repo, Monad testnet RPC, Sourcify and the portal copy. I connected no wallet and sent no transaction. Screenshots are in `/private/tmp/koma-judge/`.

## Scores: main track

| Criterion | Score | Reason |
|---|---|---|
| Product quality | 7 | Strong comic look on both desktop and phone, and no console errors on the 8 pages. But the studio editor failed twice in the browser, and there is almost no data: 1 series, 1 issue, 1 trade, 1 vote. |
| Technical excellence | 8 | 4 claimed txs succeed on chain, and all 6 listed contracts plus the address-book contracts are verified on Sourcify (exact or partial match). The scope is big and it works: ERC-6551 character wallets, a bonding curve, EIP-712 votes, a CRE receiver, x402. |
| Monad integration | 8 | `/monad` shows a live block pipeline, staking reads (0x1000), P256VERIFY (0x0100), reserve-balance reads (0x1001), relayer gas and AUSD everywhere. Some of these are read-only showcases rather than load-bearing features. |
| Track fit | 8 | "Fans own the character and vote the canon" fits Social, Attention & Culture well. |
| Innovation | 7 | A character with its own wallet that earns fees, plus fan-voted AI episodes, is fresh. The underlying pieces (launchpad curve, AI comic) are familiar. |
| **Weighted total** | **7.6 / 10** | |

## Scores: bounties

| Bounty | Score | Reason |
|---|---|---|
| Kimi | 7 | The issue page credits "Written by Kimi K2.6 (read the series canon first)" and the series page shows a recap. `get_series_canon` is in `ai.ts` and `providers.ts`, and mint tx 0x6c48… succeeded. But only one Kimi episode exists. |
| Tencent Hunyuan | 5 | The editor is labelled "Hunyuan 3" and `/api/chat` returned a good JSON pitch in about 20 s by curl. In the real UI, attempt 1 got a 502 ("The editor lost their train of thought") and attempt 2 still showed the typing dots after 40 s. |
| Chainlink CRE | 7 | Settle tx 0x0548… went through forwarder 0xB9F7…, which emitted events from `CanonSettler` and `CanonRegistry`. The code and tests are real. But this was a `cre workflow simulate --broadcast` run through the MockKeystoneForwarder, not a deployed DON, and it settled a single vote by a single voter. |
| Mera | 5 | The code exists (`src/lib/room/*`, `/api/room/passkey`). The only proof is a local `test:room`, and there's no on-chain or live proof of an unlock. |
| Privy | 3 | The copy itself says "live login needs the origin allow-listed". The autopilot is shown only as "Connect to set up". |
| Envio | 3 | The copy says "cloud hosting pending", and the live leaderboard says "From KOMA's own event index", so it isn't using Envio. |

## Claims I couldn't verify

- **"Executed in 133 ms, final in 800 ms."** Block timestamps only have 1-second resolution. `/monad` shows a different median (444 ms executed, 1071 ms final).
- **"Kimi reads the voted canon with a tool call."** I only saw the code and a UI credit. I didn't see a trace.
- **"The full loop ran: x402 launch → gasless buy → Kimi episode → vote → CRE settlement."** I found the launch, buy, mint and settle txs. Votes are off-chain signatures, so I could only infer the vote from the settle event's weights.
- **"All 14 contracts verified."** The address-book contracts check out. The per-series contracts (curve 0x581a…, coin 0x98ad…, 0x8272…, character wallet 0xabcd…) are not verified on Sourcify.
- **Graduation into a locked Uniswap v4 pool.** Nothing has graduated ("GRADUATED (V4) 0"), and the v4 PoolManager is only deployed.
- **Remix royalties "up the family tree".** The page says "No remixes yet."
- **Mera passkey unlock verified by P256VERIFY.** `/monad` shows "fresh ✓ · tampered ✗", but that's a demo check, not a Writers' Room unlock.
- **Privy session signer and key quorum.** Not shown anywhere live.
- **Envio parity.** Local only.
- **Art model.** The portal says FLUX draws everything, while the home page says "Hunyuan Image 3 draws every character sheet and cover". The issue page credits FLUX.2.

## Broken or confusing steps

- **/create:** the chip prompt got a 502 and an error bubble. A second chip spun for more than 40 s with no pitch.
- **`POST /api/comics`:** the 402 `PAYMENT-REQUIRED` header says `resource.url = "https://0.0.0.0:8080/api/comics"`. That's an internal host leaking out, and strict x402 clients may reject it.
- **/series:** the leaderboard says "1 trades · 4 holders" while the card says "Holders 1".
- **/s/1 fees:** the fee chips say "40% to Ada Okonkwo / 20% remixes / 40% KOMA", but "Where the fees went" shows 60% / 40%. The likely cause (the remix share rolls to the character when there are no remixes) isn't explained.
- **`cre/README.md`** still says "Not run: `cre workflow simulate`… anything on public testnet", which contradicts the portal and `SUBMISSION.md`.
- **Prices:** "$0.0₅101" subscript notation is unreadable for a culture-track audience.

## Dense or ugly screens

- **/s/1, 1440 and 390:** the price chart for 1 trade is a big flat blue block. The page is about 4,000 px on desktop and 5,300 px on phone, with a dozen sections, and the trade box is 3–4 screens down on phone.
- **Every page, 1440:** the footer "KOMA" wordmark is about 900 px tall, so short pages (/receipts, /room) are mostly footer.
- **/monad, 1440:** clean, but the jargon wall ("monadNewHeads", "0x1001", "limit-billed") means nothing to a non-Monad judge.
- **/ (home), 1440:** the catalog shows one issue on a wide empty grid, which makes the app feel abandoned.

## First 60 seconds

**What lands:** "FANS WRITE THE CANON" with a striking lighthouse cover, a live block number, a $3 volume stat and a 444 ms median. A judge gets "AI comic plus a character coin plus voting" fast.

**What confuses:**
- Is the coin a security? The disclaimer is only on /series.
- Why is there only one series and one trade?
- Prices in subscript notation.
- The difference between "Back a series" and "Make a comic".
- Trying the studio hits an error.

## The reason I'd vote no

The architecture is impressive and the on-chain receipts are real, but the "economy" has been exercised exactly once: one series, one buyer (who is also the launcher), one $3 trade, one vote by one voter, settled through a simulator. Graduation, remixes, Privy and Envio aren't live. Half the claimed bounties rest on local tests, and the one AI interaction a judge can try for free (the editor) failed in the browser. It reads as a very well-built scaffold demoed by its author, not yet a social product where fans have shown up.

## Top 10 fixes, ranked

1. Fix the studio chat 502/timeout. Stream the reply or raise the proxy timeout, and show progress.
2. Set the public base URL so the x402 `resource.url` isn't `0.0.0.0:8080`.
3. Seed real activity: 3–5 series, several wallets trading, at least 2 voters on one contested episode, and one remix.
4. Update `cre/README.md` to match the testnet settle. State plainly that it was `simulate --broadcast` via the MockKeystoneForwarder.
5. Make the fee chips match "Where the fees went", or label why the remix share went to the character.
6. Fix the 1-vs-4 holders mismatch on /series.
7. Show prices in plain decimals or "per 1M coins" instead of subscript zeros.
8. Drop or soften the Privy and Envio bounty claims until they're live, or deploy Envio hosted and allow-list the Privy origin.
9. Make the portal copy and home page agree on which model draws the art.
10. On mobile /s/1, move the trade box above the chart, hide the chart when there are fewer than 3 trades, and shrink the footer wordmark.

---

## Fixes after round 1 (13 Oct, 20:05–20:20 IST)

| Round-1 finding | Fix | Commit |
|---|---|---|
| Studio editor 502 / spins forever | The thinking clock; capacity errors surface; failures are logged | 5351229 |
| x402 `resource.url` leaked `https://0.0.0.0:8080` | Built from `KOMA_PUBLIC_URL` (verified live: `…up.railway.app/api/comics`) | 5351229 |
| Leaderboard said "4 holders" vs the card's 1 | The same holder count as the cards (contracts excluded) | 297d67a |
| Fee chips 40/20/40 vs the actual 60/40 | Chips match: 60% to the character when there's no parent | 297d67a |
| Subscript prices ("$0.0₅101") | "$10.10 / 1M", with the exact per-coin price as the tooltip | 297d67a |
| Home said Hunyuan Image 3 draws the art; Envio/Privy implied live | FLUX.2 credited; Envio/Privy lines say "pending" | 297d67a |
| A one-trade chart is a flat block; a 900 px footer wordmark | Chart from 3 trades; wordmark a third the size | 297d67a |
| `cre/README` said "nothing on testnet" | Records the testnet `simulate --broadcast` via MockKeystoneForwarder, and the DON deploy as not done | ccc733b |
| Unverifiable or overstated portal claims | Measurement explained; fork-only features labelled; Privy/Envio marked built-not-live; series #1's coin/curve/vesting verified on Sourcify | ccc733b |

## Round 2 (fresh judge, 13 Oct ~20:35 IST): 7.0 / 10

Main track: product 6 · technical 7 · Monad 8 · track fit 7 · innovation 7. Bounties: Kimi 7 · Hunyuan 4 ·
CRE 6 · Mera 5 · Privy 2 · Envio 2. The second judge was stricter on the same evidence. Its top finding was that the
editor still returned a 502.

## Root cause and fix after round 2

The logs showed `tencent/hy3 returned an empty answer`: Hunyuan 3 reasons first and spent its whole 1,500-token
budget doing it.
- The editor now gets 4,000 tokens.
- If two tries still fail, Kimi K2.6 answers that one turn, labelled "answered by Kimi K2.6 (standing in for
  Hunyuan 3)".
- PORTAL-COPY's numbers now match the live app: 40% vs 60% fee share, 10¢ vs 30¢ episode pages, and the median
  timing next to the best case.

Commit f819d0d.

## What only the owner can change

- **Social proof.** Several distinct wallets buying, proposing and voting on a contested episode 2 needs testnet MON,
  which is reserved for the recording. The recording runbook stages exactly this.
- **Privy:** the dashboard origin. **Envio:** Cloud hosting. **CRE:** a DON deploy (`cre account access`).
