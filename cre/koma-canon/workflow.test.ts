import { describe, expect } from "bun:test";
import { getNetwork } from "@chainlink/cre-sdk";
import { addContractMock, EvmMock, HttpActionsMock, newTestRuntime, REPORT_METADATA_HEADER_LENGTH, test } from "@chainlink/cre-sdk/test";
import { type Address, bytesToHex, decodeAbiParameters, getAddress, type Hex, keccak256, stringToBytes } from "viem";
import { privateKeyToAccount } from "viem/accounts";

import { canonAbi, erc721Abi } from "./abis";
import { recoverVoter, settle, settlementParams, voteDomain, voteTypes, votesRoot } from "./canon";
import { type Config, initWorkflow, onCron } from "./workflow";

const REGISTRY = getAddress("0x98a9ea7b55bb0bac87d44a42a83c860507d97301");
const NFT = getAddress("0x67d69f3b7034e997cf6299a08082e4e14460de00");
const RECEIVER = getAddress("0x00000000000000000000000000000000000000aa");
const CHAIN_ID = 10143;

// Anvil's public default dev accounts #1–#4 (well-known test keys, never funded anywhere real).
const alice = privateKeyToAccount("0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d");
const bob = privateKeyToAccount("0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a");
const carol = privateKeyToAccount("0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6");
const owner = privateKeyToAccount("0x47e179ec197488593b187f80a00eb0da91f1b9d0b13f8733639f19c30a34926a");

const config: Config = {
  schedule: "0 * * * * *",
  chainSelectorName: "monad-testnet",
  isTestnet: true,
  chainId: CHAIN_ID,
  komaUrl: "https://koma.example",
  canonRegistry: REGISTRY,
  receiver: RECEIVER,
  gasLimit: "800000",
  readFinalized: true,
  maxSlots: 20,
};

const sign = (who: typeof alice, seriesId: number, episode: number, issueId: number): Promise<Hex> =>
  who.signTypedData({
    domain: voteDomain(CHAIN_ID, REGISTRY),
    types: voteTypes,
    primaryType: "Vote",
    message: { seriesId: BigInt(seriesId), episode: BigInt(episode), issueId: BigInt(issueId), voter: who.address },
  });

const E18 = 10n ** 18n;

