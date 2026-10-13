// Records video/intro.html (a plan of scenes, or the outro card) to an mp4 at 1920×1080, trimmed to its start.
//   node video/render-html.mjs intro|outro|cre <seconds>
import { execFileSync } from "node:child_process";
import { renameSync } from "node:fs";
import path from "node:path";
import { chromium } from "playwright";
const [kind, secs] = [process.argv[2], Number(process.argv[3])];
const plan = kind === "pitch-cards" ? [["s7", 0], ["s1", 7.4], ["s6", 14.0]] : [["s1", 0], ["s2", 7.0], ["s3", 16.0], ["s4", 22.2], ["s5", 30.4]];
const PITCH = [["h", 0], ["t", 4.6], ["p", 13.6], ["w", 22.0], ["v", 31.8], ["pr", 44.7], ["u", 57.0], ["c", 68.8]];
const url = kind === "pitch" ? `file://${path.resolve("video/pitch.html")}?plan=${encodeURIComponent(JSON.stringify(PITCH))}` : kind === "cre" ? `file://${path.resolve("video/cre-card.html")}` : `file://${path.resolve("video/intro.html")}?${kind === "outro" ? "outro=1" : `plan=${encodeURIComponent(JSON.stringify(plan))}`}`;
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 1920, height: 1080 }, recordVideo: { dir: "video/work", size: { width: 1920, height: 1080 } } });
const p = await ctx.newPage();
const t0 = Date.now();
await p.goto(url, { waitUntil: "networkidle" });
await p.evaluate(async () => { await document.fonts.ready; await Promise.all([...document.images].map((i) => i.decode().catch(() => {}))); });
const start = (Date.now() - t0) / 1000;
await p.evaluate(() => window.__go());
await p.waitForTimeout(secs * 1000 + 300);
const v = p.video();
await ctx.close();
await b.close();
const raw = `video/work/${kind}-raw.webm`;
renameSync(await v.path(), raw);
execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-ss", String(start + 0.05), "-i", raw, "-t", String(secs), "-r", "30", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "18", `video/work/${kind}.mp4`]);
console.log(`video/work/${kind}.mp4 (${secs}s, trimmed ${start.toFixed(2)}s of load)`);
