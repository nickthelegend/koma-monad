// FIXTURE — not a real model. An OpenAI-compatible /chat/completions server that stands in for Kimi
// (Moonshot) and Hunyuan (TokenHub) in tests, so KOMA's real provider code (auth header, model id, JSON
// mode, the tool-call loop) runs end to end without keys. Every request is appended to `log`.
//   node scripts/fixtures/fake-llm.mjs [port]      (default 4399)
// Point the app at it: MOONSHOT_BASE_URL=http://127.0.0.1:4399/kimi/v1 HUNYUAN_BASE_URL=http://127.0.0.1:4399/hunyuan/v1
import { createServer } from "node:http";
import { pathToFileURL } from "node:url";

export const log = [];

function scriptJson(pages) {
  const panel = (i) => ({
    shot: `fixture shot ${i}: a courier racing a storm`,
    alt: `Fixture panel ${i}.`,
    balloons: [{ kind: "speech", text: `[fixture model] line ${i}`, at: "top-left" }],
  });
  return JSON.stringify({
    title: "Fixture Run",
    logline: "[fixture model] A courier races a storm.",
    genre: "Sci-fi",
    cover: "fixture cover",
    pages: Array.from({ length: pages }, () => ({ panels: [1, 2, 3, 4].map(panel) })),
  });
}

function editorJson() {
  return JSON.stringify({
    reply: "[fixture Hunyuan] Love it. Here's the pitch.",
    pitch: {
      title: "Storm Courier",
      synopsis: "A courier on a hoverbike races a thunderstorm across Neo Tokyo to deliver a cake before midnight.",
      genre: "Sci-fi",
      style: "neon-anime",
      pages: 1,
      cast: [],
      custom: [{ name: "Yuki", look: "short black hair with neon streaks, oversized bomber jacket, goggles" }],
    },
  });
}

export function startFakeLlm(port = 4399) {
  const server = createServer(async (req, res) => {
    let body = "";
    for await (const chunk of req) body += chunk;
    const provider = req.url?.startsWith("/kimi") ? "kimi" : req.url?.startsWith("/hunyuan") ? "hunyuan" : "?";
    const json = body ? JSON.parse(body) : {};
    log.push({ provider, path: req.url, auth: req.headers.authorization, body: json });
    if (req.url === "/__log") {
      log.pop(); // don't record the log read itself
      res.writeHead(200, { "content-type": "application/json" }).end(JSON.stringify(log));
      return;
    }
    if (!req.url?.endsWith("/chat/completions")) {
      res.writeHead(404).end();
      return;
    }
    const msgs = json.messages ?? [];
    const toolResult = msgs.find((m) => m.role === "tool");
    let message;
    if (json.tools?.length && !toolResult) {
      // First turn of a series episode: ask for the canon, the way a real model would.
      message = { role: "assistant", content: null, tool_calls: [{ id: "call_canon_1", type: "function", function: { name: "get_series_canon", arguments: "{}" } }] };
    } else {
      const prompt = msgs.map((m) => m.content ?? "").join("\n");
      const isEditor = /editor at KOMA/.test(prompt);
      const pages = Number(/PAGES: exactly (\d+)/.exec(prompt)?.[1] ?? 1);
      message = { role: "assistant", content: isEditor ? editorJson() : scriptJson(pages) };
    }
    res.writeHead(200, { "content-type": "application/json" }).end(
      JSON.stringify({ choices: [{ message, finish_reason: message.tool_calls ? "tool_calls" : "stop" }], usage: { prompt_tokens: 10, completion_tokens: 10 } }),
    );
  });
  return new Promise((resolve) => server.listen(port, "127.0.0.1", () => resolve(server)));
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const port = Number(process.argv[2] ?? 4399);
  await startFakeLlm(port);
  console.log(`fake LLM (fixture) on :${port}`);
}
