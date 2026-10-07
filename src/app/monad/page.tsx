import type { Metadata } from "next";
import Link from "next/link";
import { MonadPipeline } from "@/components/monad-pipeline";
import { MonadFacts } from "@/components/monad-facts";
import { MonadMark } from "@/components/icons";
import { MONAD } from "@/lib/monad";
import { KOMA } from "@/lib/network";
import { monadLive } from "@/lib/server/monad-live";
import { recentSpeeds } from "@/lib/server/speed";
import { config, publicClient } from "@/lib/server/config";
import { addressUrl } from "@/lib/explorer";

export const metadata: Metadata = {
  title: "Built for Monad",
  description: "Monad's block pipeline live from testnet, the precompiles and canonical contracts KOMA uses, and its own measured confirmations.",
};

export const dynamic = "force-dynamic";

const FORK = KOMA.key === "koma-localnet";

/** Where each Monad-native piece runs, said plainly (live testnet read · this chain · awaiting the testnet go). */
const COVERAGE: { item: string; status: string; where: string }[] = [
  { item: "Block pipeline (monadNewHeads) + AUSD tape (monadLogs) with commit states", status: "live read", where: "Monad testnet WebSocket, this page" },
  { item: "Two-timer receipts: executed + final", status: FORK ? "built · fork: executed only" : "built · live", where: "trade widget, studio, /receipts; a fork doesn't model finality, Monad's live timings are above" },
  { item: "Passkeys on chain: P256VERIFY (0x0100)", status: "built · live read", where: "every Writers' Room unlock's passkey signature, verified here and on Monad testnet by eth_call" },
  { item: "Native staking (0x1000)", status: "live read", where: "epoch above; KOMA holds no MON to stake, so no delegate flow" },
  { item: "Gas: limit-billed, explicit tight limits; reserve balance (0x1001)", status: "built", where: "relayer refuses relays that would break the 10 MON reserve rule" },
  { item: "x402 on Monad (AUSD, EIP-3009)", status: "built", where: "KOMA's own facilitator by default; KOMA_X402_FACILITATOR_URL switches to Monad's hosted one (verify checked live)" },
  { item: "Canonical contracts (Permit2, Multicall3, ERC-6551, x402 proxies…)", status: "built", where: "present on this chain (below); MonadVision verification awaits the deploy" },
  { item: "txpool_statusByHash, eth_sendRawTransactionSync", status: "awaiting testnet go", where: "relayer sends need MON on testnet; the fork has neither method" },
];

