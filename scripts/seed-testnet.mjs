// Team-seeded activity on the live app (Monad testnet), labelled as such: distinct wallets buy, launch, propose and
// vote, so the canon round is contested. Fresh wallets are created once and kept in .env.seed (gitignored).
// They need no MON: everything they do is gasless (KOMA's relayer pays).
//   KOMA_URL=https://… node scripts/seed-testnet.mjs   → prints the evidence as JSON
import { existsSync, readFileSync, writeFileSync, chmodSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { createPublicClient, encodeAbiParameters, http, keccak256, parseAbi, stringToBytes, toHex } from "viem";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { x402Client } from "@x402/core/client";
import { x402HTTPClient } from "@x402/core/http";
import { ExactEvmScheme } from "@x402/evm/exact/client";
import { AUSD_DOMAIN } from "./lib/ausd.mjs";

const BASE = process.env.KOMA_URL;
if (!BASE) throw new Error("KOMA_URL required");
const RPC = "https://testnet-rpc.monad.xyz";
const chain = createPublicClient({ transport: http(RPC) });
const read = (f) => Object.fromEntries(readFileSync(f, "utf8").split("\n").filter((l) => l.includes("=") && !l.startsWith("#")).map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).trim()]));
if (!existsSync(".env.seed")) {
  writeFileSync(".env.seed", [1, 2, 3, 4].map((i) => `SEED_KEY_${i}=${generatePrivateKey()}`).join("\n") + "\n");
  chmodSync(".env.seed", 0o600);
}
const seed = read(".env.seed");
const W = [1, 2, 3, 4].map((i) => privateKeyToAccount(seed[`SEED_KEY_${i}`]));
const veteran = privateKeyToAccount(read(".env.local").TEST_BROWSER_KEY);
const ev = { wallets: [...W.map((w) => w.address), veteran.address], faucet: [], buys: [], launch: null, proposals: [], votes: [] };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const getJson = async (p) => (await fetch(`${BASE}${p}`, { cache: "no-store" })).json();
const postJson = (p, body, headers = {}) => fetch(`${BASE}${p}`, { method: "POST", headers: { "Content-Type": "application/json", ...headers }, body: JSON.stringify(body) });
const status = await getJson("/api/status");
const USDC = status.usdc;
const LP = status.launchpad.addresses;
const erc20 = parseAbi(["function balanceOf(address) view returns (uint256)"]);
const curveAbi = parseAbi(["function quoteBuy(uint256) view returns (uint256 coinOut, uint256 fee)"]);
const bal = (a) => chain.readContract({ address: USDC, abi: erc20, functionName: "balanceOf", args: [a] });
const log = (...a) => console.error(...a);

// 1. AUSD from Agora's faucet (60 s global cooldown → retry)
for (const w of W) {
  if ((await bal(w.address)) >= 20_000_000n) continue;
  for (let t = 0; t < 4; t++) {
    const r = await postJson("/api/faucet", { address: w.address });
    if (r.ok) { ev.faucet.push(w.address); log("faucet", w.address); break; }
    log("faucet wait", (await r.json()).error); await sleep(62_000);
  }
}

// 2. gasless buys
async function buy(acct, curve, dollars) {
  const usdcIn = BigInt(Math.round(dollars * 1e6));
  const [coinOut] = await chain.readContract({ address: curve, abi: curveAbi, functionName: "quoteBuy", args: [usdcIn] });
  const deadline = BigInt(Math.floor(Date.now() / 1000) + 600);
  const salt = toHex(randomBytes(32));
  const minCoinOut = (coinOut * 98n) / 100n;
  const nonce = keccak256(encodeAbiParameters([{ type: "bytes32" }, { type: "address" }, { type: "address" }, { type: "uint256" }, { type: "uint256" }, { type: "uint256" }, { type: "bytes32" }], [keccak256(stringToBytes("KOMA_BUY_V1")), curve, acct.address, usdcIn, minCoinOut, deadline, salt]));
  const signature = await acct.signTypedData({
    domain: { ...AUSD_DOMAIN, chainId: 10143, verifyingContract: USDC },
    types: { ReceiveWithAuthorization: [{ name: "from", type: "address" }, { name: "to", type: "address" }, { name: "value", type: "uint256" }, { name: "validAfter", type: "uint256" }, { name: "validBefore", type: "uint256" }, { name: "nonce", type: "bytes32" }] },
    primaryType: "ReceiveWithAuthorization",
    message: { from: acct.address, to: curve, value: usdcIn, validAfter: 0n, validBefore: deadline, nonce },
  });
  const r = await postJson("/api/trade/relay", { kind: "buy", curve, buyer: acct.address, usdcIn: String(usdcIn), minCoinOut: String(minCoinOut), deadline: String(deadline), salt, validAfter: "0", validBefore: String(deadline), signature });
  const j = await r.json();
  if (!r.ok) throw new Error(`buy failed: ${j.error}`);
  await sleep(1500);
  const sp = await getJson(`/api/speed/${j.txHash}`);
  ev.buys.push({ buyer: acct.address, curve, usd: dollars, tx: j.txHash, ms: sp.ms, finalMs: sp.finalMs });
  log("buy", acct.address.slice(0, 8), dollars, j.txHash, sp.ms, sp.finalMs);
}
const S1 = await getJson("/api/series/1");
// Re-runnable: a wallet that already holds the coin has bought.
for (const [w, d] of [[W[0], 4], [W[1], 6], [W[2], 3], [W[3], 5]]) {
  const held = await chain.readContract({ address: S1.coin, abi: erc20, functionName: "balanceOf", args: [w.address] });
  if (held === 0n) await buy(w, S1.curve, d);
}

