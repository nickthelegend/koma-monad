// Narration: one ElevenLabs clip per line (voice George), with character timestamps for captions.
// Cached by text, so only changed lines are re-voiced. Reads video/script.json → work/vo/<id>.mp3 + .json.
//   node video/tts.mjs
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";

const env = Object.fromEntries(readFileSync(".env.local", "utf8").split("\n").filter((l) => l.includes("=")).map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).trim()]));
const VOICE = "JBFqnCBsd6RMkjVDRZzb"; // George: warm, captivating storyteller
const OUT = "video/work/vo";
mkdirSync(OUT, { recursive: true });
const script = JSON.parse(readFileSync("video/script.json", "utf8"));
let chars = 0;
for (const line of script.lines) {
  const say = line.say ?? line.text;
  const h = createHash("sha1").update(`${VOICE}|${say}`).digest("hex").slice(0, 10);
  const meta = `${OUT}/${line.id}.json`;
  if (existsSync(meta) && JSON.parse(readFileSync(meta, "utf8")).hash === h) continue;
  const r = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${VOICE}/with-timestamps?output_format=mp3_44100_128`, {
    method: "POST",
    headers: { "xi-api-key": env.ELEVENLABS_API_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ text: say, model_id: "eleven_multilingual_v2", voice_settings: { stability: 0.45, similarity_boost: 0.8, style: 0.3, speed: line.speed ?? 1.0 } }),
  });
  if (!r.ok) throw new Error(`${line.id}: ${r.status} ${(await r.text()).slice(0, 200)}`);
  const j = await r.json();
  writeFileSync(`${OUT}/${line.id}.mp3`, Buffer.from(j.audio_base64, "base64"));
  const a = j.alignment;
  const seconds = a.character_end_times_seconds.at(-1);
  // Words with start/end, for captions.
  const words = [];
  let cur = null;
  a.characters.forEach((c, i) => {
    if (/\s/.test(c)) { if (cur) words.push(cur); cur = null; return; }
    if (!cur) cur = { w: "", s: a.character_start_times_seconds[i], e: 0 };
    cur.w += c;
    cur.e = a.character_end_times_seconds[i];
  });
  if (cur) words.push(cur);
  writeFileSync(meta, JSON.stringify({ id: line.id, hash: h, text: line.text, seconds, words }, null, 1));
  chars += say.length;
  console.log(`${line.id} ${seconds.toFixed(2)}s  ${line.text.slice(0, 70)}`);
}
console.log(`voiced ${chars} new characters`);
