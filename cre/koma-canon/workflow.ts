import {
  bytesToHex,
  consensusIdenticalAggregation,
  type CronPayload,
  cre,
  encodeCallMsg,
  getNetwork,
  type HTTPSendRequester,
  LAST_FINALIZED_BLOCK_NUMBER,
  LATEST_BLOCK_NUMBER,
  prepareReportRequest,
  type Runtime,
  text,
  TxStatus,
} from "@chainlink/cre-sdk";
import { type Address, decodeFunctionResult, encodeFunctionData, getAddress, type Hex, zeroAddress } from "viem";
import { z } from "zod";

import { canonAbi, erc721Abi } from "./abis";
import { type CountedVote, type DueList, encodeReport, recoverVoter, type Settlement, settle } from "./canon";

/**
 * koma-canon: Chainlink CRE settles KOMA's canon votes on Monad.
 *
 * Holders of a series coin vote (gaslessly, by EIP-712 signature) on which proposed episode becomes canon. Until
 * now KOMA's server tallied them and called `CanonRegistry.finalize` itself. Every run of this workflow:
 *
 *  1. HTTP with consensus: KOMA's `/api/canon/due`, the slots whose window has closed with their signed votes.
 *     Every node fetches it; the DON requires identical bytes. Nothing in it is trusted beyond "these exist".
 *  2. EVM reads on Monad, per slot: the slot itself (closed? already finalized?), its proposals, each voter's
 *     coin balance at the snapshot (`votingPower`), and the character NFT's owner for the tie rule.
 *  3. Every vote's EIP-712 signature is verified against the registry's domain; a vote that doesn't recover to
 *     its voter, is for something that isn't a proposal, or weighs nothing is dropped.
 *  4. The keeper's rules (canon.ts) pick the winner and compute the votes root.
 *  5. One signed report to `CanonSettler`, which holds RELAYER_ROLE and calls `finalize` for each slot.
 *
 * KOMA's server keeps a fallback: with KOMA_CANON_FINALIZER=cre it only finalizes a slot still open
 * KOMA_CANON_GRACE_S after its window, so canon can't stall if the workflow stops.
 */

export const configSchema = z.object({
  schedule: z.string(),
  chainSelectorName: z.string(),
  isTestnet: z.boolean().default(true),
  /** Chain id in the vote signatures' EIP-712 domain. */
  chainId: z.number().int(),
  /** KOMA's public origin; the workflow reads `${komaUrl}/api/canon/due`. */
  komaUrl: z.string(),
  canonRegistry: z.string(),
  receiver: z.string(),
  gasLimit: z.string(),
  /** Read chain state at the last finalized block (production) or the latest (a local fork). */
  readFinalized: z.boolean().default(true),
  /** At most this many slots per report. */
  maxSlots: z.number().int().positive().default(20),
});

export type Config = z.infer<typeof configSchema>;

/** Runs on every node: one read of KOMA's due list, as raw text. The DON keeps it only if every node saw the same bytes. */
export const fetchDue = (sendRequester: HTTPSendRequester, url: string): string => {
  const response = sendRequester.sendRequest({ url, method: "GET" }).result();
  if (response.statusCode !== 200) throw new Error(`KOMA answered ${response.statusCode}`);
  return text(response);
};

type Client = InstanceType<typeof cre.capabilities.EVMClient>;

function evmClient(config: Config): Client {
  const network = getNetwork({ chainFamily: "evm", chainSelectorName: config.chainSelectorName, isTestnet: config.isTestnet });
  if (!network) throw new Error(`Unknown chain ${config.chainSelectorName}`);
  return new cre.capabilities.EVMClient(network.chainSelector.selector);
}

function read<const F extends "slot" | "proposals" | "votingPower" | "seriesConfig">(
  runtime: Runtime<Config>,
  client: Client,
  functionName: F,
  args: readonly unknown[],
) {
  const data = encodeFunctionData({ abi: canonAbi, functionName, args } as never);
  const reply = client
    .callContract(runtime, {
      call: encodeCallMsg({ from: zeroAddress, to: runtime.config.canonRegistry as Address, data }),
      blockNumber: runtime.config.readFinalized ? LAST_FINALIZED_BLOCK_NUMBER : LATEST_BLOCK_NUMBER,
    })
    .result();
  return decodeFunctionResult({ abi: canonAbi, functionName, data: bytesToHex(reply.data) as Hex } as never) as never;
}

function ownerOf(runtime: Runtime<Config>, client: Client, nft: Address, tokenId: bigint): string {
  const reply = client
    .callContract(runtime, {
      call: encodeCallMsg({ from: zeroAddress, to: nft, data: encodeFunctionData({ abi: erc721Abi, functionName: "ownerOf", args: [tokenId] }) }),
      blockNumber: runtime.config.readFinalized ? LAST_FINALIZED_BLOCK_NUMBER : LATEST_BLOCK_NUMBER,
    })
    .result();
  return decodeFunctionResult({ abi: erc721Abi, functionName: "ownerOf", data: bytesToHex(reply.data) as Hex });
}

