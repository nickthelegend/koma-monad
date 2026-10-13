// A returning fan's view of the settled episode: the reveal splash (real data, settled by Chainlink CRE), then the
// story so far. Short clip for the edit → work/reveal.webm.
import { renameSync } from "node:fs";
import { chromium } from "playwright";
const BASE = "https://web-production-655c7.up.railway.app";
const CURSOR = `
(() => {
  const mk = () => {
    if (document.getElementById("__cur")) return;
    const c = document.createElement("div");
    c.id = "__cur";
    c.innerHTML = '<svg width="30" height="30" viewBox="0 0 24 24"><path d="M3 2l7 19 2.6-7.4L20 11z" fill="#fff" stroke="#0a0a0a" stroke-width="1.6" stroke-linejoin="round"/></svg>';
    Object.assign(c.style, { position: "fixed", left: "0", top: "0", zIndex: 2147483647, pointerEvents: "none", transform: "translate(-3px,-2px)", filter: "drop-shadow(2px 3px 0 rgba(255,74,28,.9))" });
    const p = JSON.parse(sessionStorage.getItem("__cur") || "[960,540]");
    c.style.left = p[0] + "px"; c.style.top = p[1] + "px";
    document.documentElement.appendChild(c);
  };
  const ring = (x, y) => {
    const r = document.createElement("div");
    Object.assign(r.style, { position: "fixed", left: x - 18 + "px", top: y - 18 + "px", width: "36px", height: "36px", borderRadius: "50%", border: "3px solid #ff4a1c", zIndex: 2147483646, pointerEvents: "none", transition: "transform .45s ease-out, opacity .45s ease-out" });
    document.documentElement.appendChild(r);
    requestAnimationFrame(() => { r.style.transform = "scale(1.9)"; r.style.opacity = "0"; });
    setTimeout(() => r.remove(), 500);
  };
  addEventListener("mousemove", (e) => { mk(); const c = document.getElementById("__cur"); c.style.left = e.clientX + "px"; c.style.top = e.clientY + "px"; sessionStorage.setItem("__cur", JSON.stringify([e.clientX, e.clientY])); }, true);
  addEventListener("mousedown", (e) => ring(e.clientX, e.clientY), true);
  document.readyState === "loading" ? addEventListener("DOMContentLoaded", mk) : mk();
})();`;

const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 1600, height: 900 }, recordVideo: { dir: "video/work", size: { width: 1920, height: 1080 } } });
await ctx.addInitScript(CURSOR);
const page = await ctx.newPage();
const t0 = Date.now();
await page.goto(`${BASE}/s/1`, { waitUntil: "networkidle" });
await page.evaluate(() => localStorage.setItem("koma:seen-canon:1", "2"));
await page.mouse.move(700, 500, { steps: 10 });
const start = (Date.now() - t0) / 1000;
await page.reload({ waitUntil: "networkidle" });
await page.locator("[data-episode-reveal]").waitFor({ timeout: 20_000 });
await page.mouse.move(980, 640, { steps: 40 });
await page.waitForTimeout(6500);
await page.keyboard.press("Escape");
await page.waitForTimeout(600);
await page.evaluate(async () => {
  const el = document.querySelector("#story-so-far"); const y = el.getBoundingClientRect().top + scrollY - 110; const s = scrollY;
  for (let i = 1; i <= 50; i++) { scrollTo(0, s + ((y - s) * (1 - Math.cos((Math.PI * i) / 50))) / 2); await new Promise((r) => setTimeout(r, 20)); }
});
await page.waitForTimeout(5000);
const v = page.video(); await ctx.close(); await b.close();
renameSync(await v.path(), "video/work/reveal.webm");
console.log(JSON.stringify({ start }));
