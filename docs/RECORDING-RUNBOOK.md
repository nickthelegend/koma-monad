# Recording runbook: the 3-minute video on the live app

The live app is https://koma-comics.up.railway.app (Monad testnet). Record at 1280×800, with one phone
segment if you like (390 px, device mode). Everything below is real: real signatures, real Monad transactions.

## Before you record (T−10 min)

1. **Wallet.** A browser wallet (Rabby or MetaMask) with a **fresh account** on Monad Testnet (chain 10143,
   RPC `https://testnet-rpc.monad.xyz`). It needs **no MON**: every action is gasless.
2. **MON.** Top up the relayer `0x2318FcA151391251E9c691638aCfb342AEec694c` to about 16 MON. It pays every gas fee
   and must stay above Monad's 10 MON reserve.
3. **Demo override (optional).** Daily caps are 20 issues, 10 launches and 150 model calls. If you expect more, set
   `KOMA_DAILY_ISSUES` on Railway for the day.
4. **Pre-stage the CRE moment.** A demo series' vote lasts 5 minutes.
   - At T−8 min, run steps 4–6 below on **Signal Fire** (series #1) to propose and vote episode 2.
   - The window then closes mid-recording and you can settle it live at 2:10.
   - Or settle at the end, and cut.
5. **Have open:**
   - **Tab 1:** the app home page.
   - **Tab 2:** `/monad`.
   - **Tab 3:** MonadVision (`https://testnet.monadvision.com`).
   - **A terminal in `koma-monad/cre`** with this ready to run:
     `cre workflow simulate koma-canon --target staging-settings --non-interactive --trigger-index 0 --broadcast`
     (key in `cre/.env`).

## The path (≈ 3:00)

| Time | Click | On screen | Caption | Pause on |
|---|---|---|---|---|
| 0:00 | Home | "Fans write the canon." over a real issue; the live block ticker top right | KOMA: fans own the comic and write the canon, on Monad. | the ticker's block number climbing |
| 0:10 | Tab 2, `/monad` | Block pipeline: blocks go Proposed → Voted → Finalized with ms | Monad right now: 300 ms blocks, final in about 600 ms. | the three medians (≈ 300 / 600 / 900 ms) |
| 0:25 | Connect wallet → `/shelf` → **Get 10,000 test AUSD** | "Start here": step 1 ticks off | New fans need no MON; KOMA pays the gas. | the green ✓ |
| 0:40 | `/create`: type an idea, accept the pitch (Editor · Hunyuan 3), **Pay 0.10 AUSD** | One signature; panels ink in; the speed receipt | One AUSD signature, settled by x402. Kimi writes, FLUX draws. | **"Executed in … ms"** (open Details: block, gas) |
| 1:05 | Open the issue → Read → **Guided** | Panel by panel, large | Read it like a comic app. | — |
| 1:15 | `/launch` → a preset → Launch ($1) | The character sheet draws, then the series page | A dollar makes the hero a character with its own wallet and coin. | the sheet appearing |
| 1:35 | On the series: Buy **$3** → Sign & buy, no gas | Receipt: "Executed in ~150 ms" + "final in ~800 ms" | One signature. 40% of every fee goes to the character's wallet. | **both timers** |
| 1:55 | Signal Fire (series #1) → canon board | Episode 2 proposed (pre-staged), your vote counted | Holders write the canon. Kimi read the canon before writing this. | "Previously on…" + the vote |
| 2:10 | Terminal: run the CRE command | "Settled 1 canon slot(s) in 0x…" → refresh the series | Chainlink CRE re-checks every vote on Monad and settles it. | **the splash "Episode 2 is canon"**, settled by Chainlink CRE |
| 2:30 | Click the tx → MonadVision | The settle tx, success | Every step is on Monad testnet. | the tx status |
| 2:40 | `/room` → create a room with a passkey | "verified on chain by Monad's P256 precompile · live on testnet ✓" | Next week's twist stays encrypted to a passkey. | the ✓ |
| 2:50 | Back home | — | KOMA. Fans write the canon. | — |

## If something hiccups

- **Faucet says "cooling down":** Agora's faucet has a 60 s cooldown shared by everyone. Wait, or pre-fund the wallet
  before recording.
- **"Daily capacity reached":** raise `KOMA_DAILY_ISSUES` / `KOMA_DAILY_LAUNCHES` on Railway (`railway variables
  --set`), which redeploys in ~10 min. Nothing was charged.
- **An issue fails mid-drawing:** press **Try again** on its page. It resumes with no second charge.
- **`/monad` says "block tags over HTTP":** Monad's public WebSocket is busy, so the strip falls back to HTTP block
  tags. That's still live; say "live from testnet" and move on.
- **CRE says nothing is due:** the vote window hasn't closed yet (5 min from the proposal). Wait, or record that
  shot last.
- **Wallet asks for gas:** you pressed "Send it yourself". Use the main "Sign & buy — no gas" button (trades of $3 or more).

## What one run consumes

| Item | Amount | Paid by |
|---|---|---|
| AUSD | ≈ 4.70 (issue 0.10 + launch 1.00 + buy 3.00 + episode proposal 0.30 + spare) | the test wallet (free from the faucet) |
| MON | ≈ 1.0–1.5 (faucet call, x402 settlements, launch, relayed buy, mints) | the relayer `0x2318…694c` |
| MON (CRE) | ≈ 0.1 | the CRE key `0x4d9e…DAb2` |
| fal / Kimi | ≈ $0.10 (one sheet, two short issues, three short LLM calls) | under the daily caps |
