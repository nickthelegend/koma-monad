# KOMA: what costs us with judges, and what we fix first

A judge has five minutes and no context. Judging weights: product quality, technical excellence, Monad integration,
track fit and innovation (20% each). Bounties weight meeting the stated requirement (40%). This review used the
running app on the local fork (the 12-screen contact sheets in `docs/screens/sheets/`) as a judge would.

## The 10 biggest weaknesses (ranked by cost with judges)

1. **Monad's advantage is invisible.** Trades, payments, votes and launches all land on chain, but nothing on screen
   says how fast or how cheap. "Built on Monad" is a label, not a demonstration. *(Monad integration)*
2. **The first 60 seconds sell the wrong thing.** The home hero says "Write it, we draw it": an AI comic generator.
   The Track 3 idea (fans co-own a character, vote its canon, the character earns) is two clicks deep. *(Track fit, innovation)*
3. **The canon has no story shape.** Canon is the heart of KOMA, but the series page shows it as a list of past
   episodes beside the vote. Nothing tells the story so far as a timeline: rounds, winners, margins, the alternates
   that lost, and who settled each round (Chainlink CRE). *(Track fit, bounty evidence)*
4. **The reader is a long scroll.** The thing people actually consume is a stack of page images. There are no page
   turns, no full screen, no panel-by-panel reading on a phone, and no memorable "wow" moment for the video.
   *(Product quality)*
5. **Sponsor tech is hard to see in the UI.** Kimi's and Hunyuan's credits show on an issue page, and CRE has a badge.
   But the studio never says the editor is Hunyuan, and nothing shows the board is Envio-indexed unless you scroll to
   the leaderboard footer. *(Bounty evidence)*
6. **The board is cluttered with bare test series.** Series launched without art ("Launched without a sheet") can
   be featured over illustrated ones. *(Product quality)*
7. **Creator onboarding is a blank form.** Launching asks for five free-text fields with no examples or presets.
8. **The autopilot panel is a dead end without Privy keys.** It honestly says "not configured", but a judge sees a
   feature they can't try. (Needs keys: not fixable in this wave.)
9. **No ETH-vs-Monad cost framing.** "No gas" is said, never quantified.
10. **Empty states for a brand-new wallet** (an empty shelf and receipts) give no next step.

## Top 5 for this wave (no MON, no keys)

Ranked by impact × effort. Each one gets real data on the local fork, tests, desktop and 390 px before/after
screenshots in `docs/screens/wave/`, its own commit, a push and green CI.

| # | Feature | Fixes | Acceptance criteria |
|---|---|---|---|
| 1 | **Monad speed receipt** | 1, 9 | Every relayed trade, x402 settlement, vote settlement and launch records submit→receipt time (ms), gas used and block. The trade widget, the studio's paid step and `/receipts` show "Confirmed on Monad in N ms · gas paid by KOMA". The local fork mines at Monad testnet's 400 ms block time, so the number means something. A live block ticker shows the chain advancing. Tested end to end (numbers come from real receipts). |
| 2 | **Guided reader** | 4 | `/c/:id/read` gains page turns (arrow keys, swipe, buttons), full screen, and a panel-by-panel "guided" mode that zooms each panel with its balloons, the way phone comic readers do. Progress is shown. It works at 390 px and with the keyboard, and the console is clean. e2e: page/panel navigation and full-screen toggle. |
| 3 | **Canon timeline** | 3, 5 | The series page gets a "Story so far" timeline. Each episode shows its winning issue, its vote share, the alternates that lost, and the settler ("Settled by Chainlink CRE" with tx), plus the open round with a live countdown and the leading proposal. Data is from the index (no new chain calls). e2e on a series with settled rounds. |
| 4 | **First 60 seconds** | 2, 5 | The home hero leads with the loop (back a character → vote its canon → the character earns) and shows live numbers from the board (series, backers, canon episodes, volume). A "powered by" strip names each sponsor's actual job (Hunyuan edits, Kimi writes, CRE settles canon, Envio indexes, Privy signs, Mera encrypts), each linking to where it's visible. The studio labels its editor "Hunyuan 3". |
| 5 | **Board curation + launch presets** | 6, 7 | Featured and trending prefer illustrated series; bare series sink. `/launch` offers 3 one-tap presets that fill the form with a complete, valid character and pitch, which the creator then edits. e2e: a preset fills a valid launch. |

## Next 5 (after this wave)

Privy live autopilot (needs keys) · a series landing page for sharing (OG image per series) · creator analytics
(earnings over time per character wallet) · empty-state guidance for new wallets · an episode reveal animation
when a round settles.
