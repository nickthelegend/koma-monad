# KOMA demo video pipeline

The deliverable is `docs/demo/koma-metropolis.mp4` + `.srt`: 1920×1080, H.264/AAC, −16 LUFS, 2:43.

1. `node video/capture.mjs` drives the live app on Monad testnet with Playwright and an injected cursor. It uses a
   team-seeded wallet through the wallet shim (testnet opt-in), and writes `work/demo.webm` + `work/markers.json`.
2. `node video/capture-reveal.mjs`: a returning fan's view of the settled episode, i.e. the reveal splash.
3. `node video/tts.mjs` voices `script.json` with ElevenLabs (George), cached per line, with word timings.
4. `node video/render-html.mjs intro 33.5 | outro 6 | cre 7.6` records the motion-graphics pages (`intro.html`,
   `cre-card.html`) in KOMA's own type and colours.
5. `python3 video/assemble.py` cuts the beats, places the narration, burns the captions (PNG overlays; this ffmpeg
   has no libass) and the "LIVE · MONAD TESTNET" tag, and writes the `.srt`.

What's on screen is real:
- The buy (executed 394 ms) and the graduation into Uniswap v4.
- The episode: Hunyuan pitch, x402 payment, Kimi script, FLUX art; executed 439 ms, final 894 ms.
- The CRE settle `0x16d3a3ad…f144a75`, with 5 verified votes.

The four other voters are team-controlled wallets, and the narration says so.
