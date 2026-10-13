// Live smoke test on Monad testnet, no mocks: the public app, real signed transactions, real Monad timings.
//   KOMA_URL=https://… node scripts/smoke-testnet.mjs
// Spends: one launch sheet (FLUX), one 1-page episode (Kimi script + FLUX), 1 + 0.30 AUSD from Agora's faucet,
// and ~0.005 MON for one txpool probe. The test wallet (TEST_BROWSER_KEY, .env.local) needs no MON: everything
// it does is gasless. Ends with the canon round open; CRE settles it after the window (DEPLOY-LATER §5).
import { readFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { createPublicClient, createWalletClient, encodeAbiParameters, http, keccak256, parseAbi, stringToBytes, toHex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { x402Client } from "@x402/core/client";
import { x402HTTPClient } from "@x402/core/http";
import { ExactEvmScheme } from "@x402/evm/exact/client";
import { AUSD_DOMAIN } from "./lib/ausd.mjs";

const BASE = process.env.KOMA_URL;
if (!BASE) throw new Error("KOMA_URL=https://<public app> required");
const read = (f) => Object.fromEntries(readFileSync(f, "utf8").split("\n").filter((l) => l.includes("=") && !l.startsWith("#")).map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).trim()]));
const env = read(".env.local");
const RPC = "https://testnet-rpc.monad.xyz";
const chain = createPublicClient({ transport: http(RPC) });
const chainId = await chain.getChainId();
const me = privateKeyToAccount(env.TEST_BROWSER_KEY);
const results = [];
const evidence = {};
const check = (id, name, ok, detail = "") => {
  results.push(ok);
  console.log(`${ok ? "PASS" : "FAIL"} ${id} ${name}${detail ? ` — ${detail}` : ""}`);
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const getJson = async (p) => (await fetch(`${BASE}${p}`, { cache: "no-store" })).json();
const postJson = (p, body, headers = {}) => fetch(`${BASE}${p}`, { method: "POST", headers: { "Content-Type": "application/json", ...headers }, body: JSON.stringify(body) });
const erc20 = parseAbi(["function balanceOf(address) view returns (uint256)"]);
const curveAbi = parseAbi(["function quoteBuy(uint256) view returns (uint256 coinOut, uint256 fee)"]);

// ——— N1 status ———
const status = await getJson("/api/status");
const LP = status.launchpad?.addresses;
const USDC = status.usdc;
check("N1", "the public app runs on Monad testnet with the deployed launchpad", chainId === 10143 && status.ready && !!LP?.seriesFactory, `${status.network ?? ""} relayer ${status.relayerEth?.toFixed?.(2) ?? "?"} MON`);

// ——— N2 test AUSD from Agora's faucet (KOMA's server pays the MON) ———
let bal = await chain.readContract({ address: USDC, abi: erc20, functionName: "balanceOf", args: [me.address] });
if (bal < 5_000_000n) {
  const r = await postJson("/api/faucet", { address: me.address });
  const j = await r.json();
  bal = await chain.readContract({ address: USDC, abi: erc20, functionName: "balanceOf", args: [me.address] });
  check("N2", "faucet: test AUSD lands in a wallet with no MON", r.ok && bal >= 5_000_000n, j.error ?? `${Number(bal) / 1e6} AUSD`);
} else check("N2", "test wallet already holds AUSD", true, `${Number(bal) / 1e6} AUSD`);

// ——— x402 ———
const payer = new x402HTTPClient(
  x402Client.fromConfig({
    schemes: [{ network: status.caip, client: new ExactEvmScheme(me) }],
    spendControls: { allowedAssets: [{ network: status.caip, asset: USDC, maxAmountPerPayment: "1800000" }] },
  }),
);
async function paidPost(p, body) {
  const first = await postJson(p, body);
  if (first.status !== 402) return first;
  const required = payer.getPaymentRequiredResponse((n) => first.headers.get(n));
  return postJson(p, body, payer.encodePaymentSignatureHeader(await payer.createPaymentPayload(required)));
}
async function poll(path, done, timeoutMs) {
  const end = Date.now() + timeoutMs;
  let last = "";
  while (Date.now() < end) {
    const j = await getJson(path);
    if (j.stage !== last) console.log(`     ${path}: ${j.stage}`);
    last = j.stage;
    if (done(j)) return j;
    await sleep(2000);
  }
  throw new Error(`${path} timed out`);
}

// ——— N3 launch ($1 over x402, FLUX sheet, one launch tx) ———
const launchRes = await paidPost("/api/series", {
  name: "Signal Fire",
  symbol: "FIRE",
  characterName: "Ada Okonkwo",
  characterPrompt: "lanky lighthouse keeper in her sixties, close-cropped grey hair, yellow oilskin coat, a brass spyglass on a cord",
  pitch: "The last lighthouse keeper on a drowned coast answers a signal from a ship that sank forty years ago.",
  genre: "Mystery",
  demo: true,
});
const launchJob = await launchRes.json();
if (launchRes.status !== 202) throw new Error(`launch not accepted: ${launchRes.status} ${launchJob.error ?? ""}`);
const L = await poll(`/api/launches/${launchJob.jobId}`, (j) => j.stage === "done" || j.stage === "error", 300_000);
evidence.launchTx = L.launchTx;
evidence.paymentTx = L.paymentTx;
check("N3", "x402 launch on testnet: AUSD settled, sheet drawn, series launched", L.stage === "done" && !!L.seriesId, L.error ?? `series #${L.seriesId} launch ${L.launchTx}`);
let S = null;
for (let i = 0; i < 30 && !S; i++) {
  const r = await fetch(`${BASE}/api/series/${L.seriesId}`, { cache: "no-store" });
  if (r.ok) S = await r.json();
  else await sleep(1500);
}

// ——— N4 gasless $3 buy, sent with eth_sendRawTransactionSync; real Monad timings ———
const usdcIn = 3_000_000n;
const [coinOut] = await chain.readContract({ address: S.curve, abi: curveAbi, functionName: "quoteBuy", args: [usdcIn] });
const deadline = BigInt(Math.floor(Date.now() / 1000) + 600);
const salt = toHex(randomBytes(32));
const minCoinOut = (coinOut * 99n) / 100n;
const nonce = keccak256(
  encodeAbiParameters(
    [{ type: "bytes32" }, { type: "address" }, { type: "address" }, { type: "uint256" }, { type: "uint256" }, { type: "uint256" }, { type: "bytes32" }],
    [keccak256(stringToBytes("KOMA_BUY_V1")), S.curve, me.address, usdcIn, minCoinOut, deadline, salt],
  ),
);
const signature = await me.signTypedData({
  domain: { ...AUSD_DOMAIN, chainId, verifyingContract: USDC },
  types: { ReceiveWithAuthorization: [{ name: "from", type: "address" }, { name: "to", type: "address" }, { name: "value", type: "uint256" }, { name: "validAfter", type: "uint256" }, { name: "validBefore", type: "uint256" }, { name: "nonce", type: "bytes32" }] },
  primaryType: "ReceiveWithAuthorization",
  message: { from: me.address, to: S.curve, value: usdcIn, validAfter: 0n, validBefore: deadline, nonce },
});
const t0 = Date.now();
const relayRes = await postJson("/api/trade/relay", { kind: "buy", curve: S.curve, buyer: me.address, usdcIn: String(usdcIn), minCoinOut: String(minCoinOut), deadline: String(deadline), salt, validAfter: "0", validBefore: String(deadline), signature });
const relayed = await relayRes.json();
const roundTrip = Date.now() - t0;
evidence.buyTx = relayed.txHash;
let speed = null;
for (let i = 0; i < 40; i++) {
  speed = await getJson(`/api/speed/${relayed.txHash}`);
  if (!speed.pending && speed.finalMs != null) break;
  await sleep(250);
}
check("N4", "gasless buy relayed on Monad: executed and final timers are real Monad timings", relayRes.ok && !speed.pending && speed.ms < 3000 && speed.finalMs != null && speed.finalMs >= speed.ms, relayed.error ?? `executed ${speed.ms} ms · final ${speed.finalMs} ms · block #${speed.block} · API round trip ${roundTrip} ms · ${relayed.txHash}`);

// ——— N5 txpool_statusByHash on an in-flight transaction ———
{
  const tn = read(".env.testnet");
  const relayer = createWalletClient({ account: privateKeyToAccount(tn.SERVER_PRIVATE_KEY), transport: http(RPC), chain: { id: 10143, name: "Monad Testnet", nativeCurrency: { name: "MON", symbol: "MON", decimals: 18 }, rpcUrls: { default: { http: [RPC] } } } });
  const hash = await relayer.sendTransaction({ to: relayer.account.address, value: 0n, gas: 21_000n });
  const seen = [];
  for (let i = 0; i < 20; i++) {
    const r = await fetch(RPC, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "txpool_statusByHash", params: [hash] }) }).then((x) => x.json());
    const s = r.result ? JSON.stringify(r.result).slice(0, 40) : r.error?.message;
    if (seen.at(-1) !== s) seen.push(s);
    if (r.error) break;
    await sleep(60);
  }
  const rcpt = await chain.waitForTransactionReceipt({ hash });
  evidence.txpoolTx = hash;
  check("N5", "txpool_statusByHash tracks a transaction through Monad's pool until it leaves", seen.length >= 1 && rcpt.status === "success" && seen.some((s) => !/unknown/i.test(s ?? "")), `${seen.join(" → ")} · ${hash}`);
}

