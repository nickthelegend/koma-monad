// The live demo capture: the hosted app on Monad testnet, driven by Playwright with a visible animated cursor,
// real signatures and transactions. Writes work/demo.webm and work/markers.json (seconds from the start of the video
// for each beat), which the edit is cut to. Team-seeded wallet (no MON; gasless); costs one 1-page episode.
//   node video/capture.mjs        (from the repo root)
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync, renameSync, mkdirSync } from "node:fs";
import { chromium } from "playwright";
import { privateKeyToAccount } from "viem/accounts";
import { installWallet } from "../scripts/lib/wallet-shim.mjs";

const BASE = "https://web-production-655c7.up.railway.app";
const OUT = "video/work";
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
const context = await browser.newContext({ viewport: { width: 1600, height: 900 }, recordVideo: { dir: OUT, size: { width: 1920, height: 1080 } } });
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
  await page.mouse.click(pos[0], pos[1]);
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

try {
  // ——— 1. Home ———
  await page.goto(BASE, { waitUntil: "networkidle" });
  mark("home");
  await glide(820, 520);
  await page.waitForTimeout(3500);

  // ——— 2. /monad: the live block pipeline ———
  await click(page.getByRole("link", { name: /Monad testnet/ }).first());
  await page.waitForURL(/\/monad/);
  await page.locator("[data-monad-pipeline]").getByText(/Finalized|Verified/).first().waitFor({ timeout: 20_000 });
  mark("monad");
  await glide(700, 420);
  await page.waitForTimeout(7000);

  // ——— 3. Connect, open Signal Fire ———
  await click(page.getByRole("button", { name: "Connect wallet" }).first());
  await click(page.getByText("Continue with a wallet"));
  await click(page.getByText("KOMA test wallet"));
  await page.getByText(/AUSD/).first().waitFor({ timeout: 20_000 });
  mark("connected");
  await page.goto(`${BASE}/s/1`, { waitUntil: "networkidle" });
  mark("series");
  await glide(500, 500);
  await page.waitForTimeout(3000);
  await scrollTo(page.locator("[data-previously-on]").first(), 260).catch(() => {});
  await page.waitForTimeout(3000);

  // ——— 4. Gasless buy that completes the curve → graduation ———
  const s1 = await getJson("/api/series/1");
  mark("trade", { raised: s1.raisedUsdc, target: s1.targetUsdc, graduated: s1.graduated });
  if (!s1.graduated) {
    const input = page.getByPlaceholder("0.00").first();
    await click(input);
    await input.pressSequentially("5", { delay: 120 });
    await page.waitForTimeout(1800);
    await click(page.getByRole("button", { name: "Sign & buy — no gas" }));
    const receipt = page.locator("[data-speed-receipt]").first();
    await receipt.waitFor({ timeout: 60_000 });
    await receipt.evaluate((el) => el.scrollIntoView({ block: "center", behavior: "smooth" }));
    mark("buy-receipt", { text: (await receipt.innerText()).replace(/\s+/g, " ") });
    await page.waitForTimeout(5000);
    for (let i = 0; i < 60; i++) {
      if ((await getJson("/api/series/1")).graduated) break;
      await sleep(3000);
    }
    await page.reload({ waitUntil: "networkidle" });
    mark("graduated", { graduated: (await getJson("/api/series/1")).graduated });
    await page.waitForTimeout(4500);
  }

  // ——— 5. Propose episode 3 in the studio ———
  const canonNow = await getJson("/api/canon/1");
  const ep = canonNow.episode;
  await scrollTo(page.locator("#canon"), 90);
  await page.waitForTimeout(1200);
  await click(page.getByRole("link", { name: new RegExp(`Propose episode ${ep}`) }).first());
  await page.waitForURL(/\/create/);
  const box = page.getByPlaceholder("Tell the editor your idea…");
  await box.waitFor();
  mark("studio", { episode: ep });
  await click(box);
  await box.pressSequentially("Ada finally sees who has been sending the signal: a girl on the drowned ship who looks exactly like her at twelve. One page.", { delay: 22 });
  await box.press("Enter");
  mark("pitch-asked");
  const payBtn = page.getByRole("button", { name: /^Pay .* AUSD & draw$/ });
  for (let turn = 0; turn < 3; turn++) {
    const n = await page.getByText(/^Editor( · .+)?$/).count();
    await payBtn.or(page.getByText(/^Editor( · .+)?$/).nth(n)).first().waitFor({ timeout: 150_000 });
    if (await payBtn.isVisible()) break;
    await page.waitForTimeout(1500);
    if (await payBtn.isVisible()) break;
    await box.pressSequentially("Love it. Pitch it as one page.", { delay: 25 });
    await box.press("Enter");
  }
  await payBtn.waitFor({ timeout: 150_000 });
  mark("pitched");
  await page.waitForTimeout(3500);
  await click(payBtn);
  const sign = page.getByRole("button", { name: /^Sign & pay/ });
  await sign.waitFor({ timeout: 30_000 });
  await page.waitForTimeout(1200);
  await click(sign);
  mark("paid");
  const readIt = page.getByRole("link", { name: "Read it" }).first();
  const retry = page.getByRole("button", { name: /^Try again/ });
  for (let i = 0; i < 2; i++) {
    await readIt.or(retry).first().waitFor({ timeout: 480_000 });
    if (await readIt.isVisible()) break;
    mark("retry");
    await click(retry);
  }
  const studioReceipt = page.locator("[data-speed-receipt]").first();
  await studioReceipt.evaluate((el) => el.scrollIntoView({ block: "center", behavior: "smooth" })).catch(() => {});
  mark("drawn", { receipt: (await studioReceipt.innerText().catch(() => "")).replace(/\s+/g, " ") });
  await page.waitForTimeout(5000);
  await click(readIt);
  await page.waitForURL(/\/c\//);
  mark("issue");
  await page.waitForTimeout(3000);
  await scrollTo(page.getByText(/Written by|Credits|Kimi/).first(), 300).catch(() => {});
  await page.waitForTimeout(3500);

  // ——— 6. Votes: this wallet in the UI; four other seeded wallets by signature ———
  await page.goto(`${BASE}/s/1#canon`, { waitUntil: "networkidle" });
  await scrollTo(page.locator("#canon"), 90);
  const voteBtn = page.getByRole("button", { name: "Vote", exact: true }).first();
  await voteBtn.waitFor({ timeout: 30_000 });
  mark("canon-board");
  await page.waitForTimeout(1500);
  await click(voteBtn);
  await page.getByText("Your vote", { exact: true }).first().waitFor({ timeout: 30_000 });
  mark("voted");
  const view = await getJson("/api/canon/1");
  const mine = view.proposals.at(-1)?.issueId;
  let others_ok = 0;
  for (const a of others) if (await vote(a, mine, ep)) others_ok++;
  await page.waitForTimeout(2500);
  await page.reload({ waitUntil: "networkidle" });
  await scrollTo(page.locator("#canon"), 90);
  mark("votes-in", { others: others_ok, endsAt: view.slot?.endsAt });
  await page.waitForTimeout(4000);

  // ——— 7. Wait out the window, settle with Chainlink CRE, watch the reveal ———
  const endsAt = view.slot?.endsAt ?? 0;
  mark("waiting-window");
  for (;;) {
    const s = await getJson("/api/status").catch(() => null);
    const now = Math.floor(Date.now() / 1000);
    if (now > endsAt + 3) break;
    await sleep(5000);
  }
  mark("cre-run");
  const out = execFileSync("cre", ["workflow", "simulate", "koma-canon", "--target", "staging-settings", "--non-interactive", "--trigger-index", "0", "--broadcast"], { cwd: "cre", encoding: "utf8", maxBuffer: 1 << 24 });
  const settled = out.split("\n").filter((l) => /USER LOG/.test(l)).map((l) => l.replace(/^.*USER LOG\] /, ""));
  writeFileSync(`${OUT}/cre.log`, out);
  mark("cre-done", { log: settled });
  await sleep(3000);
  await page.reload({ waitUntil: "networkidle" });
  const reveal = page.locator("[data-episode-reveal]");
  await reveal.waitFor({ timeout: 30_000 }).catch(() => {});
  mark("reveal", { shown: await reveal.count() });
  await glide(980, 700);
  await page.waitForTimeout(6000);
  await page.keyboard.press("Escape");
  await scrollTo(page.locator("#story-so-far"), 120).catch(() => {});
  mark("story");
  await page.waitForTimeout(4000);

  // ——— 8. Writers' Room: one passkey; the unlock verified by Monad's P256 precompile ———
  const cdp = await context.newCDPSession(page);
  await cdp.send("WebAuthn.enable");
  await cdp.send("WebAuthn.addVirtualAuthenticator", { options: { protocol: "ctap2", ctap2Version: "ctap2_1", transport: "internal", hasResidentKey: true, hasUserVerification: true, isUserVerified: true, hasPrf: true, automaticPresenceSimulation: true } });
  await page.goto(`${BASE}/room`, { waitUntil: "networkidle" });
  mark("room");
  await click(page.getByRole("button", { name: /Create a room passkey/ }));
  await page.getByText(/locks in/).first().waitFor({ timeout: 30_000 });
  await page.waitForTimeout(1500);
  await click(page.getByRole("button", { name: "Lock now" }));
  await page.getByText("Your room is locked").waitFor({ timeout: 15_000 });
  await page.waitForTimeout(800);
  await click(page.getByRole("button", { name: /Open with passkey/ }));
  const badge = page.locator("[data-passkey-onchain]");
  await badge.waitFor({ timeout: 30_000 }).catch(() => {});
  mark("room-verified", { badge: (await badge.innerText().catch(() => "")).replace(/\s+/g, " ") });
  await badge.hover().catch(() => {});
  await page.waitForTimeout(5000);

  // ——— 9. Back home ———
  await page.goto(BASE, { waitUntil: "networkidle" });
  mark("end");
  await page.waitForTimeout(3000);
} catch (e) {
  mark("error", { message: String(e).slice(0, 300) });
  await page.screenshot({ path: `${OUT}/error.png` }).catch(() => {});
} finally {
  const video = page.video();
  await context.close();
  await browser.close();
  const p = await video.path();
  renameSync(p, `${OUT}/demo.webm`);
  writeFileSync(`${OUT}/markers.json`, JSON.stringify(markers, null, 2));
  console.log("saved", `${OUT}/demo.webm`);
}
