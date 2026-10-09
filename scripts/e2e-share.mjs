// Series share card: /s/:id/opengraph-image renders a 1200×630 PNG from real data (sheet, coin, curve, canon), the
// page's meta tags point at it, and the page has a share button. Saves the card to docs/screens/wave2/after/.
//   node scripts/e2e-share.mjs        (app on :4320; no AI spend)
import { writeFileSync, mkdirSync } from "node:fs";

const BASE = process.env.KOMA_URL ?? "http://localhost:4320";
const results = [];
const check = (id, name, ok, detail = "") => {
  results.push(ok);
  console.log(`${ok ? "PASS" : "FAIL"} ${id} ${name}${detail ? ` — ${detail}` : ""}`);
};
const series = (await (await fetch(`${BASE}/api/series`)).json()).series;
const s = series.find((x) => x.sheetUrl && x.episodes > 0) ?? series.find((x) => x.sheetUrl) ?? series[0];

const html = await (await fetch(`${BASE}/s/${s.id}`)).text();
const og = html.match(/<meta property="og:image" content="([^"]+)"/)?.[1];
const tw = /<meta name="twitter:card" content="summary_large_image"/.test(html);
check("O1", "the series page's og:image points at its generated card; twitter large-image card", !!og && og.includes(`/s/${s.id}/opengraph-image`) && tw, og ?? "no og:image");

const res = await fetch(og.startsWith("http") ? og.replace(/^https?:\/\/[^/]+/, BASE) : `${BASE}${og}`);
const png = new Uint8Array(await res.arrayBuffer());
const w = (png[16] << 24) | (png[17] << 16) | (png[18] << 8) | png[19];
const h = (png[20] << 24) | (png[21] << 16) | (png[22] << 8) | png[23];
check("O2", "the card is a 1200×630 PNG rendered with the series' data", res.ok && res.headers.get("content-type") === "image/png" && w === 1200 && h === 630 && png.length > 50_000, `${w}×${h}, ${Math.round(png.length / 1024)} KB, series #${s.id} ${s.name}`);
mkdirSync("docs/screens/wave2/after", { recursive: true });
writeFileSync("docs/screens/wave2/after/series-og-card.png", png);

check("O3", "the page offers a share button", /aria-label="Share"/.test(html));
console.log(`\n${results.filter(Boolean).length}/${results.length} passed`);
process.exit(results.every(Boolean) ? 0 : 1);
