# How KOMA uses Chainlink CRE: fans vote, and CRE decides the canon

*KOMA · Monad Metropolis, Track 03 · live at https://koma-comics.up.railway.app*

In KOMA, a comic's hero becomes a series with its own coin, and **holders vote on what happens next**. Each round,
holders propose episodes (AI-written comics) and vote for free with signatures. The winning episode becomes
**canon**, the fixed history that the next episode's writer reads first. A Chainlink CRE workflow decides that
winner on Monad.

## The problem CRE solves: whoever tallies the votes controls the story

Votes are free EIP-712 signatures: fans never pay gas to vote. That means the votes live off chain until someone
counts them. If KOMA's own server counted them and wrote the result, KOMA could quietly pick a different winner.
Canon is the product, so the tally can't be a trust-me step.

KOMA hands the tally to a **Chainlink CRE workflow**. It re-checks every signature and every voter's weight against
Monad itself, applies the published tie rule, and settles the winner through a contract only Chainlink's forwarder can
call. KOMA's server only *lists* the votes. Each node checks them against the chain, and a withheld vote is
detectable from the published votes root.

## How it works

`cre/koma-canon` is a TypeScript CRE workflow on a cron trigger (`workflow.ts`):

```ts
export function initWorkflow(config: Config) {
  const cron = new cre.capabilities.CronCapability();
  return [cre.handler(cron.trigger({ schedule: config.schedule }), onCron)];
}
```

Each run:

1. **Fetch the due rounds.** It calls KOMA's public `/api/canon/due` through CRE's HTTP capability, with consensus
   across nodes (`consensusIdenticalAggregation`). It refuses to run if KOMA serves a different registry or chain
   than the workflow's config.
2. **Read the chain.** For each round, CRE's EVM client reads `CanonRegistry` on Monad: the slot (`endsAt`,
   `finalized`), the proposal list, and the series config. It also reads the character NFT's owner, who breaks ties.
   A round that's still open or already finalized is skipped.
3. **Re-verify every vote.** Each signature is recovered against the EIP-712 domain `KOMA Canon` v1 (the registry's
   address, chain 10143). A vote for a non-proposal, a signature that doesn't recover to the claimed voter, or a voter
   who held nothing at the round's snapshot is dropped and logged (`canon.ts`):

   ```ts
   const signer = recoverVoter(config.chainId, registry, s.seriesId, s.episode, v);
   if (!signer || signer.toLowerCase() !== v.voter.toLowerCase()) { /* dropped */ }
   const weight = read(runtime, client, "votingPower", [seriesId, episode, voter]); // ERC20Votes at the snapshot
   if (weight === 0n) { /* held nothing at the snapshot, dropped */ }
   ```

4. **Tally.** Votes are weighted by the coins each voter held when the round opened, which stops a buy-then-vote
   rush. The most weight wins; on a tie, the character owner's vote decides, else the earliest proposal. The workflow
   computes the **votes root**: keccak256 of the counted votes, sorted by voter. That's the same formula KOMA's keeper
   publishes, so anyone can recompute it from the public vote list.
5. **Report and settle.** The batch is ABI-encoded, signed as a CRE report, and written to Monad through the
   forwarder (`writeReport`). `CanonSettler` (`contracts/src/cre/CanonSettler.sol`) is a `ReceiverTemplate`, so only
   the forwarder can call it. It holds the registry's `RELAYER_ROLE` and finalizes each settlement:

   ```solidity
   function _processReport(bytes calldata report) internal override {
       Settlement[] memory batch = abi.decode(report, (Settlement[]));
       for (uint256 i; i < batch.length; ++i) {
           try registry.finalize(s.seriesId, s.episode, s.winnerIssueId, s.votesRoot, s.winnerVotes, s.totalVotes) {
               emit Settled(s.seriesId, s.episode, s.winnerIssueId, s.votesRoot);
           } catch (bytes memory reason) { emit SettlementSkipped(s.seriesId, s.episode, reason); }
       }
   }
   ```

   `CanonRegistry.finalize` re-applies its own rules: the window must be over, the winner must be a proposal, and a
   round can't be finalized twice.

