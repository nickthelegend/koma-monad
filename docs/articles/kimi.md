# How KOMA uses Kimi: the writer that remembers the canon

*KOMA · Monad Metropolis, Track 03 · live at https://koma-comics.up.railway.app*

KOMA is a comic studio and a story economy on Monad. Anyone can make an AI comic for 10¢ a page. Its hero can then
be launched as a series with its own wallet and coin, and holders vote on what happens next. A Chainlink CRE
workflow settles each vote on chain.

There are three AI models in the studio, and each one has a single job:

| Role | Model | Job |
|---|---|---|
| Editor | Tencent Hunyuan 3 | Turns a one-line idea into a structured pitch |
| **Writer** | **Kimi K2.6 (Moonshot)** | **Writes every script, page by page and panel by panel, and every "Previously on…" recap** |
| Artist | FLUX.2 (via fal) | Draws the panels |

This article covers the writer.

## The problem Kimi solves: a story many people own

In most AI comic tools, each generation starts from scratch. In KOMA the story belongs to a community. Holders
propose and vote on the next episode, and whatever wins becomes **canon**: the fixed history of that series. A new
episode is only worth anything if it respects what the fans already decided. If the writer forgets that the
lighthouse keeper's brother drowned in episode 2, the vote that made it canon meant nothing.

So the writer needs three things:
1. a voice that can carry a serialized story: page beats, panel descriptions, dialogue and captions;
2. strict structured output, because the pages go straight into an image pipeline and are minted;
3. the ability to **look up the canon itself** before writing, instead of relying on whatever the prompt crams in.

Kimi K2.6 does all three, and the third is what makes the KOMA model work.

## How it works

### 1. Kimi reads the canon with a tool call

When someone proposes episode *N* of a series, KOMA gives Kimi one tool, `get_series_canon`:

```ts
const CANON_TOOL = {
  type: "function",
  function: {
    name: "get_series_canon",
    description:
      "Returns the episodes holders voted into this series' canon, in order (title and logline of each). " +
      "Call it before writing an episode so the new one continues the story.",
    parameters: { type: "object", properties: {}, additionalProperties: false },
  },
};
```

The prompt tells Kimi which episode this is and asks it to read what has happened so far, keep every established
fact, and move the story forward. Kimi calls the tool. KOMA answers from the series' **settled canon**, meaning
the episodes that won their vote and were settled on Monad by Chainlink CRE. Kimi then writes the script.

The canon Kimi reads is the same canon the chain records. The fans' votes decide the history, and the writer reads
that history directly.

Every issue page credits the writer, including the model name and the tool calls it made, so readers can see that
the episode was written against the canon.

### 2. Kimi writes a structured script

The script comes back as JSON: a title, a logline, and for each page its panels, each with a scene description, a
camera note, dialogue and captions. KOMA validates it, sends the panels to FLUX to draw, letters the balloons, and
mints the finished issue to the buyer's wallet. If a response doesn't parse, KOMA retries (up to three attempts)
rather than shipping a broken comic.

### 3. Kimi writes the "Previously on…" recaps

Every series page opens with a short recap of the canon so far, written by Kimi from the canon episodes' titles
and loglines. The recap is cached, and only a new canon episode triggers a new one, so the model is called once
per change and never per page view.

## Engineering notes

- **OpenAI-compatible, called directly.** KOMA calls Moonshot's API (`https://api.moonshot.ai/v1`, model
  `kimi-k2.6`) through a small shared client. Kimi stays the writer when traffic is routed through a gateway; the
  same model is also reachable as `moonshotai/kimi-k2.6`.
- **Thinking mode, handled carefully.** K2.6 pins temperature to 1 while thinking and 0.6 without it. With
  thinking on, a long script can spend its token budget on reasoning and come back empty, so KOMA runs the writer
  with thinking off by default and a token budget that scales with page count (2,000 + 2,000 × pages). When
  thinking is on, the assistant turn keeps `reasoning_content` across the tool loop, as Kimi requires.
- **A short tool loop.** Tool call → canon result → final JSON answer, with a hard cap on rounds.
- **A budget for a hackathon credit.** Responses are cached, so the same request never pays twice. Daily caps
  protect the credit, and when a cap is hit the app says so and charges the user nothing.

## What Kimi brought to KOMA

- **Continuity is what we sell.** "Fans write the canon" only means something if the next episode respects the
  vote. Tool calling lets Kimi check the canon instead of guessing, so a vote changes the story that gets written.
- **Serialized writing.** Page beats, cliffhangers, dialogue that fits in a balloon: Kimi's scripts read like
  comics, not summaries.
- **Reliable structure.** Strict JSON lets the studio run end to end with no human in the loop: idea → pitch
  (Hunyuan) → script (Kimi) → art (FLUX) → minted issue, in about a minute.

## See it live (Monad testnet)

- App: https://koma-comics.up.railway.app. Open a series, read "Previously on…", then propose the next episode.
- A Kimi-written episode, minted:
  [0x6c4860be…874c](https://testnet.monadvision.com/tx/0x6c4860be7bcae73f7af6c993503ff1817ebebd91d30925806a34fe60ef82874c)
- The canon that later episodes read: Signal Fire's episodes 1 and 2, settled by Chainlink CRE
  ([0x054895f6…587e](https://testnet.monadvision.com/tx/0x054895f670667690274759331cbb65bba0b34c9c31f691c87a52be9764a0587e),
  [0x63e90dcd…cd57](https://testnet.monadvision.com/tx/0x63e90dcd958a40d64ea7c9de388533aeb23b4d5ab77a1dfe314143fea833cd57)).
  Episode 3, "Ada's Echo", was written after Kimi read both, and its issue page credits the `get_series_canon` call.
- Code: `src/lib/server/ai.ts` (`writeScript`, `get_series_canon`), `src/lib/server/providers.ts`,
  `src/lib/server/launchpad/recap.ts`.