export function buildSettlements(runtime: Runtime<Config>): Settlement[] {
  const config = runtime.config;
  const registry = getAddress(config.canonRegistry);
  const http = new cre.capabilities.HTTPClient();
  const body = http.sendRequest(runtime, fetchDue, consensusIdenticalAggregation<string>())(`${config.komaUrl.replace(/\/$/, "")}/api/canon/due`).result();
  const due = JSON.parse(body) as DueList;
  if (due.chainId !== config.chainId || due.canonRegistry.toLowerCase() !== registry.toLowerCase()) {
    throw new Error(`KOMA serves ${due.canonRegistry} on ${due.chainId}, this workflow settles ${registry} on ${config.chainId}`);
  }

  const client = evmClient(config);
  const now = BigInt(Math.floor(runtime.now().getTime() / 1000));
  const out: Settlement[] = [];
  for (const s of due.slots.slice(0, config.maxSlots)) {
    const tag = `series ${s.seriesId} episode ${s.episode}`;
    try {
      const [, endsAt, finalized] = read(runtime, client, "slot", [BigInt(s.seriesId), BigInt(s.episode)]) as [bigint, bigint, boolean, bigint, bigint];
      if (endsAt === 0n) {
        runtime.log(`${tag}: no such slot on chain, skipped`);
        continue;
      }
      if (finalized) {
        runtime.log(`${tag}: already finalized, skipped`);
        continue;
      }
      if (now < endsAt) {
        runtime.log(`${tag}: voting still open until ${endsAt}, skipped`);
        continue;
      }
      const proposals = (read(runtime, client, "proposals", [BigInt(s.seriesId), BigInt(s.episode)]) as bigint[]).map(Number);
      const cfg = read(runtime, client, "seriesConfig", [BigInt(s.seriesId)]) as { characterNft: Address; characterId: bigint };
      const owner = ownerOf(runtime, client, cfg.characterNft, cfg.characterId);

      const counted: CountedVote[] = [];
      for (const v of s.votes) {
        if (!proposals.includes(v.issueId)) {
          runtime.log(`${tag}: vote by ${v.voter} for #${v.issueId}, not a proposal, dropped`);
          continue;
        }
        const signer = recoverVoter(config.chainId, registry, s.seriesId, s.episode, v);
        if (!signer || signer.toLowerCase() !== v.voter.toLowerCase()) {
          runtime.log(`${tag}: vote by ${v.voter} has a signature from ${signer ?? "nobody"}, dropped`);
          continue;
        }
        const weight = read(runtime, client, "votingPower", [BigInt(s.seriesId), BigInt(s.episode), getAddress(v.voter)]) as bigint;
        if (weight === 0n) {
          runtime.log(`${tag}: ${v.voter} held nothing at the snapshot, dropped`);
          continue;
        }
        counted.push({ issueId: v.issueId, voter: v.voter, weight, signature: v.signature });
      }
      const settlement = settle(s.seriesId, s.episode, proposals, counted, owner);
      runtime.log(`${tag}: issue #${settlement.winnerIssueId} wins with ${settlement.winnerVotes} of ${settlement.totalVotes} (${counted.length} verified votes)`);
      out.push(settlement);
    } catch (error) {
      // One slot that can't be read is left for the next run (or the keeper's fallback), not the others.
      runtime.log(`${tag}: not settled (${error instanceof Error ? error.message : String(error)})`);
    }
  }
  return out;
}

export const onCron = (runtime: Runtime<Config>, _payload: CronPayload): string => {
  const batch = buildSettlements(runtime);
  if (batch.length === 0) return "nothing to settle";
  const report = runtime.report(prepareReportRequest(encodeReport(batch))).result();
  const reply = evmClient(runtime.config)
    .writeReport(runtime, {
      receiver: runtime.config.receiver,
      report,
      gasConfig: { gasLimit: runtime.config.gasLimit },
    })
    .result();
  if (reply.txStatus !== TxStatus.SUCCESS) throw new Error(`writeReport failed: ${reply.errorMessage ?? reply.txStatus}`);
  const hash = bytesToHex(reply.txHash ?? new Uint8Array(32));
  runtime.log(`Settled ${batch.length} canon slot(s) in ${hash}`);
  return hash;
};

export function initWorkflow(config: Config) {
  const cron = new cre.capabilities.CronCapability();
  return [cre.handler(cron.trigger({ schedule: config.schedule }), onCron)];
}
