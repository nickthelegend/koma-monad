// Monad speed receipts end to end on the local fork (1 s blocks by default; KOMA_BLOCK_TIME=0.4 for Monad's): a real
// gasless buy and a real x402 payment get send → receipt times from their receipts, the chain head reports its
// measured block interval, and /receipts shows each settlement's time.
//   node scripts/e2e-speed.mjs        (app on :4320; spends nothing on AI: reuses issues already minted)
import { readFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { createPublicClient, encodeAbiParameters, http, keccak256, parseAbi, stringToBytes, toHex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { AUSD_DOMAIN, setAusd } from "./lib/ausd.mjs";

const env = Object.fromEntries(readFileSync(".env.local", "utf8").split("\n").filter((l) => l.includes("=")).map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1)]));
const BASE = process.env.KOMA_URL ?? "http://localhost:4320";
const RPC = env.NEXT_PUBLIC_MONAD_RPC_URL || "http://127.0.0.1:18643";
const chain = createPublicClient({ transport: http(RPC) });
const LP = JSON.parse(readFileSync(".data/addresses.local.json", "utf8"));
const results = [];
const check = (id, name, ok, detail = "") => {
  results.push(ok);
  console.log(`${ok ? "PASS" : "FAIL"} ${id} ${name}${detail ? ` — ${detail}` : ""}`);
};
const getJson = async (p) => (await fetch(`${BASE}${p}`)).json();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// S1: the head moves (1 s blocks on the fork).
const h1 = await getJson("/api/speed");
await sleep(2200);
const h2 = await getJson("/api/speed");
check("S1", "the chain head advances and reports its measured block interval", h2.block > h1.block && h2.blockMs > 0 && h2.blockMs <= 1500, `#${h1.block} → #${h2.block} in 2.2 s, ${h2.blockMs} ms blocks`);

// S2: a real gasless buy gets a speed receipt from its receipt.
const buyer = privateKeyToAccount(env.TEST_AGENT_KEY);
const series = (await getJson("/api/series")).series.find((s) => !s.complete && !s.graduated);
await setAusd(chain, buyer.address, 5_000_000n);
const usdcIn = 3_000_000n;
const [out] = await chain.readContract({ address: series.curve, abi: parseAbi(["function quoteBuy(uint256) view returns (uint256,uint256,uint256)"]), functionName: "quoteBuy", args: [usdcIn] });
const minCoinOut = (out * 99n) / 100n, deadline = BigInt(Math.floor(Date.now() / 1000) + 3600), salt = toHex(randomBytes(32));
const nonce = keccak256(encodeAbiParameters([{ type: "bytes32" }, { type: "address" }, { type: "address" }, { type: "uint256" }, { type: "uint256" }, { type: "uint256" }, { type: "bytes32" }], [keccak256(stringToBytes("KOMA_BUY_V1")), series.curve, buyer.address, usdcIn, minCoinOut, deadline, salt]));
const signature = await buyer.signTypedData({ domain: { ...AUSD_DOMAIN, chainId: await chain.getChainId(), verifyingContract: LP.usdc }, types: { ReceiveWithAuthorization: [{ name: "from", type: "address" }, { name: "to", type: "address" }, { name: "value", type: "uint256" }, { name: "validAfter", type: "uint256" }, { name: "validBefore", type: "uint256" }, { name: "nonce", type: "bytes32" }] }, primaryType: "ReceiveWithAuthorization", message: { from: buyer.address, to: series.curve, value: usdcIn, validAfter: 0n, validBefore: deadline, nonce } });
const res = await fetch(`${BASE}/api/trade/relay`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ kind: "buy", curve: series.curve, buyer: buyer.address, usdcIn: String(usdcIn), minCoinOut: String(minCoinOut), deadline: String(deadline), salt, validAfter: "0", validBefore: String(deadline), signature }) });
const { txHash } = await res.json();
const receipt = await chain.waitForTransactionReceipt({ hash: txHash });
let s = { pending: true };
for (let i = 0; i < 30 && s.pending; i++) {
  s = await getJson(`/api/speed/${txHash}`);
  if (s.pending) await sleep(300);
}
check("S2", "a relayed buy's speed receipt: real send → receipt time, the receipt's block and gas", !s.pending && s.kind === "trade" && s.ms > 0 && s.ms < 5000 && s.block === Number(receipt.blockNumber) && s.gasUsed === Number(receipt.gasUsed), `${s.ms} ms, block #${s.block}, ${s.gasUsed} gas${s.ethereum ? `, ≈ $${s.ethereum.usd.toFixed(2)} on Ethereum at ${s.ethereum.gwei.toFixed(2)} gwei` : ", Ethereum prices unreachable"}`);

// S3: pending → 200 (pollable without console errors); a non-hash → 400.
const unknown = await fetch(`${BASE}/api/speed/0x${"ab".repeat(32)}`);
const bad = await fetch(`${BASE}/api/speed/nope`);
check("S3", "unknown hash → 200 pending; malformed → 400", unknown.status === 200 && (await unknown.json()).pending === true && bad.status === 400);

// S4: receipts show settlement times for x402 payments made since tracking began.
const html = await (await fetch(`${BASE}/receipts`)).text();
check("S4", "/receipts shows the median confirmation and per-settlement times", /Median confirmation/.test(html) && /Settled in/.test(html), (html.match(/(\d+) ms/) ?? [""])[0]);

console.log(`\n${results.filter(Boolean).length}/${results.length} passed`);
process.exit(results.every(Boolean) ? 0 : 1);
