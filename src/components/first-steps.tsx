"use client";

import Link from "next/link";
import { useState } from "react";
import { KOMA, PRICE_PER_PAGE } from "@/lib/network";
import { useWallet } from "./wallet";

type Step = { key: string; title: string; body: string; done: boolean; action: React.ReactNode };

/**
 * A new wallet's shelf: three things to do, each ticked off from real state (AUSD balance on chain, coins held per
 * KOMA's index, issues minted), so the empty page says what to do next instead of "nothing here".
 */
export function FirstSteps({ issues, holdings }: { issues: number; holdings: number }) {
  const { address, usdc, refreshBalance } = useWallet();
  const [faucet, setFaucet] = useState<{ busy: boolean; msg?: string; error?: boolean }>({ busy: false });

  async function claim() {
    setFaucet({ busy: true });
    const res = await fetch("/api/faucet", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ address }) }).catch(() => null);
    const body = (await res?.json().catch(() => null)) as { error?: string; received?: number } | null;
    if (!res?.ok) return setFaucet({ busy: false, msg: body?.error ?? "The faucet didn't answer. Try again.", error: true });
    refreshBalance();
    setFaucet({ busy: false, msg: `+${(body?.received ?? 0).toLocaleString("en-US")} test AUSD` });
  }

  const funded = usdc > 0;
  const steps: Step[] = [
    {
      key: "fund",
      title: funded ? `You have ${usdc.toLocaleString("en-US", { maximumFractionDigits: 2 })} AUSD` : "Get AUSD",
      body: KOMA.faucet ? "Free test AUSD. No MON needed." : "Send AUSD here. KOMA pays the gas.",
      done: funded,
      action: KOMA.faucet ? (
        <button onClick={claim} disabled={faucet.busy} className="h-10 bg-arb px-4 font-display text-[15px] uppercase text-ink disabled:opacity-60">
          {faucet.busy ? "Asking Agora's faucet…" : "Get 10,000 test AUSD"}
        </button>
      ) : null,
    },
    {
      key: "make",
      title: "Make your first issue",
      body: `From ${PRICE_PER_PAGE.toFixed(2)} AUSD a page, minted to you.`,
      done: issues > 0,
      action: (
        <Link href="/create" className="slant inline-flex h-10 items-center px-4 text-[15px]">
          Make a comic
        </Link>
      ),
    },
    {
      key: "back",
      title: "Back a character",
      body: "Holders vote on the next episode.",
      done: holdings > 0,
      action: (
        <Link href="/series" className="inline-flex h-10 items-center border border-rule px-4 font-display text-[15px] uppercase text-paper hover:border-kapow">
          Browse series
        </Link>
      ),
    },
  ];
  const left = steps.filter((s) => !s.done).length;
  if (left === 0) return null;

  return (
    <section data-first-steps aria-labelledby="first-h" className="mt-8 border border-rule bg-stock p-5 md:p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="first-h" className="font-display text-[24px] uppercase leading-none text-paper">
          Start here
        </h2>
        <p className="font-mono text-[12px] text-mute">
          {3 - left} of 3 done
        </p>
      </div>
      <ol className="mt-4 grid gap-4 md:grid-cols-3">
        {steps.map((s, i) => (
          <li key={s.key} data-step={s.key} data-done={s.done || undefined} className={`flex flex-col gap-2 border p-4 ${s.done ? "border-[#5ad17a]/50" : "border-rule"}`}>
            <span className={`font-mono text-[12px] ${s.done ? "text-[#5ad17a]" : "text-kapow"}`}>{s.done ? "✓ done" : `Step ${i + 1}`}</span>
            <span className="font-display text-[19px] uppercase leading-tight text-paper">{s.title}</span>
            <span className="text-[13px] leading-relaxed text-soft">{s.body}</span>
            {!s.done && <span className="mt-auto pt-2">{s.action}</span>}
          </li>
        ))}
      </ol>
      {faucet.msg && (
        <p role={faucet.error ? "alert" : "status"} className={`mt-3 text-[13px] ${faucet.error ? "text-kapow" : "text-[#5ad17a]"}`}>
          {faucet.msg}
        </p>
      )}
    </section>
  );
}
