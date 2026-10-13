// The walkthrough tour (read-only, no transactions): the hosted app on Monad testnet, driven by Playwright with a visible animated cursor,
// real signatures and transactions. Writes work/demo.webm and work/markers.json (seconds from the start of the video
// for each beat), which the edit is cut to. Team-seeded wallet (no MON; gasless); costs one 1-page episode.
//   node video/capture.mjs        (from the repo root)
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync, renameSync, mkdirSync } from "node:fs";
import { chromium } from "playwright";
import { privateKeyToAccount } from "viem/accounts";
import { installWallet } from "../scripts/lib/wallet-shim.mjs";

const BASE = "https://koma-comics.up.railway.app";
const OUT = "video/work3";
mkdirSync(OUT, { recursive: true });
const read = (f) => Object.fromEntries(readFileSync(f, "utf8").split("\n").filter((l) => l.includes("=")).map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).trim()]));
const seed = read(".env.seed");
const me = privateKeyToAccount(seed.SEED_KEY_1);
const others = [seed.SEED_KEY_2, seed.SEED_KEY_3, seed.SEED_KEY_4, read(".env.local").TEST_BROWSER_KEY].map((k) => privateKeyToAccount(k));
const getJson = async (p) => (await fetch(`${BASE}${p}`, { cache: "no-store" })).json();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

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

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1600, height: 900 }, recordVideo: { dir: OUT, size: { width: 1600, height: 900 } } });
const page = await context.newPage();
const t0 = Date.now();
const markers = [];
const mark = (name, extra = {}) => {
  markers.push({ name, t: (Date.now() - t0) / 1000, ...extra });
  console.log(`[${((Date.now() - t0) / 1000).toFixed(1)}s] ${name}`, Object.keys(extra).length ? JSON.stringify(extra) : "");
};
await context.addInitScript(CURSOR);
await installWallet(page, seed.SEED_KEY_1, { rpc: "https://testnet-rpc.monad.xyz", chainId: 10143, allowMonadTestnet: true });

let pos = [960, 540];
async function glide(x, y) {
  await page.mouse.move(x, y, { steps: Math.max(12, Math.round(Math.hypot(x - pos[0], y - pos[1]) / 22)) });
  pos = [x, y];
}
async function click(loc, pause = 300) {
  await loc.scrollIntoViewIfNeeded();
  const b = await loc.boundingBox();
  await glide(b.x + b.width / 2, b.y + b.height / 2);
  await page.waitForTimeout(pause);
  // The cursor shows the move; Playwright makes the click itself, on the element's current position.
  await loc.click({ timeout: 15_000 });
  const nb = await loc.boundingBox().catch(() => null);
  if (nb) pos = [nb.x + nb.width / 2, nb.y + nb.height / 2];
}
async function scrollTo(loc, offset = 160) {
  const target = await loc.evaluate((el, off) => el.getBoundingClientRect().top + scrollY - off, offset);
  await page.evaluate(async (y) => {
    const start = scrollY, d = y - start, n = 40;
    for (let i = 1; i <= n; i++) { scrollTo(0, start + (d * (1 - Math.cos((Math.PI * i) / n))) / 2); await new Promise((r) => setTimeout(r, 18)); }
  }, target);
}
const vote = async (acct, issueId, episode) => {
  const status = await getJson("/api/status");
  const signature = await acct.signTypedData({
    domain: { name: "KOMA Canon", version: "1", chainId: 10143, verifyingContract: status.launchpad.addresses.canonRegistry },
    types: { Vote: [{ name: "seriesId", type: "uint256" }, { name: "episode", type: "uint256" }, { name: "issueId", type: "uint256" }, { name: "voter", type: "address" }] },
    primaryType: "Vote",
    message: { seriesId: 1n, episode: BigInt(episode), issueId: BigInt(issueId), voter: acct.address },
  });
  const r = await fetch(`${BASE}/api/canon/1/vote`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ episode, issueId, voter: acct.address, signature }) });
  return r.ok;
};



