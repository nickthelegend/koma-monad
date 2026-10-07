"use client";

import { useEffect, useState } from "react";
import { MonadMark } from "./icons";

type Speed = { pending: boolean; ms?: number; gasUsed?: number; block?: number; ethereum?: { usd: number; gwei: number } | null };

const usd = (n: number) => (n >= 1 ? `$${n.toFixed(2)}` : n >= 0.01 ? `$${n.toFixed(3)}` : `<$0.01`);

/**
 * "Confirmed on Monad in 412 ms": a transaction's real send → receipt time, the block, the gas KOMA paid, and what the
 * same gas would cost on Ethereum mainnet right now. Polls until the server has seen the receipt.
 */
export function SpeedReceipt({ tx, who = "KOMA", className = "" }: { tx: string; who?: string; className?: string }) {
  const [s, setS] = useState<Speed | null>(null);
  useEffect(() => {
    let live = true;
    let tries = 0;
    const poll = async () => {
      const r = (await fetch(`/api/speed/${tx}`, { cache: "no-store" }).then((x) => x.json()).catch(() => null)) as Speed | null;
      if (!live) return;
      if (r && !r.pending) setS(r);
      else if (++tries < 40) setTimeout(poll, 400);
    };
    const first = setTimeout(poll, 0);
    return () => {
      live = false;
      clearTimeout(first);
    };
  }, [tx]);
  if (!s?.ms) return null;
  const details = [
    `block #${s.block?.toLocaleString("en-US")}`,
    `${s.gasUsed?.toLocaleString("en-US")} gas paid by ${who}`,
    ...(s.ethereum ? [`≈ ${usd(s.ethereum.usd)} on Ethereum today`] : []),
  ];
  return (
    <div data-speed-receipt className={`font-mono text-[11.5px] leading-relaxed ${className}`}>
      <p className="flex items-center gap-1.5 text-soft">
        <MonadMark width={12} height={12} />
        Confirmed on Monad in <span className="text-arb">{s.ms.toLocaleString("en-US")} ms</span>
      </p>
      <p className="pl-[18px] text-mute">{details.join(" · ")}</p>
    </div>
  );
}