// x402
const payer = (acct) => new x402HTTPClient(x402Client.fromConfig({ schemes: [{ network: status.caip, client: new ExactEvmScheme(acct) }], spendControls: { allowedAssets: [{ network: status.caip, asset: USDC, maxAmountPerPayment: "1800000" }] } }));
async function paidPost(p, body, acct) {
  const first = await postJson(p, body);
  if (first.status !== 402) return first;
  const h = payer(acct);
  const req = h.getPaymentRequiredResponse((n) => first.headers.get(n));
  return postJson(p, body, h.encodePaymentSignatureHeader(await h.createPaymentPayload(req)));
}
async function poll(path, timeoutMs) {
  const end = Date.now() + timeoutMs;
  while (Date.now() < end) {
    const j = await getJson(path);
    if (j.stage === "done" || j.stage === "error") return j;
    await sleep(2500);
  }
  throw new Error(`${path} timed out`);
}

// 3. proposals for Signal Fire episode 2 (two holders, competing), started together
const ideas = [
  [W[1], "The ghost ship's captain climbs the lighthouse stairs and asks Ada to keep the lamp lit for one more night."],
  [W[3], "Ada rows out to the drowned ship at dawn and finds her own logbook in the captain's cabin."],
];
const jobs = [];
for (const [w, prompt] of ideas) {
  const r = await paidPost("/api/comics", { prompt, pages: 1, style: "retro-sf", seriesId: 1 }, w);
  const j = await r.json();
  if (r.status !== 202) throw new Error(`proposal refused: ${r.status} ${j.error}`);
  jobs.push([w, j.jobId]);
}

// 4. a new series from a seeded creator, bought by another seeded wallet (while the episodes draw)
{
  const r = await paidPost("/api/series", { name: "Tin Saint", symbol: "TINS", characterName: "Brother Cog", characterPrompt: "a squat brass monk-robot with a dented halo, rust-red robes over riveted plating, one glowing amber eye", pitch: "A robot monk guards the last library of a flooded city and lends one book a day to whoever can answer its riddle.", genre: "Fantasy", demo: true }, W[0]);
  const j = await r.json();
  if (r.status !== 202) throw new Error(`launch refused: ${r.status} ${j.error}`);
  const L = await poll(`/api/launches/${j.jobId}`, 300_000);
  ev.launch = { creator: W[0].address, seriesId: L.seriesId, tx: L.launchTx, stage: L.stage };
  log("launch", L.stage, L.seriesId, L.launchTx);
  if (L.seriesId) {
    for (let i = 0; i < 20; i++) { const r2 = await fetch(`${BASE}/api/series/${L.seriesId}`); if (r2.ok) { const S2 = await r2.json(); await buy(W[2], S2.curve, 3); break; } await sleep(1500); }
  }
}

for (const [w, id] of jobs) {
  const job = await poll(`/api/jobs/${id}`, 600_000);
  ev.proposals.push({ proposer: w.address, issueId: job.tokenId, stage: job.stage, mintTx: job.mintTx ?? null, error: job.error ?? null });
  log("proposal", w.address.slice(0, 8), job.stage, job.tokenId, job.error ?? "");
}

// 5. votes: five wallets, split across the two proposals
const [a, b] = ev.proposals.map((p) => p.issueId);
const plan = [[W[0], a], [W[1], a], [W[2], b], [W[3], b], [veteran, a]];
for (const [w, issueId] of plan) {
  if (!issueId) continue;
  const signature = await w.signTypedData({
    domain: { name: "KOMA Canon", version: "1", chainId: 10143, verifyingContract: LP.canonRegistry },
    types: { Vote: [{ name: "seriesId", type: "uint256" }, { name: "episode", type: "uint256" }, { name: "issueId", type: "uint256" }, { name: "voter", type: "address" }] },
    primaryType: "Vote",
    message: { seriesId: 1n, episode: 2n, issueId: BigInt(issueId), voter: w.address },
  });
  const r = await postJson("/api/canon/1/vote", { episode: 2, issueId, voter: w.address, signature });
  const j = await r.json();
  ev.votes.push({ voter: w.address, issueId, ok: r.ok, weight: j.weight ?? null, error: j.error ?? null });
  log("vote", w.address.slice(0, 8), issueId, r.status, j.weight ?? j.error);
}
const canon = await getJson("/api/canon/1");
ev.endsAt = canon.slot?.endsAt ?? null;
console.log(JSON.stringify(ev, null, 2));
