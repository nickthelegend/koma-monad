// After-screenshots for the development wave, at 1440×900 and 390×844, on the running local stack with the test
// wallet connected. One scene list per feature: node scripts/capture-wave.mjs <feature>  → docs/screens/wave/after/
import { mkdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { chromium } from "playwright";
import { setAusd } from "./lib/ausd.mjs";
import { installWallet } from "./lib/wallet-shim.mjs";
import { createPublicClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";

const env = Object.fromEntries(readFileSync(".env.local", "utf8").split("\n").filter((l) => l.includes("=")).map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1)]));
const BASE = process.env.KOMA_URL ?? "http://localhost:4320";
const OUT = "docs/screens/wave/after";
const feature = process.argv[2];
const getJson = async (p) => (await fetch(`${BASE}${p}`)).json();
const series = (await getJson("/api/series")).series ?? [];
const comics = (await getJson("/api/comics")).comics ?? [];
const open = series.find((s) => !s.graduated && !s.complete && s.sheetUrl) ?? series.find((s) => !s.graduated && !s.complete);
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
    ["reader-page", async (page) => page.goto(`${BASE}/c/${comic.id}/read`, { waitUntil: "networkidle" })],
    ["reader-guided", async (page) => {
      await page.goto(`${BASE}/c/${comic.id}/read`, { waitUntil: "networkidle" });
      await page.getByRole("button", { name: /Guided/ }).click();
      await page.keyboard.press("ArrowRight");
      await page.waitForTimeout(700);
    }],
  ],
  canon: [["canon-timeline", async (page) => {
    await page.goto(`${BASE}/s/${settled.id}`, { waitUntil: "networkidle" });
    await page.locator("#story-so-far").scrollIntoViewIfNeeded();
    await page.waitForTimeout(500);
  }]],
  home: [["home", async (page) => page.goto(`${BASE}/`, { waitUntil: "networkidle" })], ["studio", async (page) => page.goto(`${BASE}/create`, { waitUntil: "networkidle" })]],
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
    for (const [name, run] of SCENES[feature]) {
      await run(page);
      await page.waitForTimeout(600);
      await page.screenshot({ path: path.join(OUT, `${name}-${size}.png`) });
    }
    await context.close();
  }
} finally {
  await browser.close();
}
console.log(`after-shots → ${OUT} (${feature})`);
