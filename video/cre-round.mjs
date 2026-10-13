// A real canon round for the CRE bounty video: propose Ferry of Lost Things episode N (x402, Kimi, FLUX), four
// signed votes, wait out the window, then run `cre workflow simulate --broadcast` and record its output with timing.
//   node video/cre-round.mjs  → work4/cre-run.json (chunks with ms offsets), work4/round.json
import { spawn } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { privateKeyToAccount } from "viem/accounts";
import { x402Client } from "@x402/core/client";
import { x402HTTPClient } from "@x402/core/http";
import { ExactEvmScheme } from "@x402/evm/exact/client";
const BASE = "https://koma-comics.up.railway.app", SID = 4;
const read = (f) => Object.fromEntries(readFileSync(f, "utf8").split("\n").filter((l) => l.includes("=")).map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).trim()]));
const seed = read(".env.seed");
const W = [1, 2, 3, 4].map((i) => privateKeyToAccount(seed[`SEED_KEY_${i}`]));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const getJson = async (p) => (await fetch(`${BASE}${p}`, { cache: "no-store" })).json();
const post = (p, b, h = {}) => fetch(`${BASE}${p}`, { method: "POST", headers: { "Content-Type": "application/json", ...h }, body: JSON.stringify(b) });
const status = await getJson("/api/status");
const view0 = await getJson(`/api/canon/${SID}`);
const ep = view0.episode;
console.log("episode", ep);
// 1. propose
const h = new x402HTTPClient(x402Client.fromConfig({ schemes: [{ network: status.caip, client: new ExactEvmScheme(W[0]) }], spendControls: { allowedAssets: [{ network: status.caip, asset: status.usdc, maxAmountPerPayment: "1800000" }] } }));
const body = { prompt: "Odile finds a jar of lost laughter in the hold and has to decide whose it is before the ferry docks. One page.", pages: 1, style: "retro-sf", seriesId: SID };
const first = await post("/api/comics", body);
const r = await post("/api/comics", body, h.encodePaymentSignatureHeader(await h.createPaymentPayload(h.getPaymentRequiredResponse((n) => first.headers.get(n)))));
const { jobId } = await r.json();
let job;
for (;;) { job = await getJson(`/api/jobs/${jobId}`); if (job.stage === "done" || job.stage === "error") break; await sleep(3000); }
console.log("proposal", job.stage, job.tokenId, job.error ?? "");
if (job.stage !== "done") process.exit(1);
// 2. votes
for (;;) { const v = await getJson(`/api/canon/${SID}`); if (v.proposals.some((p) => p.issueId === job.tokenId)) break; await sleep(2000); }
for (const w of W) {
  const signature = await w.signTypedData({ domain: { name: "KOMA Canon", version: "1", chainId: 10143, verifyingContract: status.launchpad.addresses.canonRegistry }, types: { Vote: [{ name: "seriesId", type: "uint256" }, { name: "episode", type: "uint256" }, { name: "issueId", type: "uint256" }, { name: "voter", type: "address" }] }, primaryType: "Vote", message: { seriesId: BigInt(SID), episode: BigInt(ep), issueId: BigInt(job.tokenId), voter: w.address } });
  const v = await post(`/api/canon/${SID}/vote`, { episode: ep, issueId: job.tokenId, voter: w.address, signature });
  console.log("vote", w.address.slice(0, 8), v.status);
}
const view = await getJson(`/api/canon/${SID}`);
const endsAt = view.slot.endsAt;
console.log("window ends", new Date(endsAt * 1000).toISOString());
while (Math.floor(Date.now() / 1000) <= endsAt + 3) await sleep(4000);
// 3. the CLI run, recorded with timing
const chunks = [];
const t0 = Date.now();
const args = ["workflow", "simulate", "koma-canon", "--target", "staging-settings", "--non-interactive", "--trigger-index", "0", "--broadcast"];
await new Promise((res, rej) => {
  const p = spawn("cre", args, { cwd: "cre", env: { ...process.env, NO_COLOR: "1" } });
  const add = (s) => (d) => chunks.push({ t: Date.now() - t0, s, text: d.toString() });
  p.stdout.on("data", add("out"));
  p.stderr.on("data", add("err"));
  p.on("close", (c) => (c === 0 ? res() : rej(new Error(`cre exited ${c}`))));
});
const all = chunks.map((c) => c.text).join("");
const tx = all.match(/Settled \d+ canon slot\(s\) in (0x[0-9a-f]{64})/)?.[1];
writeFileSync("video/work4/cre-run.json", JSON.stringify({ cmd: `cre ${args.join(" ")}`, chunks }, null, 1));
writeFileSync("video/work4/round.json", JSON.stringify({ seriesId: SID, episode: ep, issueId: job.tokenId, tx }, null, 1));
console.log("settled", tx);
