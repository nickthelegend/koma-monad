# KOMA on Chainlink CRE: `koma-canon`

Holders of a KOMA series coin vote, gaslessly by EIP-712 signature, on which proposed episode becomes **canon**.
Before this workflow KOMA's own server tallied those votes and called `CanonRegistry.finalize`, so the winner was
only as honest as the server. **`koma-canon` moves the tally and the settlement to a Chainlink CRE workflow.** Every
node of the DON re-checks every vote against Monad, and the result is written on chain through the Keystone
forwarder.

```
cron ─┬─ HTTP (consensus: identical bytes) ── KOMA /api/canon/due: closed slots + their signed votes
      ├─ EVM read (Monad) ─────────────────── CanonRegistry.slot: closed? not yet finalized?
      ├─ EVM read ─────────────────────────── CanonRegistry.proposals, seriesConfig → CharacterNFT.ownerOf (tie rule)
      ├─ per vote: EIP-712 recover (registry's domain) + CanonRegistry.votingPower at the snapshot
      ├─ canon.ts: most weight wins; ties → character owner's pick, else earliest; keeper's votes root
      └─ report + writeReport ─────────────── CanonSettler.onReport (via KeystoneForwarder) → CanonRegistry.finalize
```

| Part | File |
|---|---|
| Workflow | `koma-canon/workflow.ts` (handler), `koma-canon/canon.ts` (signature recovery, tally, root, report encoding), `koma-canon/abis.ts` |
| Tests (SDK test runtime, capability mocks, real signatures) | `koma-canon/workflow.test.ts`, `bun test` |
| Receiver | `contracts/src/cre/CanonSettler.sol` on Chainlink's `ReceiverTemplate` (`contracts/src/cre/vendor/`) |
| Receiver tests | `contracts/test/cre/CanonSettler.t.sol` (9 tests, one fuzz) |
| Deploy the receiver | `contracts/script/DeployCanonSettler.s.sol` (grants it `RELAYER_ROLE`; `scripts/local-setup.sh` runs it) |
| What it settles | `src/app/api/canon/due/route.ts` (deterministic list, no weights) |
| Fallback | `src/lib/server/launchpad/relay.ts`: with `KOMA_CANON_FINALIZER=cre` the keeper only finalizes a slot still open `KOMA_CANON_GRACE_S` (900 s) after its window |
| In the app | the canon board marks episodes "Settled by Chainlink CRE" (indexed from `CanonSettler.Settled`, also by Envio) |
| Fork run without the CLI | `koma-canon/fork-settle.ts`; end to end: `npm run test:cre` in the app |

## What changes for trust

- **Weights aren't KOMA's to state.** The due list carries signatures only; each node reads the voter's balance at
  the slot's snapshot from the coin (`votingPower`).
- **Forged or misattributed votes are dropped.** Each signature must recover to its voter under the registry's
  EIP-712 domain (chain id and registry address), for a proposal of that very slot.
- **The rules are KOMA's published rules,** byte for byte: the e2e checks the on-chain votes root and tallies equal
  what the keeper would have computed.
- **The registry still enforces everything it did** (window closed, not finalized, winner is a proposal, tally sane).
  `CanonSettler` only forwards; a slot it can't settle is skipped and logged, never reverted for the whole batch.
- **What KOMA can still do:** leave a vote out of the due list (censorship). The votes root it publishes makes that
  checkable after the fact; a next step is votes posted to a public store the workflow reads directly.

## Run it

```bash
cd cre/koma-canon && bun install        # also runs cre-setup (the Javy WASM plugin)
bun test                                # 8 tests, no network
bun run compile                         # dist/koma-canon.wasm (~2.9 MB), the SDK's determinism checks
```

On the local fork (`scripts/chain.sh` + `scripts/local-setup.sh`, app on :4320 with `KOMA_CANON_FINALIZER=cre`):

```bash
FORK_PRIVATE_KEY=<a funded local test key> bun fork-settle.ts config.local-fork.json
npm run test:cre                        # from the app: 7 checks, two voters → settled by CRE → shown in the app
```

`cre workflow simulate` needs a CRE account (`cre login`, done in a browser by the owner). From `cre/`:

```bash
cre login
cre workflow simulate koma-canon --target local-fork --non-interactive --trigger-index 0 --broadcast
# Monad testnet, once CanonSettler is deployed there and config.staging.json names it and KOMA's public URL:
cre workflow simulate koma-canon --target staging-settings --non-interactive --trigger-index 0
```

## Proof so far (6 Oct 2026, local fork of Monad testnet)

- `bun test`: 8 of 8. Rules against the keeper's (majority, tie → owner, tie → earliest, no votes, root format),
  synchronous EIP-712 recovery (wrong issue / episode / chain recover to someone else), and a full cron run through
  the SDK test runtime: a forged vote and an off-proposal vote dropped, a finalized slot and an unknown slot
  skipped, weights from `votingPower` not the list, and the exact report bytes the receiver decodes.
- `cre-compile`: `koma-canon.wasm` builds.
- `forge test --match-path test/cre/*`: 9 of 9 (forwarder-only, empty report, replay skipped, registry rules
  still apply, no role → nothing settles, pinned workflow id, fuzzed batches).
- On the fork: `CanonSettler` deployed with Monad testnet's MockKeystoneForwarder and `RELAYER_ROLE`. `npm run
  test:cre` 7 of 7: two holders vote on two fresh proposals, the keeper leaves the closed slot to CRE,
  `fork-settle.ts` delivers the report through the forwarder, `canonOf` is the bigger holder's pick, the on-chain
  votes root equals the keeper's formula, and the series page shows "Settled by Chainlink CRE".
- Not run: `cre workflow simulate` itself (needs `cre login`), and anything on public testnet (no deploys yet).
