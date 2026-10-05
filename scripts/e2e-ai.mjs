// AI provider checks: KOMA's real Kimi and Hunyuan code paths (auth, model ids, JSON mode, the canon tool call),
// run against the labelled fixture model in scripts/fixtures/fake-llm.mjs, so no keys are needed.
//
//   node scripts/fixtures/fake-llm.mjs &
//   start the app with:  MOONSHOT_API_KEY=fixture MOONSHOT_BASE_URL=http://127.0.0.1:4399/kimi/v1 \
//                        HUNYUAN_API_KEY=fixture HUNYUAN_BASE_URL=http://127.0.0.1:4399/hunyuan/v1
//   node scripts/e2e-ai.mjs
// With real keys instead, point KOMA_URL at that server and set FAKE_LLM=none: A1–A2 then check the live models.
import { execFileSync } from "node:child_process";

const BASE = process.env.KOMA_URL ?? "http://localhost:4320";
const FAKE = process.env.FAKE_LLM ?? "http://127.0.0.1:4399";
const results = [];
const check = (id, name, ok, detail = "") => {
  results.push(ok);
  console.log(`${ok ? "PASS" : "FAIL"} ${id} ${name}${detail ? ` — ${detail}` : ""}`);
};
const fakeLog = async () => (FAKE === "none" ? [] : (await fetch(`${FAKE}/__log`)).json());

const status = await (await fetch(`${BASE}/api/status`)).json();
check("A1", "status: Kimi writes scripts, Hunyuan edits", status.ai?.script === "kimi" && status.ai?.editor === "hunyuan" && status.ai?.ok, JSON.stringify(status.ai));
if (status.ai?.script !== "kimi") {
  console.log("Start the app with the Kimi/Hunyuan env vars above (fixture or real keys) and run again.");
  process.exit(1);
}

// A2 — the editor chat runs on Hunyuan (TokenHub, OpenAI-compatible, JSON mode)
const before = (await fakeLog()).length;
const res = await fetch(`${BASE}/api/chat`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ messages: [{ role: "user", content: "A delivery girl on a hoverbike races a thunderstorm across Neo Tokyo." }] }),
});
const chat = await res.json();
const hy = (await fakeLog()).slice(before).find((r) => r.provider === "hunyuan");
check(
  "A2",
  "editor chat → Hunyuan: Bearer key, model hy3, JSON mode, system prompt; pitch comes back as a valid order",
  res.ok && !!chat.pitch && (FAKE === "none" || (hy?.auth === "Bearer fixture" && hy.body.model === "hy3" && hy.body.response_format?.type === "json_object" && hy.body.messages[0].role === "system")),
  `${res.status} ${chat.pitch?.title ?? chat.error ?? ""}`,
);

// A3 — a series episode: Kimi asks for the voted canon with a tool call, gets it, then writes the script.
const mark = (await fakeLog()).length;
let out = "";
try {
  out = execFileSync("node", ["scripts/e2e-launchpad.mjs", "only=L1,L4,L5,L8"], { encoding: "utf8", env: { ...process.env, KOMA_URL: BASE } });
} catch (e) {
  out = e.stdout ?? String(e);
}
const episodeOk = /PASS L8 /.test(out);
const kimi = (await fakeLog()).slice(mark).filter((r) => r.provider === "kimi");
const asked = kimi.find((r) => r.body.tools?.some((t) => t.function.name === "get_series_canon"));
const answered = kimi.find((r) => r.body.messages?.some((m) => m.role === "tool" && m.tool_call_id === "call_canon_1" && /canon/.test(m.content)));
check(
  "A3",
  "episode script → Kimi: offered get_series_canon, called it, got the canon back, then wrote the episode",
  episodeOk && (FAKE === "none" || (!!asked && !!answered && asked.body.model === "kimi-k2.6" && asked.auth === "Bearer fixture")),
  `${episodeOk ? "episode minted + proposed" : "episode failed"}; kimi calls ${kimi.length}, tool round-trip ${Boolean(asked && answered)}`,
);

console.log(`\n${results.filter(Boolean).length}/${results.length} passed`);
process.exit(results.every(Boolean) ? 0 : 1);