export default async function MonadPage() {
  const live = await monadLive();
  const ours = recentSpeeds(200);
  const finals = ours.recent.map((r) => r.finalMs).filter((x): x is number => x != null).sort((a, b) => a - b);
  const finalMedian = finals.length ? finals[Math.floor(finals.length / 2)] : null;
  const relayer = config.account ? await publicClient.getBalance({ address: config.account.address }).catch(() => null) : null;

  return (
    <div className="mx-auto max-w-[1100px] px-4 pb-16 pt-6 md:px-8 md:pt-10">
      <h1 className="masthead text-[17vw] text-kapow sm:text-[clamp(72px,8vw,112px)]">Built for Monad</h1>
      <p className="mt-3 max-w-[64ch] text-[15px] leading-relaxed text-soft">
        Every vote, trade, payment and launch on KOMA is a Monad transaction. Here is the chain doing its thing, live,
        and what KOMA does because it&rsquo;s Monad. Each part says where it runs.
      </p>

      <section className="mt-8" aria-labelledby="pipe-h">
        <h2 id="pipe-h" className="sr-only">Monad testnet block pipeline</h2>
        <MonadPipeline />
      </section>

      <section className="mt-10" aria-labelledby="facts-h">
        <h2 id="facts-h" className="font-display text-[22px] uppercase leading-none text-paper">
          Live from Monad testnet
        </h2>
        <p className="mt-1 text-[12.5px] text-mute">Read-only, from {MONAD.testnet.rpc}. Refreshes every 5 s.</p>
        <div className="mt-3">
          <MonadFacts initial={live} />
        </div>
      </section>

      <section className="mt-10" aria-labelledby="ours-h">
        <h2 id="ours-h" className="font-display text-[22px] uppercase leading-none text-paper">
          KOMA&rsquo;s own transactions
        </h2>
        <p className="mt-1 text-[12.5px] text-mute">
          {FORK
            ? "Measured on this local fork of Monad testnet (1 s blocks, instant finality), so these are fork timings, not Monad's. Monad's are the live numbers above."
            : "Measured on Monad from send to receipt (executed) and to the finalized tag (final)."}
        </p>
        <dl className="mt-3 grid grid-cols-2 gap-4 md:grid-cols-4">
          {[
            ["Transactions timed", ours.count.toLocaleString("en-US")],
            ["Median executed", ours.medianMs != null ? `${ours.medianMs} ms` : "—"],
            ["Median final", finalMedian != null ? `${finalMedian} ms` : "—"],
            ["Relayer balance", relayer != null ? `${(Number(relayer) / 1e18).toFixed(2)} MON` : "—"],
          ].map(([k, v]) => (
            <div key={k}>
              <dt className="text-[12px] text-mute">{k}</dt>
              <dd className="font-mono text-[22px] text-paper">{v}</dd>
            </div>
          ))}
        </dl>
        <ul className="mt-4 list-disc space-y-1.5 pl-5 text-[13px] leading-relaxed text-soft">
          <li>
            <span className="text-paper">Gas is billed on the limit.</span> Every relayed transaction gets an explicit limit (estimate + 30%, rounded), never a wallet&rsquo;s fallback guess.
          </li>
          <li>
            <span className="text-paper">The 10 MON reserve.</span> Consensus runs 3 blocks behind execution, so an account&rsquo;s in-flight gas must fit within min(10 MON, balance). KOMA&rsquo;s relayer tracks its
            in-flight fees and refuses a relay that wouldn&rsquo;t fit, instead of letting it be dropped.
          </li>
          <li>
            <span className="text-paper">Gasless by design.</span> Buys, sells, votes and payments are signatures; KOMA&rsquo;s relayer and facilitator pay the gas, so a new fan needs no MON at all.
          </li>
        </ul>
      </section>

      <section className="mt-10" aria-labelledby="canon-h">
        <h2 id="canon-h" className="font-display text-[22px] uppercase leading-none text-paper">
          Canonical contracts on this chain
        </h2>
        <p className="mt-1 text-[12.5px] text-mute">KOMA uses Monad&rsquo;s canonical deployments instead of its own copies. Checked live for code on {KOMA.label}.</p>
        <ul className="mt-3 divide-y divide-rule border-y border-rule">
          {live.canonical.map((c) => {
            const href = addressUrl(c.address);
            return (
              <li key={c.name} className="flex flex-wrap items-baseline justify-between gap-2 py-2 font-mono text-[12.5px]">
                <span className="text-paper">{c.name}</span>
                {href ? (
                  <a href={href} target="_blank" rel="noreferrer" className="text-arb hover:underline">
                    {c.address}
                  </a>
                ) : (
                  <span className="text-soft">{c.address}</span>
                )}
                <span className={c.present ? "text-[#5ad17a]" : "text-kapow"}>{c.present ? "code ✓" : "no code"}</span>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="mt-10" aria-labelledby="cov-h">
        <h2 id="cov-h" className="font-display text-[22px] uppercase leading-none text-paper">
          Monad-native coverage
        </h2>
        <table className="mt-3 w-full text-left text-[13px]">
          <thead className="text-[12px] text-mute">
            <tr>
              <th className="py-2 font-medium">What</th>
              <th className="py-2 font-medium">Status</th>
              <th className="hidden py-2 font-medium md:table-cell">Where</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-rule">
            {COVERAGE.map((c) => (
              <tr key={c.item}>
                <td className="py-2 pr-3 text-soft">{c.item}</td>
                <td className="py-2 pr-3 font-mono text-[11.5px] uppercase text-arb">{c.status}</td>
                <td className="hidden py-2 text-mute md:table-cell">{c.where}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-6 flex items-center gap-1.5 text-[12px] text-mute">
          <MonadMark width={12} height={12} /> More in the repo: <Link href="/how" className="underline decoration-rule underline-offset-2 hover:text-paper">how payment works</Link>
        </p>
      </section>
    </div>
  );
}