## Engineering notes

- **What ran, plainly.** On Monad testnet we ran `cre workflow simulate koma-canon --target staging-settings
  --broadcast`. The CRE CLI executes the workflow and delivers the signed report through Chainlink's
  **MockKeystoneForwarder** (`0xB9F79d86…`) into our `CanonSettler`. Deploying the same workflow to the DON needs
  `cre account access`, and that's not done yet.
- **Keeper fallback.** If CRE hasn't settled a round within a grace period (`KOMA_CANON_GRACE_S=900`), KOMA's keeper
  finalizes it with the same formula. Rounds settled by CRE are labelled "Settled by Chainlink CRE" in the app.
- **One bad round doesn't block the batch.** Each settlement is a `try`, and failures are logged and skipped.
- **Tests:** `forge test --match-path test/cre/*` (9/9: forwarder-only, empty report, replay, registry rules,
  pinned workflow id, fuzzed batches) and `npm run test:cre` on a Monad fork (two holders, two competing proposals,
  CRE settles the bigger holder's pick, and the votes root matches the keeper's).

## The value CRE brought

- **The canon is credible.** "Fans write the canon" holds only if no one, including KOMA, can rewrite the tally. CRE
  makes the winner a function of signatures and on-chain balances, delivered through Chainlink.
- **Voting stays free.** Fans sign; they never pay gas. CRE does the counting and pays to settle.
- **Auditable.** The votes root on chain commits to exactly which votes counted, so anyone can recompute it.

## Live proof (Monad testnet)

| Round | Settle tx |
|---|---|
| Signal Fire, episode 1 (1 voter) | [0x054895f6…587e](https://testnet.monadvision.com/tx/0x054895f670667690274759331cbb65bba0b34c9c31f691c87a52be9764a0587e) |
| Signal Fire, episode 2, **contested: 5 verified votes, 62% to the winner** | [0x63e90dcd…cd57](https://testnet.monadvision.com/tx/0x63e90dcd958a40d64ea7c9de388533aeb23b4d5ab77a1dfe314143fea833cd57) |
| Signal Fire, episode 3 (5 verified votes) | [0x16d3a3ad…f144a75](https://testnet.monadvision.com/tx/0x16d3a3ad75dd3ef84c2139dc325f919afe3f746f361cf23931308c5f5f144a75) |
| Ferry of Lost Things, episode 1 (4 verified votes) | [0xffcf4bfb…c4df](https://testnet.monadvision.com/tx/0xffcf4bfb1a1be6df8dd51afbde4d08a4f2bc14221c3abd00339b995c67b6c4df) |
| Ferry of Lost Things, episode 2 (4 verified votes; the run shown in `docs/demo/bounty-cre.mp4`) | [0xd73ea019…0d2a](https://testnet.monadvision.com/tx/0xd73ea01980379dc499286330abceaf1850800978a16a76acb738f1119a380d2a) |

- **Contracts:**
  - `CanonSettler` [`0x5e307d014eb2d46B02cbed483a9fd32b23144825`](https://testnet.monadvision.com/address/0x5e307d014eb2d46B02cbed483a9fd32b23144825);
  - `CanonRegistry` [`0x6ee09Bc9ad42EdD588C97AcC4eb1665f080455ea`](https://testnet.monadvision.com/address/0x6ee09Bc9ad42EdD588C97AcC4eb1665f080455ea).

  Both are verified on Sourcify.
- **In the app:** each settled episode on a series page shows "Settled by Chainlink CRE" with its tx. The demo video
  shows a settle and the reveal that follows.
- **Seeded activity:** the voters in the multi-vote rounds are team-controlled wallets (`docs/evidence/seed-13oct.md`).
- **Code:** `cre/koma-canon/workflow.ts`, `cre/koma-canon/canon.ts`, `contracts/src/cre/CanonSettler.sol`,
  `contracts/src/CanonRegistry.sol`.
