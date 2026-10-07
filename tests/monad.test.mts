import { test } from "node:test";
import assert from "node:assert/strict";
import { MONAD, reserveBudget, tightGasLimit } from "../src/lib/monad.ts";

const MON = BigInt(10) ** BigInt(18);
const gwei = BigInt(10) ** BigInt(9);

test("reserve budget: in-flight fees must fit within min(10 MON, balance)", () => {
  // 50 MON relayer, 300k gas at 102 gwei = 0.0306 MON per relay: fits easily under the 10 MON cap.
  const ok = reserveBudget({ balanceWei: 50n * MON, inFlightFeesWei: 0n, gasLimit: 300_000n, maxFeePerGasWei: 102n * gwei });
  assert.equal(ok.ok, true);
  assert.equal(ok.capWei, MONAD.reserveWei);
  assert.equal(ok.belowReserve, false);
  // 9.99 MON already in flight: one more doesn't fit, whatever the balance.
  const full = reserveBudget({ balanceWei: 50n * MON, inFlightFeesWei: 9_990_000_000_000_000_000n, gasLimit: 300_000n, maxFeePerGasWei: 102n * gwei });
  assert.equal(full.ok, false);
});

test("reserve budget: below 10 MON the balance itself is the cap", () => {
  const low = reserveBudget({ balanceWei: MON / 100n, inFlightFeesWei: 0n, gasLimit: 300_000n, maxFeePerGasWei: 102n * gwei });
  assert.equal(low.belowReserve, true);
  assert.equal(low.capWei, MON / 100n);
  assert.equal(low.ok, false); // 0.0306 MON > 0.01 MON
});

test("tight gas limits: margin then round up to 1,000", () => {
  assert.equal(tightGasLimit(242_462n), 279_000n); // ×1.15 = 278,831.3 → 279,000
  assert.equal(tightGasLimit(100_000n, 0), 100_000n);
  assert.ok(tightGasLimit(242_462n) < (242_462n * 13n) / 10n); // tighter than the old ×1.3
});
