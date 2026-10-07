"use client";

import { useEffect, useState } from "react";
import type { MonadLive } from "@/lib/server/monad-live";

/** Live read-only facts from Monad testnet (refreshes every 5 s): block-state tags, staking epoch, precompiles. */
export function MonadFacts({ initial }: { initial: MonadLive }) {
  const [v, setV] = useState(initial);
  useEffect(() => {
    const t = setInterval(async () => {
      const r = (await fetch("/api/monad", { cache: "no-store" }).then((x) => x.json()).catch(() => null)) as MonadLive | null;
      if (r) setV(r);
    }, 5000);
    return () => clearInterval(t);
  }, []);
  const t = v.testnet;
  if (!t) return <p className="text-[13px] text-mute">Monad testnet didn&rsquo;t answer just now ({v.testnetError}). Retrying…</p>;
  const rows: [string, React.ReactNode, string][] = [
    ["latest · safe · finalized", `#${t.latest.toLocaleString("en-US")} · #${t.safe.toLocaleString("en-US")} · #${t.finalized.toLocaleString("en-US")}`, "One JSON-RPC batch. Proposed, Voted, Finalized: N, N−1, N−2."],
    ["Staking epoch (0x1000)", t.epoch !== null ? `${t.epoch.toLocaleString("en-US")}${t.inEpochDelay ? " · in its delay period" : ""}` : "—", "getEpoch() on the native staking precompile."],
    [
      "P256VERIFY (0x0100)",
      t.p256.valid && t.p256.tamperedRejected ? "a fresh signature verifies · a tampered one fails" : "unexpected answer",
      "Signed with a new key on every refresh; this is how passkey (WebAuthn ES256) signatures verify on chain.",
    ],
    ["Reserve balance (0x1001)", t.reserveDipped === null ? "—" : t.reserveDipped ? "dipped" : "not dipped", "dippedIntoReserve(), the precompile behind the 10 MON reserve rule KOMA's relayer respects."],
  ];
  return (
    <dl data-monad-facts className="divide-y divide-rule border-y border-rule">
      {rows.map(([k, val, note]) => (
        <div key={k} className="grid gap-1 py-2.5 md:grid-cols-[220px_1fr]">
          <dt className="font-mono text-[12px] text-mute">{k}</dt>
          <dd>
            <span className="font-mono text-[13px] text-paper">{val}</span>
            <span className="block text-[12px] text-mute">{note}</span>
          </dd>
        </div>
      ))}
    </dl>
  );
}