describe("canon rules (the keeper's, src/lib/server/launchpad/relay.ts)", () => {
  test("most votes wins; tallies and the keeper's votes root", () => {
    const counted = [
      { issueId: 12, voter: bob.address, weight: 5n * E18, signature: "0xbb" as Hex },
      { issueId: 11, voter: alice.address, weight: 3n * E18, signature: "0xaa" as Hex },
    ];
    const s = settle(1, 1, [11, 12], counted, owner.address);
    expect(s).toMatchObject({ seriesId: 1n, episode: 1n, winnerIssueId: 12n, winnerVotes: 5n * E18, totalVotes: 8n * E18 });
    // Exactly the keeper's canonical list: issueId, lowercase voter, decimal weight, signature; sorted by voter.
    const keeperList = [
      { issueId: 11, voter: alice.address.toLowerCase(), weight: (3n * E18).toString(), signature: "0xaa" },
      { issueId: 12, voter: bob.address.toLowerCase(), weight: (5n * E18).toString(), signature: "0xbb" },
    ].sort((x, y) => (x.voter < y.voter ? -1 : 1));
    expect(s.votesRoot).toBe(keccak256(stringToBytes(JSON.stringify(keeperList))));
  });

  test("a tie goes to the character owner's pick, else the earliest proposal", () => {
    const tie = [
      { issueId: 11, voter: alice.address, weight: 4n, signature: "0x01" as Hex },
      { issueId: 12, voter: owner.address, weight: 4n, signature: "0x02" as Hex },
    ];
    expect(settle(1, 1, [11, 12], tie, owner.address).winnerIssueId).toBe(12n);
    expect(settle(1, 1, [11, 12], tie, carol.address).winnerIssueId).toBe(11n);
    const none = settle(1, 2, [21, 22], [], owner.address);
    expect(none).toMatchObject({ winnerIssueId: 21n, winnerVotes: 0n, totalVotes: 0n });
    expect(none.votesRoot).toBe(keccak256(stringToBytes("[]")));
    expect(() => settle(1, 3, [], [], owner.address)).toThrow();
  });

  test("votes for a non-proposal or with no weight don't count, nor go in the root", () => {
    const s = settle(1, 1, [11], [
      { issueId: 11, voter: alice.address, weight: 2n, signature: "0x01" },
      { issueId: 99, voter: bob.address, weight: 50n, signature: "0x02" },
      { issueId: 11, voter: carol.address, weight: 0n, signature: "0x03" },
    ], owner.address);
    expect(s).toMatchObject({ winnerIssueId: 11n, winnerVotes: 2n, totalVotes: 2n });
    expect(s.votesRoot).toBe(votesRoot([{ issueId: 11, voter: alice.address, weight: 2n, signature: "0x01" }]));
  });

  test("EIP-712 votes recover synchronously to their signer", async () => {
    const sig = await sign(alice, 3, 1, 11);
    expect(recoverVoter(CHAIN_ID, REGISTRY, 3, 1, { issueId: 11, voter: alice.address, signature: sig })).toBe(alice.address);
    // The same signature presented for another issue, episode or chain recovers to someone else.
    expect(recoverVoter(CHAIN_ID, REGISTRY, 3, 1, { issueId: 12, voter: alice.address, signature: sig })).not.toBe(alice.address);
    expect(recoverVoter(CHAIN_ID, REGISTRY, 3, 2, { issueId: 11, voter: alice.address, signature: sig })).not.toBe(alice.address);
    expect(recoverVoter(143, REGISTRY, 3, 1, { issueId: 11, voter: alice.address, signature: sig })).not.toBe(alice.address);
    expect(recoverVoter(CHAIN_ID, REGISTRY, 3, 1, { issueId: 11, voter: alice.address, signature: "0x1234" })).toBeNull();
  });
});

function chainMocks(state: { finalized?: boolean; endsAt?: bigint } = {}) {
  const network = getNetwork({ chainFamily: "evm", chainSelectorName: "monad-testnet", isTestnet: true });
  const evm = EvmMock.testInstance(network!.chainSelector.selector);
  const registry = addContractMock(evm, { address: REGISTRY, abi: canonAbi });
  const weights: Record<string, bigint> = {
    [alice.address.toLowerCase()]: 3n * E18,
    [bob.address.toLowerCase()]: 5n * E18,
    [carol.address.toLowerCase()]: 9n * E18,
  };
  registry.slot = (seriesId: unknown, episode: unknown) => {
    if (seriesId === 7n) return [100n, 1_790_000_000n, true, 70n, 1n];
    if (seriesId === 3n && episode === 1n) return [100n, state.endsAt ?? 1_790_000_000n, state.finalized ?? false, 0n, 3n];
    return [0n, 0n, false, 0n, 0n];
  };
  registry.proposals = () => [11n, 12n, 13n];
  registry.votingPower = (_s: unknown, _e: unknown, voter: unknown) => weights[String(voter).toLowerCase()] ?? 0n;
  registry.seriesConfig = () => ({ coin: REGISTRY, characterNft: NFT, characterId: 4n, votingWindow: 60n, nextEpisode: 1n });
  const nft = addContractMock(evm, { address: NFT, abi: erc721Abi });
  nft.ownerOf = () => owner.address;
  let written: Uint8Array | null = null;
  const receiver = addContractMock(evm, { address: RECEIVER, abi: [] });
  receiver.writeReport = (input) => {
    written = input.report.rawReport;
    expect(input.gasConfig.gasLimit).toBe(800_000n);
    return { txStatus: "TX_STATUS_SUCCESS", txHash: new Uint8Array(32).fill(9) } as never;
  };
  return { written: () => written };
}

