# Critique of `koma-metropolis.mp4` (2:43), as a Metropolis judge

I watched it frame by frame with the `watch` skill.

## What's missing from the flow
- **No standalone comic.** The core product ("make a comic, pay 10¢ a page, it's minted to you") never appears.
  The studio only shows an *episode proposal*.
- **No series launch.** The video uses an existing series; launching a character ($1 over x402, sheet drawn, NFT,
  wallet, coin) is the step that creates the economy, and it's absent.
- **Privy is invisible.** Its modal flashes by for under a second, and nothing says it's the login.
- **Envio** isn't shown (it isn't live yet, so the honest move is to leave it out, which we did).
- **Writers' Room:** the "verified on chain by Monad's P256" badge didn't render, because the live origin check
  failed behind the proxy. That's fixed now, but the Mera proof is missing from the cut.
- **The reveal** came from a second, separately recorded clip, not from the live run.

## Pacing
- 33 s of slide intro before any product, and the rules want the product in actual operation. The problem and
  the intended user should be told over real app footage in ≤ 15 s.
- Sped-up waits (Hunyuan thinking, FLUX drawing) carry no on-screen "×N" tag, so the honesty of the timing is
  implied rather than shown.
- The /monad pipeline is shown for 8 s at small scale; the commit states can't be read.

## Monad proof
- Good: the two timers ("Executed in 394 ms", "final in 894 ms"), the live block ticker, the graduation into v4.
- Missing: the reader never sees *where* it lands. No MonadVision tx page and no Details block (block, gas) is
  opened. txpool isn't shown.

## Sponsors shown working
| Sponsor | In the old cut |
|---|---|
| Hunyuan 3 | the editor's pitch (label too small to read) |
| Kimi K2.6 | named in the narration only; the credits block isn't shown |
| FLUX | the episode art |
| Chainlink CRE | a terminal card (real output), not the app |
| Mera | the room, but no on-chain proof |
| Privy | effectively invisible |
| AUSD / x402 | the pay sheet, but too fast to read |

## Fixes for the rebuild
1. Open on the real app with a 12 s problem-and-user statement, with no slide intro.
2. Run the whole journey in one live take:
   - connect via Privy;
   - make a standalone comic (x402) and show the credits;
   - launch a series;
   - buy;
   - propose an episode (Kimi reads the canon);
   - vote;
   - spend the vote window on /monad;
   - CRE settles, and the reveal shows live in the same session;
   - the Writers' Room with the P256 badge.
3. Zoom or hold on the proof moments: the receipt Details, the MonadVision tx, the credits block, the CRE line in
   the app.
4. A "×N" tag on every sped-up stretch.
