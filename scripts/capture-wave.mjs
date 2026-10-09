// After-screenshots for the development wave, at 1440×900 and 390×844, on the running local stack with the test
// wallet connected. One scene list per feature: node scripts/capture-wave.mjs <feature>  → docs/screens/wave/after/
import { writeFileSync, mkdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { chromium } from "playwright";
import { setAusd } from "./lib/ausd.mjs";
import { installWallet } from "./lib/wallet-shim.mjs";
import { createPublicClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";

const env = Object.fromEntries(readFileSync(".env.local", "utf8").split("\n").filter((l) => l.includes("=")).map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1)]));
const BASE = process.env.KOMA_URL ?? "http://localhost:4320";
const OUT = process.env.OUT ?? "docs/screens/wave/after";
const textLen = {};
const feature = process.argv[2];
const getJson = async (p) => (await fetch(`${BASE}${p}`)).json();
const series = (await getJson("/api/series")).series ?? [];
const comics = (await getJson("/api/comics")).comics ?? [];
// A gasless buy needs $3 of room left on the curve.
const room = (s) => !s.graduated && !s.complete && s.targetUsdc - s.raisedUsdc > 5;
const open = series.find((s) => room(s) && s.sheetUrl) ?? series.find(room);
const settled = series.find((s) => s.episodes > 0 && s.sheetUrl) ?? series.find((s) => s.episodes > 0) ?? open;
const comic = comics.find((c) => c.credits && c.pageCount > 1) ?? comics.find((c) => c.credits) ?? comics[0];
const me = privateKeyToAccount(env.TEST_BROWSER_KEY);

/** Each scene: (page) => Promise<void>, then a viewport screenshot named `${name}-${size}.png`. */
const SCENES = {
  speed: [
    ["trade-receipt", async (page) => {
      await page.goto(`${BASE}/s/${open.id}#trade`, { waitUntil: "networkidle" });
      await page.getByPlaceholder("0.00").first().fill("3");
      await page.getByRole("button", { name: "Sign & buy — no gas" }).click();
      const r = page.locator("[data-speed-receipt]").first();
      await r.waitFor({ timeout: 30_000 });
      await r.scrollIntoViewIfNeeded();
      await page.evaluate(() => window.scrollBy(0, -260));
    }],
    ["receipts", async (page) => page.goto(`${BASE}/receipts`, { waitUntil: "networkidle" })],
  ],
  reader: [
    ["reader-pages", async (page) => {
      await page.goto(`${BASE}/c/${comic.id}/read`, { waitUntil: "networkidle" });
      await page.getByRole("radio", { name: "Pages" }).click();
    }],
    ["reader-guided", async (page) => {
      await page.goto(`${BASE}/c/${comic.id}/read`, { waitUntil: "networkidle" });
      await page.getByRole("radio", { name: "Guided" }).click();
      await page.keyboard.press("ArrowRight");
      await page.keyboard.press("ArrowRight");
      await page.waitForTimeout(700);
    }],
  ],
  canon: [["canon-timeline", async (page) => {
    await page.goto(`${BASE}/s/${settled.id}`, { waitUntil: "networkidle" });
    await page.locator("#story-so-far").scrollIntoViewIfNeeded();
    await page.waitForTimeout(500);
  }]],
  monad: [["monad", async (page) => {
    await page.goto(`${BASE}/monad`, { waitUntil: "domcontentloaded" });
    await page.locator("[data-monad-pipeline]").getByText(/Finalized|Verified/).first().waitFor({ timeout: 15_000 });
    await page.waitForTimeout(3000);
  }]],
  home: [["home", async (page) => page.goto(`${BASE}/`, { waitUntil: "networkidle" })], ["studio", async (page) => page.goto(`${BASE}/create`, { waitUntil: "networkidle" })]],
  // The readability pass: the densest screens, full page, with their visible text measured (OUT=…/before|after).
  declutter: [
    ["trade-receipt", async (page) => {
      await page.goto(`${BASE}/s/${open.id}#trade`, { waitUntil: "networkidle" });
      await page.getByPlaceholder("0.00").first().fill("3");
      await page.getByRole("button", { name: "Sign & buy — no gas" }).click();
      const r = page.locator("[data-speed-receipt]").first();
      await r.waitFor({ timeout: 30_000 });
      await r.evaluate((el) => el.scrollIntoView({ block: "center" }));
    }],
    ["receipts", async (page) => page.goto(`${BASE}/receipts`, { waitUntil: "networkidle" }), true],
    ["monad", async (page) => {
      await page.goto(`${BASE}/monad`, { waitUntil: "domcontentloaded" });
      await page.locator("[data-monad-pipeline]").getByText(/Finalized|Verified/).first().waitFor({ timeout: 15_000 });
      await page.waitForTimeout(3000);
    }, true],
    ["series", async (page) => page.goto(`${BASE}/s/${settled.id}`, { waitUntil: "networkidle" }), true],
  ],
  board: [["series-board", async (page) => page.goto(`${BASE}/series`, { waitUntil: "networkidle" })], ["launch-presets", async (page) => page.goto(`${BASE}/launch`, { waitUntil: "networkidle" })]],
};
if (!SCENES[feature]) throw new Error(`feature: ${Object.keys(SCENES).join(" | ")}`);

const chain = createPublicClient({ transport: http(env.NEXT_PUBLIC_MONAD_RPC_URL || "http://127.0.0.1:18643") });
await setAusd(chain, me.address, 50_000_000n);
mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch();
try {
  for (const [size, viewport] of Object.entries({ desktop: { width: 1440, height: 900 }, mobile: { width: 390, height: 844 } })) {
    const context = await browser.newContext({ viewport, isMobile: size === "mobile", hasTouch: size === "mobile" });
    const page = await context.newPage();
    await installWallet(page, env.TEST_BROWSER_KEY);
    await page.goto(`${BASE}/series`, { waitUntil: "networkidle" });
    await page.getByRole("button", { name: "Connect wallet" }).first().click().catch(() => {});
    await page.waitForTimeout(1200);
    for (const [name, run, fullPage] of SCENES[feature]) {
      await run(page);
      await page.waitForTimeout(600);
      await page.screenshot({ path: path.join(OUT, `${name}-${size}.png`), fullPage: Boolean(fullPage) });
      // Visible words in <main> (not the shared nav/footer): what a reader has to get through.
      textLen[`${name}-${size}`] = await page.evaluate(() => (document.querySelector("main") ?? document.body).innerText.split(/\s+/).filter(Boolean).length);
    }
    await context.close();
  }
} finally {
  await browser.close();
}
writeFileSync(path.join(OUT, `words-${feature}.json`), JSON.stringify(textLen, null, 2));
console.log(`shots → ${OUT} (${feature})`, textLen);
