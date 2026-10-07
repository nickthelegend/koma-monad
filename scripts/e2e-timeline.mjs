// The canon timeline ("Story so far") on real settled rounds: the canon view carries each episode's finalize tx,
// time, voters and settler (older slots backfilled from their CanonFinalized logs), and the series page renders
// the timeline with its CRE badge, tx link and the open round.   node scripts/e2e-timeline.mjs   (no AI spend;
// run test:cre or test:launchpad first so there is a settled round)
import { chromium } from "playwright";

const BASE = process.env.KOMA_URL ?? "http://localhost:4320";
const results = [];
const check = (id, name, ok, detail = "") => {
  results.push(ok);
  console.log(`${ok ? "PASS" : "FAIL"} ${id} ${name}${detail ? ` — ${detail}` : ""}`);
};
const getJson = async (p) => (await fetch(`${BASE}${p}`)).json();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const series = (await getJson("/api/series")).series.filter((s) => s.episodes > 0);
let views = [];
for (let i = 0; i < 10; i++) {
  views = await Promise.all(series.map((s) => getJson(`/api/canon/${s.id}`)));
  if (views.every((v) => v.canon.every((c) => c.finalizedTx))) break;
  await sleep(1500); // the one-time backfill runs on the next index pass
}
const eps = views.flatMap((v) => v.canon);
check("T1", "every settled episode carries its finalize tx, time and voter count (older ones backfilled)", eps.length > 0 && eps.every((c) => /^0x[0-9a-f]{64}$/i.test(c.finalizedTx ?? "") && c.finalizedAt > 0 && Number.isInteger(c.voters)), `${eps.length} settled episodes across ${series.length} series`);

const cre = views.find((v) => v.canon.some((c) => c.settledBy === "cre"));
const browser = await chromium.launch();
try {
  for (const [size, viewport] of [["desktop", { width: 1440, height: 900 }], ["phone", { width: 390, height: 844 }]]) {
    const page = await browser.newPage({ viewport });
    const errors = [];
    page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
    await page.goto(`${BASE}/s/${cre.seriesId}`, { waitUntil: "networkidle" });
    const tl = page.locator("#story-so-far");
    await tl.waitFor({ timeout: 20_000 });
    const text = await tl.innerText();
    const items = await tl.locator("[data-canon-episode]").count();
    const txLink = await tl.locator("a", { hasText: /^tx 0x/ }).count();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
    check(
      `T2-${size}`,
      "series page: Story so far lists each canon episode with its settler, tx link and the open round",
      /Story so far/i.test(text) && /Settled by Chainlink CRE/i.test(text) && items === cre.canon.length + 1 && txLink >= 1 && /Episode \d+ · (voting|open for proposals|voting closed)/i.test(text) && overflow <= 1 && errors.length === 0,
      `${items - 1} episode(s) + open round, ${txLink} tx link(s)${errors.length ? `, console: ${errors[0]}` : ""}`,
    );
    await page.close();
  }
} finally {
  await browser.close();
}
console.log(`\n${results.filter(Boolean).length}/${results.length} passed`);
process.exit(results.every(Boolean) ? 0 : 1);
