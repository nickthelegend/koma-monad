"use client";

import { useEffect, useRef, useState } from "react";
import { MONAD } from "@/lib/monad";

type State = "Proposed" | "Voted" | "Finalized" | "Verified";
type Block = { id: string; number: number; seen: number; ms: Partial<Record<State, number>>; txs: number };
type Transfer = { key: string; from: string; to: string; amount: number; state: State; seen: number; ms: Partial<Record<State, number>> };

const AUSD_TESTNET = "0xa9012a055bd4e0eDfF8Ce09f960291C09D5322dC";
const TRANSFER = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";
const ORDER: State[] = ["Proposed", "Voted", "Finalized", "Verified"];
const TONE: Record<State, string> = {
  Proposed: "border-rule text-mute",
  Voted: "border-arb/60 text-arb",
  Finalized: "border-[#5ad17a]/70 text-[#5ad17a]",
  Verified: "border-[#5ad17a] bg-[#5ad17a]/15 text-[#5ad17a]",
};
const median = (xs: number[]) => (xs.length ? [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)] : null);
const short = (a: string) => `0x${a.slice(-40, -36)}…${a.slice(-4)}`;
const latest = (ms: Partial<Record<State, number>>): State => [...ORDER].reverse().find((s) => s === "Proposed" || ms[s] !== undefined) ?? "Proposed";

/**
 * Monad's block pipeline, live from Monad testnet (read-only WebSocket): each block appears when it's Proposed and
 * moves through Voted → Finalized → Verified, with the measured milliseconds. Below it, AUSD transfers on testnet
 * as they happen, with the same commit states. Nothing like it exists on Ethereum or an L2. Pauses while the tab
 * is hidden; one connection, two filtered subscriptions.
 */