const step = async (name, fn) => { try { await fn(); } catch (e) { mark(`FAIL ${name}`, { message: String(e).slice(0, 200) }); } };
const comics = (await getJson(`/api/comics?owner=${me.address}`)).comics ?? [];
const cat = comics.find((c) => /Lighthouse Cat/i.test(c.title)) ?? comics[0];
try {
  await page.goto(BASE, { waitUntil: "networkidle" });
  await step("connect", async () => {
    await click(page.getByRole("button", { name: "Connect wallet" }).first());
    await page.getByText("Continue with a wallet").waitFor({ timeout: 20_000 });
    await click(page.getByText("Continue with a wallet"));
    await click(page.getByText("KOMA test wallet"));
    await page.getByText(/AUSD/).first().waitFor({ timeout: 20_000 });
  });
  // the finished comic: credits, then the guided reader
  await step("issue", async () => {
    await page.goto(`${BASE}/c/${cat.id}`, { waitUntil: "networkidle" });
    mark("issue");
    await page.waitForTimeout(2500);
    await scrollTo(page.locator("[data-credits]").first(), 420);
    mark("credits");
    await page.waitForTimeout(4500);
    await page.goto(`${BASE}/c/${cat.id}/read`, { waitUntil: "networkidle" });
    await click(page.getByRole("radio", { name: "Guided" }));
    mark("guided");
    for (let i = 0; i < 4; i++) { await page.waitForTimeout(1600); await page.keyboard.press("ArrowRight"); }
    await page.waitForTimeout(1500);
  });
  await step("shelf", async () => {
    await page.goto(`${BASE}/shelf`, { waitUntil: "networkidle" });
    await page.waitForTimeout(1500);
    mark("shelf");
    await scrollTo(page.locator("[data-holdings]").first(), 200).catch(() => {});
    await page.waitForTimeout(4000);
  });
  await step("creator", async () => {
    await page.goto(`${BASE}/creator/${me.address}`, { waitUntil: "networkidle" });
    mark("creator");
    await page.waitForTimeout(4000);
    await scrollTo(page.locator("[data-earnings-chart]").first(), 200).catch(() => {});
    await page.waitForTimeout(3500);
  });
  await step("graduated", async () => {
    await page.goto(`${BASE}/s/1`, { waitUntil: "networkidle" });
    mark("signal-fire");
    await page.waitForTimeout(3000);
    await scrollTo(page.getByText(/Graduated to Uniswap v4/i).first(), 200).catch(() => {});
    mark("pool");
    await page.waitForTimeout(4000);
    await scrollTo(page.locator("#story-so-far"), 120);
    mark("story-3");
    await page.waitForTimeout(4500);
    await scrollTo(page.getByText(/Where the fees went/i).first(), 120).catch(() => {});
    mark("fees");
    await page.waitForTimeout(4000);
  });
  await step("board", async () => {
    await page.goto(`${BASE}/series`, { waitUntil: "networkidle" });
    mark("board");
    await page.waitForTimeout(3500);
    await scrollTo(page.locator("[data-top-creators]").first(), 320).catch(() => {});
    mark("leaders");
    await page.waitForTimeout(4000);
  });
  await step("how", async () => {
    await page.goto(`${BASE}/how`, { waitUntil: "networkidle" });
    mark("how");
    await page.waitForTimeout(3000);
    await page.evaluate(async () => { for (let i = 0; i < 60; i++) { scrollBy(0, 18); await new Promise((r) => setTimeout(r, 30)); } });
    await page.waitForTimeout(2500);
  });
  mark("end");
} finally {
  const video = page.video();
  await context.close();
  await browser.close();
  renameSync(await video.path(), `${OUT}/demo.webm`);
  writeFileSync(`${OUT}/markers.json`, JSON.stringify(markers, null, 2));
  console.log("saved", `${OUT}/demo.webm`);
}
