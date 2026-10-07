/**
 * Monad facts KOMA relies on (docs.monad.xyz, checked against Monad testnet on 2026-10-07). Pure: shared by the
 * browser, the server and unit tests.
 */
export const MONAD = {
  /** MIP-12 (v0.15.0): 300 ms blocks. viem's chain definitions still say 400. */
  blockMs: 300,
  /** Two slots: a block is Finalized (irreversible) about 600 ms after it's proposed. */
  finalityMs: 600,
  testnet: {
    chainId: 10143,
    rpc: "https://testnet-rpc.monad.xyz",
    wss: "wss://testnet-rpc.monad.xyz",
    explorer: "https://testnet.monadvision.com",
  },
  precompiles: {
    /** EIP-7951 / RIP-7212 P256VERIFY: hash‖r‖s‖qx‖qy (160 bytes) → 1 if valid. Passkeys (WebAuthn ES256). */
    p256: "0x0000000000000000000000000000000000000100",
    /** Native staking: getEpoch() etc. CALL only (eth_call works). */
    staking: "0x0000000000000000000000000000000000001000",
    /** Reserve balance: dippedIntoReserve(). CALL only. */
    reserve: "0x0000000000000000000000000000000000001001",
  },
  /** Canonical contracts on Monad testnet (all present on a fork too, cloned lazily from testnet). */
  canonical: {
    WMON: "0xFb8bf4c1CC7a94c73D209a149eA2AbEa852BC541",
    Multicall3: "0xcA11bde05977b3631167028862bE2a173976CA11",
    Permit2: "0x000000000022D473030F116dDEE9F6B43aC78BA3",
    CreateX: "0xba5Ed099633D3B313e4D5F7bdc1305d3c28ba5Ed",
    "EntryPoint v0.7": "0x0000000071727De22E5E9d8BAf0edAc6f37da032",
    "ERC-6551 Registry": "0x000000006551c19487814612e58FE06813775758",
    "x402 ExactPermit2Proxy": "0x402085c248EeA27D92E8b30b2C58ed07f9E20001",
  },
  /** Every EOA keeps a 10 MON reserve for in-flight gas (consensus runs 3 blocks behind execution). */
  reserveWei: BigInt(10) * BigInt(10) ** BigInt(18),
  /** Base-fee floor on Monad: 100 gwei; priority fee is 2 gwei. */
  baseFeeFloorWei: BigInt(100) * BigInt(10) ** BigInt(9),
} as const;

/**
 * The reserve-balance rule for an account that sends value-less transactions (KOMA's relayer): at consensus time
 * the summed max gas fees of its in-flight transactions must fit within min(10 MON, its balance). Monad charges the
 * gas *limit*, so the fee budget of a transaction is gasLimit × maxFeePerGas.
 */
export function reserveBudget(o: { balanceWei: bigint; inFlightFeesWei: bigint; gasLimit: bigint; maxFeePerGasWei: bigint }) {
  const feeWei = o.gasLimit * o.maxFeePerGasWei;
  const capWei = o.balanceWei < MONAD.reserveWei ? o.balanceWei : MONAD.reserveWei;
  const needWei = o.inFlightFeesWei + feeWei;
  return { feeWei, capWei, needWei, ok: needWei <= capWei, belowReserve: o.balanceWei < MONAD.reserveWei };
}

/** A gas limit with a margin, rounded up to the next 1,000 (Monad bills the limit, so keep it tight). */
export const tightGasLimit = (estimate: bigint, marginPct = 15) => {
  const raw = (estimate * BigInt(100 + marginPct) + BigInt(99)) / BigInt(100);
  return ((raw + BigInt(999)) / BigInt(1000)) * BigInt(1000);
};