export function MonadPipeline() {
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [transfers, setTransfers] = useState<Transfer[]>([]);
  const [status, setStatus] = useState<"connecting" | "live" | "paused" | "error">("connecting");
  const hist = useRef<Record<State, number[]>>({ Proposed: [], Voted: [], Finalized: [], Verified: [] });
  const [medians, setMedians] = useState<Partial<Record<State, number | null>>>({});

  useEffect(() => {
    let ws: WebSocket | null = null;
    let closed = false;
    const blockMap = new Map<string, Block>();
    const txMap = new Map<string, Transfer>();

    const open = () => {
      if (closed || ws) return;
      setStatus("connecting");
      ws = new WebSocket(MONAD.testnet.wss);
      ws.onopen = () => {
        setStatus("live");
        ws!.send(JSON.stringify({ jsonrpc: "2.0", id: 1, method: "eth_subscribe", params: ["monadNewHeads"] }));
        ws!.send(JSON.stringify({ jsonrpc: "2.0", id: 2, method: "eth_subscribe", params: ["monadLogs", { address: AUSD_TESTNET, topics: [TRANSFER] }] }));
      };
      ws.onerror = () => setStatus("error");
      ws.onclose = () => {
        ws = null;
        if (!closed && document.visibilityState === "visible") setTimeout(open, 3000);
      };
      ws.onmessage = (e) => {
        const m = JSON.parse(e.data as string) as { params?: { result: Record<string, string> } };
        const r = m.params?.result;
        if (!r) return;
        const now = performance.now();
        const state = r.commitState as State;
        if (r.topics) {
          // An AUSD transfer: key by blockId + log index (a competing proposal is a different blockId).
          const key = `${r.blockId}:${r.logIndex}`;
          const t = txMap.get(key) ?? { key, from: `0x${r.topics[1].slice(26)}`, to: `0x${r.topics[2].slice(26)}`, amount: Number(BigInt(r.data)) / 1e6, state, seen: now, ms: {} };
          if (state !== "Proposed") t.ms[state] = Math.round(now - t.seen);
          t.state = state;
          txMap.set(key, t);
          const recent = [...txMap.values()].sort((a, b) => b.seen - a.seen).slice(0, 6);
          for (const k of txMap.keys()) if (!recent.some((x) => x.key === k)) txMap.delete(k);
          setTransfers(recent);
          return;
        }
        const id = r.blockId;
        const b = blockMap.get(id) ?? { id, number: parseInt(r.number, 16), seen: now, ms: {}, txs: 0 };
        if (state !== "Proposed" && b.ms[state] === undefined) {
          b.ms[state] = Math.round(now - b.seen);
          const h = hist.current[state];
          h.push(b.ms[state]!);
          if (h.length > 60) h.shift();
        }
        blockMap.set(id, b);
        const recent = [...blockMap.values()].sort((a, c) => c.number - a.number).slice(0, 9);
        for (const k of blockMap.keys()) if (!recent.some((x) => x.id === k)) blockMap.delete(k);
        setBlocks(recent);
        setMedians({ Voted: median(hist.current.Voted), Finalized: median(hist.current.Finalized), Verified: median(hist.current.Verified) });
      };
    };
    const close = () => {
      ws?.close();
      ws = null;
    };
    const onVis = () => {
      if (document.visibilityState === "visible") open();
      else {
        close();
        setStatus("paused");
      }
    };
    open();
    document.addEventListener("visibilitychange", onVis);
    return () => {
      closed = true;
      document.removeEventListener("visibilitychange", onVis);
      close();
    };
  }, []);

  const med = (s: State) => medians[s] ?? null;
  return (
    <div data-monad-pipeline className="border border-rule bg-stock p-4 md:p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="font-display text-[18px] uppercase leading-none text-paper">Block pipeline</p>
        <p className="font-mono text-[11px] text-mute">
          {status === "live" ? "● live · Monad testnet (read-only)" : status === "paused" ? "paused while hidden" : status === "error" ? "can't reach Monad testnet" : "connecting to Monad testnet…"}
        </p>
      </div>
      <ol className="mt-3 flex gap-1.5 overflow-hidden" aria-label="Recent Monad testnet blocks and their commit state">
        {blocks.map((b) => {
          const s = latest(b.ms);
          return (
            <li key={b.id} className={`min-w-[86px] flex-1 border px-2 py-1.5 font-mono text-[10.5px] leading-tight transition-colors ${TONE[s]}`}>
              <span className="block text-[11.5px]">#{b.number.toLocaleString("en-US")}</span>
              <span className="block uppercase">{s}</span>
              <span className="block text-mute">{b.ms[s] !== undefined ? `+${b.ms[s]} ms` : "now"}</span>
            </li>
          );
        })}
      </ol>
      <dl className="mt-3 grid grid-cols-3 gap-3 font-mono text-[11.5px]">
        {(["Voted", "Finalized", "Verified"] as State[]).map((s) => (
          <div key={s}>
            <dt className="text-mute">Proposed → {s}</dt>
            <dd className={`text-[18px] ${TONE[s].split(" ").filter((c) => c.startsWith("text-")).join(" ")}`}>{med(s) !== null ? `${med(s)} ms` : "…"}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-1 text-[11px] text-mute" title="Medians of the last blocks, measured in this browser from the first Proposed message. Blocks are 300 ms; a block is final two slots later.">
        medians · measured in this browser
      </p>

      <p className="mt-4 font-display text-[15px] uppercase text-paper">AUSD on Monad testnet, live</p>
      {transfers.length === 0 ? (
        <p className="mt-1 text-[12px] text-mute">Waiting for the next AUSD transfer on testnet…</p>
      ) : (
        <ul className="mt-1.5 divide-y divide-rule/60 font-mono text-[11.5px]">
          {transfers.map((t) => (
            <li key={t.key} className="flex flex-wrap items-center gap-x-3 py-1">
              <span className={`border px-1.5 py-px text-[10px] uppercase ${TONE[t.state]}`}>{t.state}</span>
              <span className="text-soft">
                {short(t.from)} → {short(t.to)}
              </span>
              <span className="text-paper">{t.amount.toLocaleString("en-US", { maximumFractionDigits: 2 })} AUSD</span>
              {t.ms.Finalized !== undefined && <span className="text-mute">final in {t.ms.Finalized} ms</span>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
