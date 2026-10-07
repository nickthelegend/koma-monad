import { p256 } from "@noble/curves/p256";
import { bytesToHex, getAddress, sha256, stringToBytes, type Hex } from "viem";
import { MONAD } from "@/lib/monad";
import { publicClient } from "./config";

/**
 * Read-only Monad testnet probes (no transactions): the block-state tags, the staking epoch and the P256 and
 * reserve precompiles, read live from the public RPC with one JSON-RPC batch. Plus which canonical contracts are
 * present on KOMA's own chain (a fork clones them from testnet). Cached briefly: the public RPC allows 25 eth_call/s.
 */
type Rpc = { id: number; result?: unknown; error?: { message: string } };

async function batch(calls: { method: string; params: unknown[] }[]): Promise<Rpc[]> {
  const res = await fetch(MONAD.testnet.rpc, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(calls.map((c, i) => ({ jsonrpc: "2.0", id: i, ...c }))),
    signal: AbortSignal.timeout(5000),
  });
  if (!res.ok) throw new Error(`Monad testnet RPC ${res.status}`);
  return ((await res.json()) as Rpc[]).sort((a, b) => a.id - b.id);
}

/** A P256 (WebAuthn ES256) signature made just now, and the precompile input for it: hash‖r‖s‖qx‖qy. */
export function p256Vector(tamper = false): Hex {
  const key = p256.utils.randomPrivateKey();
  const pub = p256.getPublicKey(key, false);
  const hash = sha256(stringToBytes(`KOMA P256 check ${Date.now()}`), "bytes");
  const sig = p256.sign(hash, key);
  const r = sig.r.toString(16).padStart(64, "0");
  const s = (tamper ? sig.s ^ BigInt(1) : sig.s).toString(16).padStart(64, "0");
  return `${bytesToHex(hash)}${r}${s}${bytesToHex(pub.slice(1, 33)).slice(2)}${bytesToHex(pub.slice(33)).slice(2)}` as Hex;
}

export type MonadLive = {
  at: number;
  testnet: {
    latest: number;
    safe: number;
    finalized: number;
    epoch: number | null;
    inEpochDelay: boolean | null;
    p256: { valid: boolean; tamperedRejected: boolean };
    reserveDipped: boolean | null;
  } | null;
  testnetError?: string;
  canonical: { name: string; address: string; present: boolean }[];
};

let cache: { at: number; v: MonadLive } | null = null;

export async function monadLive(): Promise<MonadLive> {
  if (cache && Date.now() - cache.at < 4000) return cache.v;
  let testnet: MonadLive["testnet"] = null;
  let testnetError: string | undefined;
  try {
    const r = await batch([
      { method: "eth_getBlockByNumber", params: ["latest", false] },
      { method: "eth_getBlockByNumber", params: ["safe", false] },
      { method: "eth_getBlockByNumber", params: ["finalized", false] },
      { method: "eth_call", params: [{ to: MONAD.precompiles.staking, data: "0x757991a8" }, "latest"] }, // getEpoch()
      { method: "eth_call", params: [{ to: MONAD.precompiles.p256, data: p256Vector() }, "latest"] },
      { method: "eth_call", params: [{ to: MONAD.precompiles.p256, data: p256Vector(true) }, "latest"] },
      { method: "eth_call", params: [{ to: MONAD.precompiles.reserve, data: "0x3a61584e" }, "latest"] }, // dippedIntoReserve()
    ]);
    const num = (x: Rpc) => Number((x.result as { number?: string } | undefined)?.number ?? NaN);
    const word = (x: Rpc, i: number) => (typeof x.result === "string" && x.result.length >= 2 + 64 * (i + 1) ? BigInt(`0x${x.result.slice(2 + 64 * i, 2 + 64 * (i + 1))}`) : null);
    const epoch = word(r[3], 0);
    const delay = word(r[3], 1);
    const reserve = word(r[6], 0);
    testnet = {
      latest: num(r[0]),
      safe: num(r[1]),
      finalized: num(r[2]),
      epoch: epoch === null ? null : Number(epoch),
      inEpochDelay: delay === null ? null : delay === BigInt(1),
      p256: { valid: word(r[4], 0) === BigInt(1), tamperedRejected: r[5].result === "0x" || word(r[5], 0) !== BigInt(1) },
      reserveDipped: reserve === null ? null : reserve === BigInt(1),
    };
  } catch (e) {
    testnetError = (e as Error).message;
  }
  const canonical = await Promise.all(
    Object.entries(MONAD.canonical).map(async ([name, address]) => ({
      name,
      address: getAddress(address),
      present: ((await publicClient.getCode({ address: getAddress(address) }).catch(() => undefined)) ?? "0x") !== "0x",
    })),
  );
  const v: MonadLive = { at: Date.now(), testnet, ...(testnetError ? { testnetError } : {}), canonical };
  cache = { at: Date.now(), v };
  return v;
}
