/**
 * One koma-canon run on the LOCAL FORK, without the CRE CLI (which needs `cre login`).
 *
 *   FORK_PRIVATE_KEY=0x… bun fork-settle.ts [config.local-fork.json]
 *
 * The same rules as the workflow (canon.ts: signature recovery, tally, tie rule, votes root, report encoding)
 * on the same inputs: KOMA's /api/canon/due and the registry on the fork. The report is delivered the way
 * `cre workflow simulate --broadcast` delivers it, through Monad testnet's MockKeystoneForwarder
 * (`report(receiver, rawReport, reportContext, signatures)`), which calls `CanonSettler.onReport`.
 * What it does not stand in for: the DON. One process reads once; there is no consensus across nodes.
 * Refuses any RPC that is not on this machine. Prints one JSON line (for scripts/e2e-cre.mjs) at the end.
 */
import { type Address, concat, createPublicClient, createWalletClient, decodeEventLog, getAddress, type Hex, http, keccak256, parseAbi, sha256, stringToBytes, stringToHex, toHex } from "viem";
import { privateKeyToAccount } from "viem/accounts";

import { canonAbi, erc721Abi } from "./abis";
import { type CountedVote, type DueList, encodeReport, recoverVoter, type Settlement, settle } from "./canon";

const RPC = process.env.FORK_RPC ?? "http://127.0.0.1:18643";
if (!/^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?/.test(RPC)) throw new Error("fork-settle only runs against a local fork");
const FORWARDER = "0xB9F79d863261869B234c481D1f9A7af84AeAd192" as Address;
const config = await Bun.file(process.argv[2] ?? "config.local-fork.json").json();
const registry = getAddress(config.canonRegistry);
const client = createPublicClient({ transport: http(RPC) });
const forwarderAbi = parseAbi(["function report(address receiver, bytes rawReport, bytes reportContext, bytes[] signatures)"]);
const settlerAbi = parseAbi([
  "event Settled(uint256 indexed seriesId, uint256 indexed episode, uint256 winnerIssueId, bytes32 votesRoot)",
  "event SettlementSkipped(uint256 indexed seriesId, uint256 indexed episode, bytes reason)",
]);

/** The workflow name as CRE encodes it in metadata: sha256, hex, first ten characters. */
const workflowName = (name: string) => stringToHex(sha256(stringToBytes(name)).slice(2, 12), { size: 10 });

const due = (await (await fetch(`${config.komaUrl.replace(/\/$/, "")}/api/canon/due`)).json()) as DueList;
if (due.chainId !== config.chainId || due.canonRegistry.toLowerCase() !== registry.toLowerCase()) throw new Error("due list is for another registry");
const now = (await client.getBlock()).timestamp;

const batch: Settlement[] = [];
for (const s of due.slots.slice(0, config.maxSlots)) {
  const tag = `series ${s.seriesId} episode ${s.episode}`;
  const [, endsAt, finalized] = await client.readContract({ address: registry, abi: canonAbi, functionName: "slot", args: [BigInt(s.seriesId), BigInt(s.episode)] });
  if (endsAt === 0n || finalized || now < endsAt) {
    console.log(`${tag}: ${endsAt === 0n ? "no such slot" : finalized ? "already finalized" : "voting still open"}, skipped`);
    continue;
  }
  const proposals = (await client.readContract({ address: registry, abi: canonAbi, functionName: "proposals", args: [BigInt(s.seriesId), BigInt(s.episode)] })).map(Number);
  const cfg = await client.readContract({ address: registry, abi: canonAbi, functionName: "seriesConfig", args: [BigInt(s.seriesId)] });
  const owner = await client.readContract({ address: cfg.characterNft, abi: erc721Abi, functionName: "ownerOf", args: [cfg.characterId] });
  const counted: CountedVote[] = [];
  for (const v of s.votes) {
    if (!proposals.includes(v.issueId)) continue;
    const signer = recoverVoter(config.chainId, registry, s.seriesId, s.episode, v);
    if (!signer || signer.toLowerCase() !== v.voter.toLowerCase()) {
      console.log(`${tag}: vote by ${v.voter} doesn't verify, dropped`);
      continue;
    }
    const weight = await client.readContract({ address: registry, abi: canonAbi, functionName: "votingPower", args: [BigInt(s.seriesId), BigInt(s.episode), getAddress(v.voter)] });
    if (weight > 0n) counted.push({ issueId: v.issueId, voter: v.voter, weight, signature: v.signature });
  }
  const settlement = settle(s.seriesId, s.episode, proposals, counted, owner);
  console.log(`${tag}: issue #${settlement.winnerIssueId} wins with ${settlement.winnerVotes} of ${settlement.totalVotes} (${counted.length} verified votes)`);
  batch.push(settlement);
}
if (batch.length === 0) {
  console.log("nothing to settle");
  console.log(JSON.stringify({ settled: [] }));
  process.exit(0);
}

const account = privateKeyToAccount(process.env.FORK_PRIVATE_KEY as Hex);
const observedAt = Number(now);
// KeystoneForwarder's 109-byte header: version, execution id, timestamp, DON id, config version,
// workflow id, workflow name, workflow owner, report id. Then the payload.
const header = concat([
  toHex(1, { size: 1 }),
  keccak256(toHex(`koma-canon-${observedAt}-${batch.length}`)),
  toHex(observedAt, { size: 4 }),
  toHex(1, { size: 4 }),
  toHex(1, { size: 4 }),
  keccak256(stringToBytes("koma-canon")),
  workflowName("koma-canon"),
  account.address,
  toHex(1, { size: 2 }),
]);
const wallet = createWalletClient({ account, transport: http(RPC) });
const hash = await wallet.writeContract({
  chain: null,
  address: FORWARDER,
  abi: forwarderAbi,
  functionName: "report",
  args: [config.receiver, concat([header, encodeReport(batch)]), "0x", []],
  // The forwarder catches a receiver that fails, so an estimate finds the gas at which the outer call succeeds
  // and starves `onReport`. CRE sends the workflow's gasLimit; so does this.
  gas: BigInt(config.gasLimit) + 100_000n,
});
const receipt = await client.waitForTransactionReceipt({ hash });
const processed = receipt.logs.find((log) => log.address.toLowerCase() === FORWARDER.toLowerCase());
const delivered = processed ? BigInt(processed.data) === 1n : false;
const settled = receipt.logs
  .filter((l) => l.address.toLowerCase() === String(config.receiver).toLowerCase())
  .map((l) => decodeEventLog({ abi: settlerAbi, data: l.data, topics: l.topics }))
  .flatMap((e) => (e.eventName === "Settled" ? [{ seriesId: Number(e.args.seriesId), episode: Number(e.args.episode), winner: Number(e.args.winnerIssueId), votesRoot: e.args.votesRoot }] : []));
console.log(`report through MockKeystoneForwarder: ${hash} (${receipt.status}), onReport ${delivered ? "succeeded" : "FAILED"}, ${settled.length} settled`);
console.log(JSON.stringify({ tx: hash, delivered, settled, batch: batch.map((b) => ({ seriesId: Number(b.seriesId), episode: Number(b.episode), winner: Number(b.winnerIssueId), votesRoot: b.votesRoot, winnerVotes: String(b.winnerVotes), totalVotes: String(b.totalVotes) })) }));
if (!delivered) process.exitCode = 1;
