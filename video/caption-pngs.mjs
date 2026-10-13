// Captions and the "LIVE · MONAD TESTNET" tag as transparent PNGs, in KOMA's type (this ffmpeg has no libass).
import { mkdirSync, readFileSync } from "node:fs";
import { chromium } from "playwright";
const { caps } = JSON.parse(readFileSync("video/work/captions.json", "utf8"));
mkdirSync("video/work/cap", { recursive: true });
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1920, height: 400 } });
await p.setContent(`<html><head><link href="https://fonts.googleapis.com/css2?family=Schibsted+Grotesk:wght@700&family=JetBrains+Mono:wght@700&display=block" rel="stylesheet"><style>
  html,body{margin:0;background:transparent}
  #c{display:inline-block;max-width:1500px;font-family:"Schibsted Grotesk";font-weight:700;font-size:46px;line-height:1.25;color:#f1ece2;background:rgba(0,0,0,.78);padding:12px 26px;border-left:6px solid #ff4a1c;text-align:center}
  #t{display:inline-block;font-family:"JetBrains Mono";font-weight:700;font-size:24px;letter-spacing:.08em;color:#2ea3f2;background:rgba(0,0,0,.85);border:2px solid #2ea3f2;padding:6px 14px}
</style></head><body><span id="c"></span><span id="t">● LIVE · MONAD TESTNET</span></body></html>`);
await p.evaluate(() => document.fonts.ready);
await p.locator("#t").screenshot({ path: "video/work/cap/live.png", omitBackground: true });
await p.evaluate(() => (document.getElementById("t").style.display = "none"));
for (const [n, c] of caps.entries()) {
  await p.evaluate((t) => (document.getElementById("c").textContent = t), c.text);
  await p.locator("#c").screenshot({ path: `video/work/cap/${String(n).padStart(3, "0")}.png`, omitBackground: true });
}
await b.close();
console.log(`${caps.length} caption PNGs + live tag`);
