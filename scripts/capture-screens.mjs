// Captures KOMA's key screens on the running local stack at 1440×900 and 390×844 (wallet connected with the local
// test wallet; real fork data), then builds one labelled contact sheet per size.
//   node scripts/capture-screens.mjs     → docs/screens/{desktop,mobile}/NN-name.png, docs/screens/sheets/koma-{desktop,mobile}.png
import { mkdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { chromium } from "playwright";
import { installWallet } from "./lib/wallet-shim.mjs";

const env = Object.fromEntries(readFileSync(".env.local", "utf8").split("\n").filter((l) => l.includes("=")).map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1)]));
const BASE = process.env.KOMA_URL ?? "http://localhost:4320";
const OUT = "docs/screens";
const getJson = async (p) => (await fetch(`${BASE}${p}`)).json();
const series = (await getJson("/api/series")).series ?? [];
const comics = (await getJson("/api/comics")).comics ?? [];
const open = series.find((s) => !s.graduated && !s.complete && s.sheetUrl) ?? series[0];
const grad = series.find((s) => s.graduated) ?? open;
const comic = comics.find((c) => c.credits) ?? comics[0];

const SCREENS = [
  ["home", "/", "Home"],
  ["series-board", "/series", "Series board + leaderboard"],
  ["series", `/s/${open.id}`, `Series: ${open.name}`],
  ["series-canon", `/s/${open.id}#canon`, "Canon board + autopilot"],
  ["series-graduated", `/s/${grad.id}`, "Graduated to Uniswap v4"],
  ["launch", "/launch", "Launch a series ($1)"],
  ["studio", "/create", "Studio: Hunyuan editor"],
  ["comic", `/c/${comic.id}`, "Minted issue + model credits"],
  ["reader", `/c/${comic.id}/read`, "Reader"],
  ["room", "/room", "Writers' Room (Mera passkey)"],
  ["receipts", "/receipts", "Receipts"],
  ["how", "/how", "How payment works"],
];
const SIZES = { desktop: { width: 1440, height: 900 }, mobile: { width: 390, height: 844 } };

const browser = await chromium.launch();
try {
  for (const [kind, viewport] of Object.entries(SIZES)) {
    mkdirSync(path.join(OUT, kind), { recursive: true });
    const context = await browser.newContext({ viewport, deviceScaleFactor: 1, isMobile: kind === "mobile", hasTouch: kind === "mobile" });
    const page = await context.newPage();
    await installWallet(page, env.TEST_BROWSER_KEY);
    await page.goto(`${BASE}/series`, { waitUntil: "networkidle" });
    await page.getByRole("button", { name: "Connect wallet" }).first().click().catch(() => {});
    await page.waitForTimeout(1500);
    let i = 0;
    for (const [name, url] of SCREENS) {
      await page.goto(`${BASE}${url}`, { waitUntil: "networkidle" });
      if (url.endsWith("#canon")) await page.locator("#canon").scrollIntoViewIfNeeded().catch(() => {});
      await page.waitForTimeout(900);
      await page.screenshot({ path: path.join(OUT, kind, `${String(++i).padStart(2, "0")}-${name}.png`) });
    }
    await context.close();
  }

  // Contact sheets: a labelled grid per size, rendered from the captured files.
  mkdirSync(path.join(OUT, "sheets"), { recursive: true });
  for (const [kind, { width, height }] of Object.entries(SIZES)) {
    const cols = kind === "desktop" ? 3 : 6;
    const w = kind === "desktop" ? 560 : 300;
    const h = Math.round((w * height) / width);
    const cells = SCREENS.map(([name, , label], i) => {
      const file = path.resolve(OUT, kind, `${String(i + 1).padStart(2, "0")}-${name}.png`);
      const b64 = readFileSync(file).toString("base64");
      return `<figure><img src="data:image/png;base64,${b64}" width="${w}" height="${h}"><figcaption>${String(i + 1).padStart(2, "0")} · ${label}</figcaption></figure>`;
    }).join("");
    const html = `<html><body style="margin:0;background:#0b0b0c;font:600 15px/1.3 -apple-system,Helvetica,Arial;color:#f1ece2">
      <header style="padding:28px 32px 8px"><div style="font-size:30px;font-weight:800;letter-spacing:.5px">KOMA on Monad — ${kind === "desktop" ? "desktop 1440×900" : "phone 390×844"}</div>
      <div style="color:#9a958c;font-weight:500;margin-top:4px">Local Monad testnet fork · real AUSD · real AI (Kimi K2.6, Hunyuan 3, Hunyuan Image 3) · wallet connected</div></header>
      <main style="display:grid;grid-template-columns:repeat(${cols},${w}px);gap:22px;padding:20px 32px 32px">${cells}</main>
      <style>figure{margin:0}img{display:block;border:1px solid #2a2a2e;border-radius:6px;object-fit:cover;object-position:top}figcaption{margin-top:8px;color:#d8d2c6}</style></body></html>`;
    const page = await browser.newPage({ viewport: { width: 64 + cols * w + (cols - 1) * 22, height: 400 } });
    await page.setContent(html, { waitUntil: "load" });
    await page.screenshot({ path: path.join(OUT, "sheets", `koma-${kind}.png`), fullPage: true });
    await page.close();
  }
} finally {
  await browser.close();
}
console.log(`screens → ${OUT}/{desktop,mobile}, sheets → ${OUT}/sheets`);
