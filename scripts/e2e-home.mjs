// The first 60 seconds and the board: the home hero leads with the fan-canon loop, live numbers come from the board,
// each sponsor's job links to where it's visible; /series features an illustrated series; a /launch preset fills a
// complete, valid launch (the quote endpoint accepts it). Desktop + 390 px, clean console. No AI spend.
//   node scripts/e2e-home.mjs        (app on :4320)
import { chromium } from "playwright";

const BASE = process.env.KOMA_URL ?? "http://localhost:4320";
const results = [];
const check = (id, name, ok, detail = "") => {
  results.push(ok);
  console.log(`${ok ? "PASS" : "FAIL"} ${id} ${name}${detail ? ` — ${detail}` : ""}`);
};
const browser = await chromium.launch();
try {
  for (const [size, viewport] of [["desktop", { width: 1440, height: 900 }], ["phone", { width: 390, height: 844 }]]) {
    const page = await browser.newPage({ viewport });
    const errors = [];
    page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
    await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
    const hero = await page.locator("#hero-title").innerText();
    const stats = await page.locator("[data-home-stats] dd").allInnerTexts();
    const made = await page.locator("[data-made-by] a").count();
    const toMonad = await page.locator('[data-made-by] a[href="/monad"]').count();
    check(`H1-${size}`, "home: the hero leads with the fan-canon loop; live board numbers; who makes what, linked", /fans write/i.test(hero) && stats.length >= 5 && stats.every((v) => v.trim() !== "") && made === 8 && toMonad === 1, `${stats.join(" · ")}`);

    await page.goto(`${BASE}/series`, { waitUntil: "networkidle" });
    const featuredArt = await page.locator('article[aria-labelledby="featured-h"] img').count();
    check(`H2-${size}`, "/series: the featured series has character art", featuredArt > 0);

    await page.goto(`${BASE}/launch`, { waitUntil: "networkidle" });
    await page.locator("[data-launch-presets] button").first().click();
    const name = await page.getByLabel("Series name").inputValue();
    const look = await page.getByLabel("What they look like").inputValue();
    const quote = page.waitForResponse((r) => r.url().includes("/api/series/quote"), { timeout: 20_000 });
    await page.getByRole("button", { name: /^Pay .* AUSD & launch$/ }).click();
    const q = await quote;
    check(`H3-${size}`, "/launch: a preset fills a complete launch that the quote endpoint accepts", name.length > 3 && look.length > 20 && (q.status() === 200 || q.status() === 402), `"${name}" → quote ${q.status()}`);
    check(`H4-${size}`, "clean console", errors.length === 0, errors.slice(0, 2).join(" | "));
    await page.close();
  }
} finally {
  await browser.close();
}
console.log(`\n${results.filter(Boolean).length}/${results.length} passed`);
process.exit(results.every(Boolean) ? 0 : 1);
