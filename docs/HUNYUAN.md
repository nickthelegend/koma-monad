# How KOMA uses Tencent Hunyuan: the editor who turns an idea into a comic

*KOMA · Monad Metropolis, Track 03 · live at https://koma-comics.up.railway.app*

KOMA is a comic studio and a story economy on Monad. You describe a comic; KOMA's AI editor shapes it into a pitch;
you pay 10¢ a page in AUSD with one signature, and a writer (Kimi K2.6) and an artist (FLUX.2) make it. The finished
issue is minted to you. Its hero can then be launched as a series that holders vote on.

| Role | Model | Job |
|---|---|---|
| **Editor** | **Tencent Hunyuan 3** | **Talks with the person, turns a one-line idea into a structured, priced pitch** |
| Writer | Kimi K2.6 | Writes the script, reading the voted canon first |
| Artist | FLUX.2 (Hunyuan Image 3 optional, see below) | Draws sheets, covers and panels |

## The problem Hunyuan solves: from "a vague idea" to "an order you can pay for"

Most people don't arrive with a script. They arrive with "a lighthouse cat who keeps the lamp lit". A comic studio
needs a title, a synopsis with an ending beat, a genre, an art style, a page count, a cast with consistent looks, and
a price, all valid before anyone pays. KOMA's editor is that conversation. It's an interactive, multi-turn chat
that ends in a **pitch the studio can charge for**.

## How it works

### 1. A chat with a strict contract

`src/lib/server/chat.ts` gives Hunyuan 3 an editor's voice and a hard output contract:

```ts
const SYSTEM = `You are the editor at KOMA, a studio that turns one person's idea into a short, fully drawn comic...
Voice: warm, quick, a little playful, like a good comics editor. Replies are 1 to 3 short sentences...
Answer with strict JSON only, no code fences:
{"reply": string, "pitch": null | {
  "title": string (2-24 chars, punchy),
  "synopsis": string (40-450 chars: setup, conflict, the ending beat; this is what the writer gets),
  "genre": one of [...], "style": one of [...], "pages": 1 | 2 | 4 | 6,
  "cast": ids from this roster..., "custom": [{"name": string, "look": string}]
}}`;
```

Every turn returns a conversational `reply` and, once there's enough to go on, a `pitch`. The pitch is not free
text: `editorTurn()` runs it through the same validator as a paid order (`parseOrder`), and attaches the price. If
Hunyuan's pitch breaks a rule, the error goes back to it in the next prompt ("Your pitch was rejected: … Fix it and
answer again"), so what reaches the **Pay** button is always a valid order.

### 2. Interactive by design

- **Multi-turn:** the person can ask for changes ("make it cozier", "two pages"), and Hunyuan answers with the whole
  updated pitch. The current pitch rides along in the transcript, so edits are incremental.
- **Remixes:** when you remix an issue, the original's title, genre, style and logline go into the conversation, so
  the editor pitches a story in the same world.
- **Series episodes:** when a holder proposes the next episode of a series, the editor pitches it for that series
  (and the price switches to the episode rate).
- The studio shows the editor by name ("Editor · Hunyuan 3"), and while it reasons it shows a live clock
  ("Hunyuan 3 is thinking · 12 s") so the wait is never a mystery.

### 3. Then the pitch becomes a comic

Pay (x402, one AUSD signature) → Kimi writes the script from Hunyuan's synopsis → FLUX draws it → the issue is
minted on Monad. Hunyuan's synopsis is literally "what the writer gets".

## Multimodal: Hunyuan Image 3 (built; off on the live app)

KOMA also integrates **Hunyuan Image 3** (`fal-ai/hunyuan-image/v3/text-to-image`) for the two images that define a
series' look:

```ts
// src/lib/server/providers.ts
/** Hunyuan Image 3 (on fal) draws character sheets when HUNYUAN_IMAGE=1. */
export const hunyuanImage = () => imageProvider() === "fal" && env("HUNYUAN_IMAGE") === "1";
/** …and issue covers too, unless HUNYUAN_COVERS=0. */
export const hunyuanCovers = () => hunyuanImage() && env("HUNYUAN_COVERS") !== "0";
```

With `HUNYUAN_IMAGE=1`, character sheets (the turnaround every later panel is drawn from) come from Hunyuan Image 3,
and with covers on, each issue's cover does too; the issue page credits "Hunyuan Image 3 (cover)". We built and
used this on the local Monad-testnet fork during development. **On the live app it is switched off**
(`HUNYUAN_IMAGE=0`): a Hunyuan cover costs $0.10 (one billed megapixel) against a 10¢ page, so to keep the public
testnet app within its credits, all live images are FLUX.2, and Hunyuan does the text. One env var turns it back on.

## Engineering notes

- **Route.** Hunyuan 3 is reached through fal's OpenAI-compatible endpoint (`tencent/hy3`); `HUNYUAN_API_KEY` routes
  it to Tencent's TokenHub directly instead (`src/lib/server/providers.ts`).
- **Reasoning on, with room for it.** Without reasoning, the pitch JSON drifted (the pitch leaked into the reply).
  With reasoning, Hunyuan can spend its budget thinking and answer empty, which we saw live as a 502. The editor now
  gets 4,000 tokens. If two tries still come back empty, Kimi answers that single turn, and the message says
  "answered by Kimi K2.6 (standing in for Hunyuan 3)", so the label never lies.
- **Guards.** Answers are cached by exact request (a repeated turn costs nothing), model calls are capped per day,
  and capacity errors are shown as such instead of being retried.

## The value Hunyuan brought

- **A front door anyone can use.** No forms, no prompt engineering: you talk to an editor, and it hands the studio
  a valid, priced order. That's what makes "describe a comic, pay a dime, own it" work for non-technical fans.
- **Taste.** Hunyuan pitches with an ending beat and offers one idea to make the story better ("Want it cozier? Have
  the ship leave a tiny starfish at the dock"), which is what a good comics editor does.
- **Structure the pipeline can trust.** Its JSON goes straight into payment, scripting and drawing with no human in
  the loop.

## See it live (Monad testnet)

- App: https://koma-comics.up.railway.app/create: type an idea; the editor (Hunyuan 3) pitches it.
- A pitch Hunyuan shaped, then paid over x402 and minted: "Lighthouse Cat" (in the demo video at 0:18), and episode
  pitches for series such as "Ferry of Lost Things".
- Code: `src/lib/server/chat.ts` (`SYSTEM`, `editorTurn`), `src/components/studio/chat-studio.tsx`,
  `src/lib/server/providers.ts`, `src/lib/server/ai.ts` (`HUNYUAN_T2I`).
