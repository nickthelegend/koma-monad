// Wave 3 on real indexed data: top creators on /series, "Previously on…" (one cached Kimi call per canon episode),
// the embeddable series card, and "since your last visit". Shots → docs/screens/wave3/after/ when SHOTS=1.
//   node scripts/e2e-wave3.mjs   (app on :4320; spends one short LLM call per series without a recap)
import { mkdirSync } from "node:fs";
import { chromium } from "playwright";

const BASE = process.env.KOMA_URL ?? "http://localhost:4320";
const SHOTS = process.env.SHOTS === "1";
const OUT = "docs/screens/wave3/after";
const results = [];
const check = (id, name, ok, detail = "") => {
  results.push(ok);
  console.log(`${ok ? "PASS" : "FAIL"} ${id} ${name}${detail ? ` — ${detail}` : ""}`);
};
const getJson = async (p) => (await fetch(`${BASE}${p}`)).json();
const series = (await getJson("/api/series")).series;
const settled = series.find((s) => s.episodes > 0 && s.sheetUrl) ?? series.find((s) => s.episodes > 0);
if (SHOTS) mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch();
try {
  const open = async (viewport = { width: 1280, height: 900 }, opts = {}) => {
    const ctx = await browser.newContext({ viewport, ...opts });
    const page = await ctx.newPage();
    const errors = [];
    page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
    page.on("pageerror", (e) => errors.push(e.message));
    return { ctx, page, errors };
  };
  const overflow = (page) => page.evaluate(() => document.documentElement.scrollWidth - innerWidth);

  // ——— K: top creators ———
  {
    const { ctx, page, errors } = await open();
    await page.goto(`${BASE}/series`, { waitUntil: "networkidle" });
    const box = page.locator("[data-top-creators]");
    await box.scrollIntoViewIfNeeded();
    const rows = box.locator("li");
    const n = await rows.count();
    const creators = new Set(series.map((s) => s.creator.toLowerCase())).size;
    const firstAmt = (await rows.first().locator("span").last().innerText()).trim();
    if (SHOTS) await box.screenshot({ path: `${OUT}/top-creators.png` });
    await rows.first().locator("a").click();
    await page.waitForURL(/\/creator\/0x/);
    const headline = (await page.locator("[data-creator-earned]").innerText()).trim();
    check("K1", "/series ranks top creators by earnings; the #1 row matches their creator page", n === Math.min(5, creators) && firstAmt === headline && errors.length === 0, `${n} creators, #1 ${firstAmt}`);
    await ctx.close();
  }

  // ——— P: Previously on… ———
  {
    const t0 = Date.now();
    const a = (await getJson(`/api/series/${settled.id}/recap`)).recap;
    const t1 = Date.now();
    const b = (await getJson(`/api/series/${settled.id}/recap`)).recap;
    const t2 = Date.now();
    const words = a?.text.split(/\s+/).length ?? 0;
    check("P1", "the recap is written once per canon episode, short, credited to the script model, then served from cache", !!a && words >= 6 && words <= 48 && a.episode === settled.episodes && /kimi/i.test(a.model) && b?.text === a.text && t2 - t1 < 1000, `${words} words, ${a?.model}, first ${t1 - t0} ms, cached ${t2 - t1} ms: “${a?.text}”`);
    const { ctx, page, errors } = await open({ width: 390, height: 844 });
    await page.goto(`${BASE}/s/${settled.id}`, { waitUntil: "networkidle" });
    const box = page.locator("[data-previously-on]");
    await box.waitFor({ timeout: 10_000 });
    check("P2", "the series page shows it under the pitch", (await box.innerText()).includes(a.text) && (await overflow(page)) <= 1 && errors.length === 0);
    await ctx.close();
  }

  // ——— B: embeddable card ———
  {
    const { ctx, page, errors } = await open({ width: 1280, height: 900 }, { permissions: ["clipboard-read", "clipboard-write"] });
    await page.goto(`${BASE}/s/${settled.id}`, { waitUntil: "networkidle" });
    await page.locator("[data-embed-button]").click();
    const code = await page.evaluate(() => navigator.clipboard.readText());
    const src = code.match(/src="([^"]+)"/)?.[1];
    await page.setContent(`<body style="margin:0;background:#ddd;padding:24px"><p style="font:14px sans-serif">A creator's own site</p>${code}</body>`);
    const frame = page.frameLocator("iframe");
    await frame.locator("[data-embed]").waitFor({ timeout: 15_000 });
    const card = await frame.locator("[data-embed]").innerText();
    const chrome = await frame.locator("header:visible, footer:visible").count();
    const href = await frame.locator("[data-embed]").getAttribute("href");
    if (SHOTS) await page.screenshot({ path: `${OUT}/embed-card.png`, clip: { x: 0, y: 0, width: 440, height: 520 } });
    check("B1", "Embed copies an <iframe> for /embed/s/:id, and the card names the character", !!src && src.endsWith(`/embed/s/${settled.id}`) && card.toLowerCase().includes(settled.characterName.toLowerCase()), src ?? "no src");
    check("B2", "…with its holders and canon count, and no header/footer inside the frame", new RegExp(`${settled.holders} holders`, "i").test(card) && new RegExp(`${settled.episodes} canon`, "i").test(card) && chrome === 0 && href === `/s/${settled.id}` && errors.length === 0, `${settled.holders} holders, ${settled.episodes} canon`);
    await ctx.close();
  }

  // ——— V: since your last visit ———
  {
    const { ctx, page, errors } = await open({ width: 390, height: 844 });
    await page.goto(`${BASE}/s/${settled.id}`, { waitUntil: "networkidle" });
    await page.waitForTimeout(800);
    const first = await page.locator("[data-since-last-visit]").count();
    const stored = Number(await page.evaluate((k) => localStorage.getItem(k), `koma:last-visit:${settled.id}`));
    check("V1", "first visit: remembers the chain time, shows nothing", first === 0 && stored > 0, `t=${stored}`);
    const since = settled.launchedAt - 1;
    const api = await getJson(`/api/series/${settled.id}/since?t=${since}`);
    await page.evaluate(([k, v]) => localStorage.setItem(k, v), [`koma:last-visit:${settled.id}`, String(since)]);
    await page.reload({ waitUntil: "networkidle" });
    const box = page.locator("[data-since-last-visit]");
    await box.waitFor({ timeout: 10_000 });
    const t = (await box.innerText()).toLowerCase(); // chips are CSS-uppercased
    if (SHOTS) {
      await page.locator("h1").scrollIntoViewIfNeeded();
      await page.screenshot({ path: `${OUT}/series-header-mobile.png` });
    }
    check("V2", "a return visit shows chips for the trades, proposals and canon since then (matching the index)", t.includes(`${api.trades} trade`) && api.settled.every((e) => t.includes(`episode ${e} is canon`)) && errors.length === 0, `${api.trades} trades, ${api.proposals} proposals, settled ${api.settled.join(",") || "none"}`);
    await ctx.close();
  }
} finally {
  await browser.close();
}
console.log(`\n${results.filter(Boolean).length}/${results.length} passed`);
process.exit(results.every(Boolean) ? 0 : 1);
