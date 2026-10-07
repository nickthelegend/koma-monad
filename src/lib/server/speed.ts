import type { Hex } from "viem";
import { publicClient } from "./config";
import { db } from "./store";

/**
 * Monad speed receipts: for every transaction KOMA submits (relayed trades, x402 settlements, launches, canon
 * proposals and finalizations), the time from handing it to the RPC to its receipt, the gas it used and the block
 * it landed in. All of it is read from the real receipt. The Ethereum comparison prices the same gas at
 * Ethereum mainnet's current gas price and ETH/USD (public endpoints, cached), and is left out when they can't be
 * reached.
 */
export type SpeedKind = "trade" | "x402" | "launch" | "canon" | "graduate" | "tx";
/** `ms`: send → receipt (executed). `finalMs`: send → the chain's `finalized` tag reaching that block. */
export type Speed = { tx: Hex; kind: SpeedKind; ms: number; finalMs: number | null; gasUsed: number; block: number; sentAt: number };

let ready = false;
function table() {
  const d = db();
  if (!ready) {
    d.exec(`CREATE TABLE IF NOT EXISTS tx_speed (
      tx TEXT PRIMARY KEY, kind TEXT NOT NULL, sent_at INTEGER NOT NULL, ms INTEGER NOT NULL, gas_used INTEGER NOT NULL, block INTEGER NOT NULL
    )`);
    if (!(d.prepare("PRAGMA table_info(tx_speed)").all() as { name: string }[]).some((c) => c.name === "final_ms")) d.exec("ALTER TABLE tx_speed ADD COLUMN final_ms INTEGER");
    ready = true;
  }
  return d;
}

/** Max gas fees (limit × max fee) of transactions sent but not yet seen in a receipt, for the reserve-balance rule. */
const inFlight = new Map<string, bigint>();
export const inFlightFeesWei = () => [...inFlight.values()].reduce((a, b) => a + b, BigInt(0));

/** Call right after the transaction was sent (`sentAt` = just before sending); waits for the receipt in the background. */
export function track(kind: SpeedKind, tx: Hex, sentAt: number, feeBudgetWei?: bigint) {
  if (feeBudgetWei) inFlight.set(tx.toLowerCase(), feeBudgetWei);
  void publicClient
    .waitForTransactionReceipt({ hash: tx, timeout: 90_000, pollingInterval: 50 })
    .then(async (r) => {
      const ms = Date.now() - sentAt;
      table()
        .prepare("INSERT OR IGNORE INTO tx_speed (tx, kind, sent_at, ms, gas_used, block) VALUES (?, ?, ?, ?, ?, ?)")
        .run(tx.toLowerCase(), kind, sentAt, ms, Number(r.gasUsed), Number(r.blockNumber));
      // Monad's second timer: the receipt comes at Proposed; the block is final when `finalized` reaches it (two
      // slots on Monad). An anvil fork doesn't model finality (its `finalized` tag trails `latest` by many blocks),
      // so there the timer gives up after 5 s and stays empty rather than report something meaningless.
      for (let i = 0; i < 50; i++) {
        const f = await publicClient.getBlock({ blockTag: "finalized" }).catch(() => null);
        if (f && f.number >= r.blockNumber) {
          table().prepare("UPDATE tx_speed SET final_ms = ? WHERE tx = ?").run(Date.now() - sentAt, tx.toLowerCase());
          return;
        }
        await new Promise((res) => setTimeout(res, 100));
      }
    })
    .catch(() => {})
    .finally(() => inFlight.delete(tx.toLowerCase()));
}

type Row = { tx: string; kind: SpeedKind; sent_at: number; ms: number; final_ms: number | null; gas_used: number; block: number };
const toSpeed = (r: Row): Speed => ({ tx: r.tx as Hex, kind: r.kind, ms: r.ms, finalMs: r.final_ms, gasUsed: r.gas_used, block: r.block, sentAt: r.sent_at });

export function speedOf(tx: string): Speed | null {
  const r = table().prepare("SELECT * FROM tx_speed WHERE tx = ?").get(tx.toLowerCase()) as Row | undefined;
  return r ? toSpeed(r) : null;
}

export function speedsOf(txs: string[]): Record<string, Speed> {
  const out: Record<string, Speed> = {};
  for (const t of txs) {
    const s = speedOf(t);
    if (s) out[t.toLowerCase()] = s;
  }
  return out;
}

/** The last N confirmations and their median, for the receipts page and the status bar. */
export function recentSpeeds(n = 50) {
  const rows = (table().prepare("SELECT * FROM tx_speed ORDER BY sent_at DESC LIMIT ?").all(n) as Row[]).map(toSpeed);
  const sorted = rows.map((r) => r.ms).sort((a, b) => a - b);
  const median = sorted.length ? sorted[Math.floor(sorted.length / 2)] : null;
  return { count: rows.length, medianMs: median, recent: rows };
}

// ——— What the same gas would cost on Ethereum mainnet right now ———
const ETH_RPC = process.env.KOMA_ETH_PRICE_RPC || "https://ethereum-rpc.publicnode.com";
let ethCache: { at: number; gasPriceWei: bigint; ethUsd: number } | null = null;

async function ethPrices() {
  if (ethCache && Date.now() - ethCache.at < 10 * 60_000) return ethCache;
  try {
    const [gas, spot] = await Promise.all([
      fetch(ETH_RPC, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "eth_gasPrice", params: [] }),
        signal: AbortSignal.timeout(4000),
      }).then((r) => r.json() as Promise<{ result?: string }>),
      fetch("https://api.coinbase.com/v2/prices/ETH-USD/spot", { signal: AbortSignal.timeout(4000) }).then((r) => r.json() as Promise<{ data?: { amount?: string } }>),
    ]);
    const gasPriceWei = BigInt(gas.result ?? "0");
    const ethUsd = Number(spot.data?.amount);
    if (gasPriceWei > BigInt(0) && Number.isFinite(ethUsd) && ethUsd > 0) ethCache = { at: Date.now(), gasPriceWei, ethUsd };
  } catch {
    // Unreachable: the comparison is simply left out.
  }
  return ethCache;
}

/** USD that `gasUsed` costs on Ethereum mainnet at its current gas price, or null when prices can't be fetched. */
export async function ethereumCostUsd(gasUsed: number): Promise<{ usd: number; gwei: number } | null> {
  const p = await ethPrices();
  if (!p) return null;
  const wei = p.gasPriceWei * BigInt(gasUsed);
  return { usd: (Number(wei) / 1e18) * p.ethUsd, gwei: Number(p.gasPriceWei) / 1e9 };
}