function serve(body: unknown) {
  const urls: string[] = [];
  HttpActionsMock.testInstance().sendRequest = (request) => {
    urls.push(request.url);
    return { statusCode: 200, body: new TextEncoder().encode(JSON.stringify(body)) } as never;
  };
  return urls;
}

describe("onCron", () => {
  test("verifies every vote on chain and settles the closed slot through one report", async () => {
    const chain = chainMocks();
    const forged = await sign(carol, 3, 1, 13); // carol signs, but the list says it's bob's vote
    const urls = serve({
      chainId: CHAIN_ID,
      canonRegistry: REGISTRY.toLowerCase(),
      slots: [
        {
          seriesId: 3,
          episode: 1,
          endsAt: 1_790_000_000,
          votes: [
            { issueId: 11, voter: alice.address.toLowerCase(), signature: await sign(alice, 3, 1, 11) },
            { issueId: 12, voter: bob.address.toLowerCase(), signature: await sign(bob, 3, 1, 12) },
            { issueId: 13, voter: bob.address.toLowerCase(), signature: forged },
            { issueId: 99, voter: carol.address.toLowerCase(), signature: await sign(carol, 3, 1, 99) },
          ],
        },
        { seriesId: 7, episode: 1, endsAt: 1_790_000_000, votes: [] },
        { seriesId: 8, episode: 1, endsAt: 1_790_000_000, votes: [] },
      ],
    });
    const runtime = newTestRuntime(null, { timeProvider: () => 1_790_000_100_000 }, config);
    expect(onCron(runtime as never, {} as never)).toBe(bytesToHex(new Uint8Array(32).fill(9)));
    expect(urls).toEqual(["https://koma.example/api/canon/due"]);

    const logs = runtime.getLogs().join("\n");
    expect(logs).toContain("not a proposal, dropped");
    // carol's signature names carol as the voter, so presented as bob's vote it recovers to neither of them.
    expect(logs).toContain(`vote by ${bob.address.toLowerCase()} has a signature from`);
    expect(logs).not.toContain(`has a signature from ${bob.address}`);
    expect(logs).toContain("series 7 episode 1: already finalized");
    expect(logs).toContain("series 8 episode 1: no such slot");

    const [batch] = decodeAbiParameters(settlementParams, bytesToHex(chain.written()!.slice(REPORT_METADATA_HEADER_LENGTH)));
    expect(batch).toHaveLength(1);
    // bob 5 > alice 3 (carol's forged and off-proposal votes dropped; weights from votingPower, not the list).
    expect(batch[0]).toMatchObject({ seriesId: 3n, episode: 1n, winnerIssueId: 12n, winnerVotes: 5n * E18, totalVotes: 8n * E18 });
  });

  test("a slot still open on chain is left alone, and an empty run writes nothing", async () => {
    const chain = chainMocks({ endsAt: 1_790_000_500n });
    serve({ chainId: CHAIN_ID, canonRegistry: REGISTRY, slots: [{ seriesId: 3, episode: 1, endsAt: 1_790_000_000, votes: [] }] });
    const runtime = newTestRuntime(null, { timeProvider: () => 1_790_000_100_000 }, config);
    expect(onCron(runtime as never, {} as never)).toBe("nothing to settle");
    expect(runtime.getLogs().join("\n")).toContain("voting still open");
    expect(chain.written()).toBeNull();
  });

  test("refuses a due list for another registry or chain", () => {
    chainMocks();
    serve({ chainId: 143, canonRegistry: REGISTRY, slots: [] });
    const runtime = newTestRuntime(null, {}, config);
    expect(() => onCron(runtime as never, {} as never)).toThrow(/this workflow settles/);
  });
});

describe("initWorkflow", () => {
  test("one cron handler on the configured schedule", () => {
    const handlers = initWorkflow(config);
    expect(handlers).toHaveLength(1);
    expect(handlers[0].fn).toBe(onCron);
    expect((handlers[0].trigger as { config?: { schedule?: string } }).config?.schedule).toBe(config.schedule);
  });
});

export type { Address };
