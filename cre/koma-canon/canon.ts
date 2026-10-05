/**
 * Canon settlement rules, shared by the workflow (workflow.ts), its tests and the fork harness (fork-settle.ts).
 * Pure and synchronous: CRE handlers run in WASM, where there is no async signature recovery.
 *
 * The rules are KOMA's keeper rules (src/lib/server/launchpad/relay.ts `finalizeSlot`), so a slot settled by
 * CRE gets the same winner, tallies and votes root the keeper would have produced:
 *  - a vote counts with the voter's coin balance at the slot's snapshot, for one of the slot's proposals;
 *  - the most votes wins; a tie (including no votes at all) goes to the character owner's pick among the
 *    tied proposals, else the earliest proposal;
 *  - the votes root is keccak256 of the canonical JSON list of counted votes, sorted by voter.
 */
import { secp256k1 } from "@noble/curves/secp256k1";
import { type Address, encodeAbiParameters, getAddress, type Hex, hashTypedData, hexToBytes, keccak256, stringToBytes } from "viem";

export const voteTypes = {
  Vote: [
    { name: "seriesId", type: "uint256" },
    { name: "episode", type: "uint256" },
    { name: "issueId", type: "uint256" },
    { name: "voter", type: "address" },
  ],
} as const;

/** The EIP-712 domain KOMA's canon votes are signed under (src/lib/server/launchpad/canon.ts `voteDomain`). */
export const voteDomain = (chainId: number, canonRegistry: Address) => ({ name: "KOMA Canon", version: "1", chainId, verifyingContract: canonRegistry }) as const;

export type SignedVote = { issueId: number; voter: string; signature: Hex };
export type DueSlot = { seriesId: number; episode: number; endsAt: number; votes: SignedVote[] };
export type DueList = { chainId: number; canonRegistry: string; slots: DueSlot[] };

/** The address that signed a vote, or null when the signature is malformed. Synchronous (noble secp256k1). */
export function recoverVoter(chainId: number, canonRegistry: Address, seriesId: number, episode: number, v: SignedVote): Address | null {
  try {
    const digest = hashTypedData({
      domain: voteDomain(chainId, canonRegistry),
      types: voteTypes,
      primaryType: "Vote",
      message: { seriesId: BigInt(seriesId), episode: BigInt(episode), issueId: BigInt(v.issueId), voter: getAddress(v.voter) },
    });
    const bytes = hexToBytes(v.signature);
    if (bytes.length !== 65) return null;
    const recovery = bytes[64] >= 27 ? bytes[64] - 27 : bytes[64];
    if (recovery !== 0 && recovery !== 1) return null;
    const sig = secp256k1.Signature.fromCompact(bytes.slice(0, 64)).addRecoveryBit(recovery);
    const pub = sig.recoverPublicKey(hexToBytes(digest)).toRawBytes(false);
    return getAddress(`0x${keccak256(pub.slice(1)).slice(-40)}`);
  } catch {
    return null;
  }
}

export type CountedVote = { issueId: number; voter: string; weight: bigint; signature: Hex };

export type Settlement = {
  seriesId: bigint;
  episode: bigint;
  winnerIssueId: bigint;
  votesRoot: Hex;
  winnerVotes: bigint;
  totalVotes: bigint;
};

/** The keeper's canonical votes root: the counted votes as JSON (weight as a decimal string), sorted by voter. */
export function votesRoot(counted: CountedVote[]): Hex {
  const list = counted
    .map((v) => ({ issueId: v.issueId, voter: v.voter.toLowerCase(), weight: v.weight.toString(), signature: v.signature }))
    .sort((x, y) => (x.voter < y.voter ? -1 : 1));
  return keccak256(stringToBytes(JSON.stringify(list)));
}

/**
 * Tally one slot. `proposals` is the registry's list (proposal order, so the first is the earliest); `owner` is the
 * character NFT's owner, whose vote breaks ties.
 */
export function settle(seriesId: number, episode: number, proposals: number[], counted: CountedVote[], owner: string): Settlement {
  if (proposals.length === 0) throw new Error(`series ${seriesId} episode ${episode} has no proposals`);
  const tally = new Map<number, bigint>(proposals.map((p) => [p, 0n]));
  const valid = counted.filter((v) => tally.has(v.issueId) && v.weight > 0n);
  for (const v of valid) tally.set(v.issueId, tally.get(v.issueId)! + v.weight);
  const best = [...tally.values()].reduce((m, x) => (x > m ? x : m), 0n);
  const tied = proposals.filter((p) => tally.get(p) === best);
  let winner = tied[0];
  if (tied.length > 1) {
    const pick = valid.find((v) => v.voter.toLowerCase() === owner.toLowerCase() && tied.includes(v.issueId));
    if (pick) winner = pick.issueId;
  }
  const total = [...tally.values()].reduce((s, x) => s + x, 0n);
  return { seriesId: BigInt(seriesId), episode: BigInt(episode), winnerIssueId: BigInt(winner), votesRoot: votesRoot(valid), winnerVotes: best, totalVotes: total };
}

/** `abi.decode(report, (Settlement[]))` in CanonSettler. */
export const settlementParams = [
  {
    type: "tuple[]",
    components: [
      { name: "seriesId", type: "uint256" },
      { name: "episode", type: "uint256" },
      { name: "winnerIssueId", type: "uint256" },
      { name: "votesRoot", type: "bytes32" },
      { name: "winnerVotes", type: "uint256" },
      { name: "totalVotes", type: "uint256" },
    ],
  },
] as const;

export const encodeReport = (batch: Settlement[]): Hex => encodeAbiParameters(settlementParams, [batch]);

