// Wave 2 on real indexed data: the creator page (#3), a new wallet's shelf (#4), the episode reveal (#5) and the
// remix family tree. No AI spend. Shots go to docs/screens/wave2/after/ when SHOTS=1.
//   node scripts/e2e-wave2.mjs   (app on :4320, local fork on :18643)
import { mkdirSync, readFileSync } from "node:fs";
import { chromium } from "playwright";
import { createPublicClient, http } from "viem";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { installWallet } from "./lib/wallet-shim.mjs";

const env = Object.fromEntries(readFileSync(".env.local", "utf8").split("\n").filter((l) => l.includes("=")).map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1)]));
const BASE = process.env.KOMA_URL ?? "http://localhost:4320";
const RPC = env.NEXT_PUBLIC_MONAD_RPC_URL || "http://127.0.0.1:18643";
const SHOTS = process.env.SHOTS === "1";
const OUT = "docs/screens/wave2/after";
const results = [];
const check = (id, name, ok, detail = "") => {
  results.push(ok);
  console.log(`${ok ? "PASS" : "FAIL"} ${id} ${name}${detail ? ` — ${detail}` : ""}`);
};
const getJson = async (p) => (await fetch(`${BASE}${p}`)).json();
const series = (await getJson("/api/series")).series;
if (SHOTS) mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch();
try {
  const open = async (viewport = { width: 1280, height: 900 }) => {
    const ctx = await browser.newContext({ viewport });
    const page = await ctx.newPage();
    const errors = [];
    page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
    page.on("pageerror", (e) => errors.push(e.message));
    return { ctx, page, errors };
  };
  const shot = (page, name, fullPage = true) => SHOTS && page.screenshot({ path: `${OUT}/${name}.png`, fullPage });
  const overflow = (page) => page.evaluate(() => document.documentElement.scrollWidth - innerWidth);

  // ——— C: creator page ———
  const creator = series[0].creator;
  const mine = series.filter((s) => s.creator.toLowerCase() === creator.toLowerCase());
  for (const [size, vp] of [["desktop", undefined], ["phone", { width: 390, height: 844 }]]) {
    const { ctx, page, errors } = await open(vp);
    await page.goto(`${BASE}/s/${mine[0].id}`, { waitUntil: "networkidle" });
    await page.getByRole("link", { name: new RegExp(creator.slice(2, 6), "i") }).first().click();
    await page.waitForURL(/\/creator\/0x/);
    await page.locator("[data-creator-earned]").waitFor();
    const earned = await page.locator("[data-creator-earned]").innerText();
    const rows = await page.locator('a[href^="/s/"]').count();
    const bars = await page.locator("[data-earnings-chart] rect").count();
    const detailsClosed = await page.locator("[data-details]").evaluate((d) => !d.open);
    check(`C1-${size}`, "series → creator page: one earnings headline, a 30-day chart, every series, details collapsed", /^\$[\d,.]+/.test(earned) && rows === mine.length && bars === 30 && detailsClosed && (await overflow(page)) <= 1 && errors.length === 0, `${earned}, ${rows} series${errors[0] ? `, console: ${errors[0]}` : ""}`);
    await shot(page, `creator-${size}`);
    await ctx.close();
  }

  // ——— E: a brand-new wallet's shelf ———
  {
    const key = generatePrivateKey();
    const me = privateKeyToAccount(key);
    const { ctx, page, errors } = await open({ width: 390, height: 844 });
    await installWallet(page, key, { rpc: RPC });
    await page.goto(`${BASE}/shelf`, { waitUntil: "networkidle" });
    await page.getByRole("button", { name: "Connect wallet" }).first().click();
    const steps = page.locator("[data-first-steps]");
    await steps.waitFor({ timeout: 15_000 });
    const t = await steps.innerText();
    const done0 = await steps.locator("[data-done]").count();
    check("E1", "new wallet: the shelf shows Start here with 3 steps, none done", /Start here/i.test(t) && (await steps.locator("[data-step]").count()) === 3 && done0 === 0 && /0 of 3 done/.test(t), me.address);
    await shot(page, "shelf-new-wallet");
    // Agora's faucet has a 60 s cooldown shared by every caller: if a previous run just used it, wait once and retry.
    for (let attempt = 0; attempt < 2; attempt++) {
      await page.getByRole("button", { name: /Get 10,000 test AUSD/i }).click();
      const ok = await steps.locator('[data-step="fund"][data-done]').waitFor({ timeout: 30_000 }).then(() => true, () => false);
      if (ok || !(await steps.getByText(/cooling down/i).count())) break;
      await page.waitForTimeout(61_000);
    }
    const bal = await createPublicClient({ transport: http(RPC) }).readContract({ address: "0xa9012a055bd4e0eDfF8Ce09f960291C09D5322dC", abi: [{ type: "function", name: "balanceOf", stateMutability: "view", inputs: [{ type: "address" }], outputs: [{ type: "uint256" }] }], functionName: "balanceOf", args: [me.address] });
    const fundDone = await steps.locator('[data-step="fund"][data-done]').count();
    check("E2", "step 1 ticks off from the real AUSD balance after the faucet pays out", bal > 0n && fundDone === 1 && (await overflow(page)) <= 1 && errors.filter((e) => !/429|Too Many/i.test(e)).length === 0, `${Number(bal) / 1e6} AUSD${errors[0] ? `, console: ${errors[0]}` : ""}`);
    await shot(page, "shelf-funded");
    await ctx.close();
  }

  // ——— R: episode reveal on an unseen settlement ———
  {
    const s = series.find((x) => x.episodes > 0);
    const view = await getJson(`/api/canon/${s.id}`);
    const top = Math.max(...view.canon.map((c) => c.episode));
    const { ctx, page, errors } = await open({ width: 390, height: 844 });
    await page.goto(`${BASE}/s/${s.id}`, { waitUntil: "networkidle" });
    await page.locator("#story-so-far").waitFor();
    const firstVisit = await page.locator("[data-episode-reveal]").count();
    const stored = await page.evaluate((k) => localStorage.getItem(k), `koma:seen-canon:${s.id}`);
    check("R1", "first visit: records what's canon, reveals nothing", firstVisit === 0 && Number(stored) === top, `seen=${stored}`);
    await page.evaluate(([k, v]) => localStorage.setItem(k, v), [`koma:seen-canon:${s.id}`, String(top - 1)]);
    await page.reload({ waitUntil: "networkidle" });
    const dlg = page.locator(`[data-episode-reveal="${top}"]`);
    await dlg.waitFor({ timeout: 15_000 });
    await page.waitForTimeout(1600); // let the splash finish for the shot
    const txt = await dlg.innerText();
    const c = view.canon.find((x) => x.episode === top);
    const share = c.totalVotes > 0 ? Math.round((c.winnerVotes / c.totalVotes) * 100) : 100;
    await shot(page, "episode-reveal", false); // the overlay is fixed to the viewport
    check("R2", "unseen settlement: the reveal shows the winning episode, its vote share and settler", new RegExp(`Episode ${top} is canon`, "i").test(txt) && txt.includes(`${share}%`) && /Settled by/i.test(txt) && errors.length === 0, `episode ${top}, ${share}%, ${c.settledBy}`);
    await page.keyboard.press("Escape");
    const gone = (await dlg.count()) === 0;
    await page.reload({ waitUntil: "networkidle" });
    await page.locator("#story-so-far").waitFor();
    check("R3", "Esc closes it, and it doesn't come back once seen", gone && (await page.locator("[data-episode-reveal]").count()) === 0);
    await ctx.close();
  }

  // ——— T: remix family tree ———
  {
    const child = series.find((x) => x.parentSeriesId);
    if (!child) check("T1", "remix family tree", false, "no remix in this deployment");
    else {
      const { ctx, page, errors } = await open();
      await page.goto(`${BASE}/s/${child.id}`, { waitUntil: "networkidle" });
      const tree = page.locator("[data-family-tree]");
      await tree.scrollIntoViewIfNeeded();
      const n = Number(await tree.getAttribute("data-family-tree"));
      const cur = await tree.locator("[data-current]").getAttribute("data-family-node");
      const parent = await tree.locator(`[data-family-node="${child.parentSeriesId}"]`).count();
      check("T1", "a remix's page shows its family tree: the parent, itself marked current", n >= 2 && Number(cur) === child.id && parent === 1 && errors.length === 0, `${n} series in the family`);
      await tree.screenshot({ path: SHOTS ? `${OUT}/family-tree.png` : "/dev/null" }).catch(() => {});
      await ctx.close();
    }
  }
} finally {
  await browser.close();
}
console.log(`\n${results.filter(Boolean).length}/${results.length} passed`);
process.exit(results.every(Boolean) ? 0 : 1);