// ——— N6 propose episode 1 (Kimi script, FLUX panel, minted, proposed on chain) ———
const order = { prompt: "Ada climbs the lighthouse in a storm and answers the ghost ship's signal with her own lamp.", pages: 1, style: "retro-sf", seriesId: S.id };
const pr = await paidPost("/api/comics", order);
const pj = await pr.json();
if (pr.status !== 202) throw new Error(`proposal not accepted: ${pr.status} ${pj.error ?? ""}`);
const job = await poll(`/api/jobs/${pj.jobId}`, (j) => j.stage === "done" || j.stage === "error", 600_000);
const canon = await getJson(`/api/canon/${S.id}`);
const proposal = canon.proposals.find((p) => p.issueId === job.tokenId);
evidence.mintTx = job.mintTx ?? job.chain?.mintTx;
check("N6", "holder proposes episode 1: paid over x402, scripted by Kimi, drawn, minted and proposed on chain", job.stage === "done" && !!proposal, job.error ?? `issue #${job.tokenId}, round ends ${new Date(canon.slot.endsAt * 1000).toISOString()}`);

// ——— N7 signed vote ———
const vsig = await me.signTypedData({
  domain: { name: "KOMA Canon", version: "1", chainId, verifyingContract: LP.canonRegistry },
  types: { Vote: [{ name: "seriesId", type: "uint256" }, { name: "episode", type: "uint256" }, { name: "issueId", type: "uint256" }, { name: "voter", type: "address" }] },
  primaryType: "Vote",
  message: { seriesId: BigInt(S.id), episode: 1n, issueId: BigInt(job.tokenId), voter: me.address },
});
const vr = await postJson(`/api/canon/${S.id}/vote`, { episode: 1, issueId: job.tokenId, voter: me.address, signature: vsig });
const vb = await vr.json();
check("N7", "a free signed vote is counted at its snapshot weight", vr.ok, vb.error ?? `weight ${vb.weight}`);

console.log(`\n${results.filter(Boolean).length}/${results.length} passed`);
console.log(JSON.stringify({ seriesId: S.id, endsAt: canon.slot?.endsAt, ...evidence }));
process.exit(results.every(Boolean) ? 0 : 1);
