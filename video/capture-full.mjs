// The full-flow capture (submission cut + walkthrough): the hosted app on Monad testnet, driven by Playwright with a visible animated cursor,
// real signatures and transactions. Writes work/demo.webm and work/markers.json (seconds from the start of the video
// for each beat), which the edit is cut to. Team-seeded wallet (no MON; gasless); costs one 1-page episode.
//   node video/capture.mjs        (from the repo root)
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync, renameSync, mkdirSync } from "node:fs";
import { chromium } from "playwright";
import { privateKeyToAccount } from "viem/accounts";
import { installWallet } from "../scripts/lib/wallet-shim.mjs";

const BASE = "https://web-production-655c7.up.railway.app";
const OUT = "video/work2";
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


const step = async (name, fn) => { try { await fn(); } catch (e) { mark(`FAIL ${name}`, { message: String(e).slice(0, 240) }); await page.screenshot({ path: `${OUT}/fail-${name}.png` }).catch(() => {}); } };
const relay = async (acct, curve, dollars, usdc) => {
  // a seeded wallet's gasless buy (same signing the browser does)
  const { createPublicClient, http, parseAbi, encodeAbiParameters, keccak256, stringToBytes, toHex } = await import("viem");
  const { randomBytes } = await import("node:crypto");
  const chain = createPublicClient({ transport: http("https://testnet-rpc.monad.xyz") });
  const usdcIn = BigInt(dollars * 1e6);
  const [coinOut] = await chain.readContract({ address: curve, abi: parseAbi(["function quoteBuy(uint256) view returns (uint256,uint256)"]), functionName: "quoteBuy", args: [usdcIn] });
  const deadline = BigInt(Math.floor(Date.now() / 1000) + 600), salt = toHex(randomBytes(32)), min = (coinOut * 98n) / 100n;
  const nonce = keccak256(encodeAbiParameters([{ type: "bytes32" }, { type: "address" }, { type: "address" }, { type: "uint256" }, { type: "uint256" }, { type: "uint256" }, { type: "bytes32" }], [keccak256(stringToBytes("KOMA_BUY_V1")), curve, acct.address, usdcIn, min, deadline, salt]));
  const signature = await acct.signTypedData({ domain: { name: "Agora Dollar", version: "1", chainId: 10143, verifyingContract: usdc }, types: { ReceiveWithAuthorization: [{ name: "from", type: "address" }, { name: "to", type: "address" }, { name: "value", type: "uint256" }, { name: "validAfter", type: "uint256" }, { name: "validBefore", type: "uint256" }, { name: "nonce", type: "bytes32" }] }, primaryType: "ReceiveWithAuthorization", message: { from: acct.address, to: curve, value: usdcIn, validAfter: 0n, validBefore: deadline, nonce } });
  const r = await fetch(`${BASE}/api/trade/relay`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ kind: "buy", curve, buyer: acct.address, usdcIn: String(usdcIn), minCoinOut: String(min), deadline: String(deadline), salt, validAfter: "0", validBefore: String(deadline), signature }) });
  return r.ok;
};
async function studioPitch(idea) {
  const box = page.getByPlaceholder("Tell the editor your idea…");
  await box.waitFor();
  await click(box);
  await box.pressSequentially(idea, { delay: 18 });
  await box.press("Enter");
  mark("pitch-asked");
  const payBtn = page.getByRole("button", { name: /^Pay .* AUSD & draw$/ });
  for (let turn = 0; turn < 3; turn++) {
    const n = await page.getByText(/^Editor( · .+)?$/).count();
    await payBtn.or(page.getByText(/^Editor( · .+)?$/).nth(n)).first().waitFor({ timeout: 150_000 });
    if (await payBtn.isVisible()) break;
    await page.waitForTimeout(1500);
    if (await payBtn.isVisible()) break;
    await box.pressSequentially("Love it. Pitch it as one page.", { delay: 20 });
    await box.press("Enter");
  }
  await payBtn.waitFor({ timeout: 150_000 });
  mark("pitched");
  await page.waitForTimeout(3500);
  await click(payBtn);
  const sign = page.getByRole("button", { name: /^Sign & pay/ });
  await sign.waitFor({ timeout: 30_000 });
  await page.waitForTimeout(2200); // the pay sheet: price, network, AUSD
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
  const rc = page.locator("[data-speed-receipt]").first();
  await rc.evaluate((el) => el.scrollIntoView({ block: "center", behavior: "smooth" })).catch(() => {});
  mark("drawn", { receipt: (await rc.innerText().catch(() => "")).replace(/\s+/g, " ") });
  await page.waitForTimeout(4000);
  return readIt;
}

const status = await getJson("/api/status");
let S = null, ep = 1, endsAt = 0;
try {
  // 1. Home: the problem, the user
  await page.goto(BASE, { waitUntil: "networkidle" });
  mark("home");
  await glide(760, 560);
  await page.waitForTimeout(5000);
  await scrollTo(page.locator("[data-made-by]").first(), 380).catch(() => {});
  mark("home-proof");
  await page.waitForTimeout(4500);
  await page.evaluate(() => scrollTo({ top: 0, behavior: "smooth" }));
  await page.waitForTimeout(800);

  // 2. Connect with Privy
  await step("connect", async () => {
    await click(page.getByRole("button", { name: "Connect wallet" }).first());
    await page.getByText("Continue with a wallet").waitFor({ timeout: 20_000 });
    mark("privy");
    await page.waitForTimeout(2500); // Privy's sign-in modal: email, Google, passkey, wallet
    await click(page.getByText("Continue with a wallet"));
    await page.waitForTimeout(1200);
    await click(page.getByText("KOMA test wallet"));
    await page.getByText(/AUSD/).first().waitFor({ timeout: 20_000 });
    mark("connected");
    await page.waitForTimeout(1500);
  });

  // 3. A standalone comic: Hunyuan pitch → x402 → Kimi + FLUX → minted
  await step("comic", async () => {
    await click(page.getByRole("navigation").getByRole("link", { name: /^create$/i }).first()).catch(() => {});
    await page.waitForURL(/\/create/, { timeout: 6000 }).catch(() => page.goto(`${BASE}/create`, { waitUntil: "networkidle" }));
    mark("studio");
    const readIt = await studioPitch("A lighthouse cat who keeps the lamp lit while the keeper sleeps, and the night a ship answers back. One page, cozy.");
    await click(readIt);
    await page.waitForURL(/\/c\//);
    mark("issue");
    await page.waitForTimeout(2500);
    await scrollTo(page.locator("[data-credits]").first(), 420);
    mark("credits", { text: (await page.locator("[data-credits]").first().innerText()).replace(/\s+/g, " ") });
    await page.waitForTimeout(4500);
  });

  // 4. Launch a series ($1 over x402; FLUX character sheet; Character NFT + wallet + coin + curve)
  await step("launch", async () => {
    await page.goto(`${BASE}/launch`, { waitUntil: "networkidle" });
    mark("launch");
    const n = String(Date.now()).slice(-3);
    const typ = async (label, text, d = 14) => { const f = page.getByLabel(label); await click(f, 150); await f.pressSequentially(text, { delay: d }); };
    await typ("Series name", "Ferry of Lost Things");
    await typ("Ticker", `FLT${n}`.slice(0, 6));
    await typ("Character name", "Odile Marsh");
    await page.getByLabel("What they look like").fill("a lanky ferry captain with a grey braid, a teal oilskin coat and a brass lantern on her belt");
    await page.getByLabel("The pitch").fill("The last ferry of the night only carries people who have lost something, and Odile has to return it before dawn.");
    await page.waitForTimeout(1200);
    await click(page.getByRole("button", { name: /^Pay .* AUSD & launch$/ }));
    const sign = page.getByRole("button", { name: /^Sign & pay/ });
    await sign.waitFor({ timeout: 30_000 });
    await page.waitForTimeout(1800);
    await click(sign);
    mark("launch-paid");
    const openLink = page.getByRole("link", { name: /^Open \$/ });
    await openLink.waitFor({ timeout: 300_000 });
    mark("launched");
    await page.waitForTimeout(3000);
    await click(openLink);
    await page.waitForURL(/\/s\/\d+/);
    const id = Number(page.url().match(/\/s\/(\d+)/)[1]);
    for (let i = 0; i < 20 && !S; i++) { const r = await fetch(`${BASE}/api/series/${id}`); if (r.ok) S = await r.json(); else await sleep(1500); }
    mark("series", { id });
    await page.waitForTimeout(3500);
  });

  // 5. Gasless buy (UI) + three seeded wallets buy in the background (they're holders before episode 1 opens)
  await step("buy", async () => {
    const bg = Promise.all(others.slice(0, 3).map((a) => relay(a, S.curve, 3, status.usdc).catch(() => false)));
    const input = page.getByPlaceholder("0.00").first();
    await click(input);
    await input.pressSequentially("5", { delay: 120 });
    await page.waitForTimeout(1800);
    await click(page.getByRole("button", { name: "Sign & buy — no gas" }));
    const rc = page.locator("[data-speed-receipt]").first();
    await rc.waitFor({ timeout: 60_000 });
    await rc.evaluate((el) => el.scrollIntoView({ block: "center", behavior: "smooth" }));
    mark("buy-receipt", { text: (await rc.innerText()).replace(/\s+/g, " ") });
    await page.waitForTimeout(2500);
    await click(rc.locator("summary").first()).catch(() => {});
    mark("receipt-details", { text: (await rc.innerText()).replace(/\s+/g, " ") });
    await page.waitForTimeout(4000);
    mark("seeded-buys", { ok: (await bg).filter(Boolean).length });
  });

  // 6. Propose episode 1 (Kimi reads the canon first), vote
  await step("propose", async () => {
    await page.goto(`${BASE}/s/${S.id}#canon`, { waitUntil: "networkidle" });
    await scrollTo(page.locator("#canon"), 90);
    await page.waitForTimeout(1500);
    await click(page.getByRole("link", { name: /Propose episode 1/ }).first());
    await page.waitForURL(/\/create/);
    mark("studio-episode");
    await studioPitch("Odile ferries a boy who lost his voice; she finds it in the lost-property crate, singing. One page.");
  });
  await step("vote", async () => {
    await page.goto(`${BASE}/s/${S.id}#canon`, { waitUntil: "networkidle" });
    await scrollTo(page.locator("#canon"), 90);
    const voteBtn = page.getByRole("button", { name: "Vote", exact: true }).first();
    await voteBtn.waitFor({ timeout: 30_000 });
    mark("canon-board");
    await page.waitForTimeout(1500);
    await click(voteBtn);
    await page.getByText("Your vote", { exact: true }).first().waitFor({ timeout: 30_000 });
    mark("voted");
    const view = await getJson(`/api/canon/${S.id}`);
    endsAt = view.slot?.endsAt ?? 0;
    const issueId = view.proposals.at(-1)?.issueId;
    let ok = 0;
    for (const a of others.slice(0, 3)) {
      const signature = await a.signTypedData({ domain: { name: "KOMA Canon", version: "1", chainId: 10143, verifyingContract: status.launchpad.addresses.canonRegistry }, types: { Vote: [{ name: "seriesId", type: "uint256" }, { name: "episode", type: "uint256" }, { name: "issueId", type: "uint256" }, { name: "voter", type: "address" }] }, primaryType: "Vote", message: { seriesId: BigInt(S.id), episode: 1n, issueId: BigInt(issueId), voter: a.address } });
      const r = await fetch(`${BASE}/api/canon/${S.id}/vote`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ episode: 1, issueId, voter: a.address, signature }) });
      if (r.ok) ok++;
    }
    await page.reload({ waitUntil: "networkidle" });
    await scrollTo(page.locator("#canon"), 90);
    mark("votes-in", { others: ok, endsAt });
    await page.waitForTimeout(4000);
  });

  // 7. The window: Monad up close (leave the series page, so the reveal fires when we come back)
  await step("monad", async () => {
    await page.goto(`${BASE}/monad`, { waitUntil: "domcontentloaded" });
    await page.locator("[data-monad-pipeline]").getByText(/Finalized|Verified/).first().waitFor({ timeout: 20_000 });
    mark("monad");
    await glide(700, 380);
    await page.waitForTimeout(9000);
    await scrollTo(page.locator("[data-monad-facts]").first(), 140).catch(() => {});
    mark("monad-facts");
    await page.waitForTimeout(6000);
    await scrollTo(page.getByText(/KOMA.s own transactions/i).first(), 120).catch(() => {});
    mark("monad-ours");
    await page.waitForTimeout(5000);
    await page.goto(`${BASE}/receipts`, { waitUntil: "networkidle" });
    mark("receipts");
    await page.waitForTimeout(5000);
  });
  mark("waiting-window", { endsAt });
  while (Math.floor(Date.now() / 1000) <= endsAt + 3) await sleep(4000);

  // 8. Chainlink CRE settles; the reveal on return
  await step("cre", async () => {
    mark("cre-run");
    const out = execFileSync("cre", ["workflow", "simulate", "koma-canon", "--target", "staging-settings", "--non-interactive", "--trigger-index", "0", "--broadcast"], { cwd: "cre", encoding: "utf8", maxBuffer: 1 << 24 });
    writeFileSync(`${OUT}/cre.log`, out);
    mark("cre-done", { log: out.split("\n").filter((l) => /USER LOG/.test(l)).map((l) => l.replace(/^.*USER LOG\] /, "")) });
    for (let i = 0; i < 30; i++) { if ((await getJson(`/api/canon/${S.id}`)).canon.length) break; await sleep(2000); }
    await page.goto(`${BASE}/s/${S.id}`, { waitUntil: "networkidle" });
    const reveal = page.locator("[data-episode-reveal]");
    await reveal.waitFor({ timeout: 30_000 });
    mark("reveal");
    await glide(980, 640);
    await page.waitForTimeout(6500);
    await page.keyboard.press("Escape");
    await scrollTo(page.locator("#story-so-far"), 120);
    mark("story");
    await page.waitForTimeout(4500);
  });
  await step("monadvision", async () => {
    const tx = (await getJson(`/api/canon/${S.id}`)).canon[0]?.finalizedTx;
    mark("monadvision", { tx });
    await page.goto(`https://testnet.monadvision.com/tx/${tx}`, { waitUntil: "domcontentloaded", timeout: 30_000 });
    await page.waitForTimeout(7000);
  });

  // 9. Writers' Room: a passkey; the unlock verified by Monad's P256 precompile
  await step("room", async () => {
    const cdp = await context.newCDPSession(page);
    await cdp.send("WebAuthn.enable");
    await cdp.send("WebAuthn.addVirtualAuthenticator", { options: { protocol: "ctap2", ctap2Version: "ctap2_1", transport: "internal", hasResidentKey: true, hasUserVerification: true, isUserVerified: true, hasPrf: true, automaticPresenceSimulation: true } });
    await page.goto(`${BASE}/room`, { waitUntil: "networkidle" });
    mark("room");
    await click(page.getByRole("button", { name: /Create a room passkey/ }));
    await page.getByText(/locks in/).first().waitFor({ timeout: 30_000 });
    await page.getByLabel("Title").fill("Ferry of Lost Things, episode 2");
    await click(page.getByLabel(/Notes/));
    await page.getByLabel(/Notes/).pressSequentially("Twist: Odile is the one who lost something.", { delay: 20 });
    await click(page.getByRole("button", { name: "Save encrypted" }));
    await page.getByText("Saved. KOMA holds only the ciphertext.").waitFor({ timeout: 10_000 });
    mark("room-saved");
    await page.waitForTimeout(2000);
    await click(page.getByRole("button", { name: "Lock now" }));
    await page.getByText("Your room is locked").waitFor({ timeout: 15_000 });
    await click(page.getByRole("button", { name: /Open with passkey/ }));
    const badge = page.locator("[data-passkey-onchain]");
    await badge.waitFor({ timeout: 30_000 });
    await badge.scrollIntoViewIfNeeded();
    mark("room-verified", { badge: (await badge.innerText()).replace(/\s+/g, " ") });
    await badge.hover().catch(() => {});
    await page.waitForTimeout(5000);
  });

  // 10. The board
  await page.goto(`${BASE}/series`, { waitUntil: "networkidle" });
  mark("board");
  await page.waitForTimeout(4000);
  await scrollTo(page.locator("[data-top-creators]").first(), 300).catch(() => {});
  await page.waitForTimeout(3500);
  mark("end");
} catch (e) {
  mark("error", { message: String(e).slice(0, 300) });
} finally {
  const video = page.video();
  await context.close();
  await browser.close();
  renameSync(await video.path(), `${OUT}/demo.webm`);
  writeFileSync(`${OUT}/markers.json`, JSON.stringify(markers, null, 2));
  console.log("saved", `${OUT}/demo.webm`);
}
