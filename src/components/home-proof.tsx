import Link from "next/link";
import type { Board } from "@/lib/server/launchpad/board";
import { usdAmount } from "@/lib/format";
import { MonadMark } from "./icons";

/** Who does what, each linked to the place a visitor can see it working. */
const MADE_BY = [
  { who: "Tencent Hunyuan 3", does: "edits your idea into a pitch", href: "/create" },
  { who: "Kimi K2.6", does: "writes each episode after reading the canon", href: "/series" },
  { who: "Hunyuan Image 3", does: "draws every character sheet and cover", href: "/launch" },
  { who: "Chainlink CRE", does: "re-checks every vote and settles the canon", href: "/series" },
  { who: "Envio", does: "indexes the board and leaderboard", href: "/series" },
  { who: "Privy", does: "lets backers put votes and buys on autopilot", href: "/series" },
  { who: "Mera passkeys", does: "keep unpublished twists encrypted", href: "/room" },
  { who: "Monad", does: "300 ms blocks; watch them live", href: "/monad" },
];

/** The first-60-seconds proof under the hero: live numbers from the board, then who makes what. */
export function HomeProof({ board, medianMs, fork }: { board: Board | null; medianMs: number | null; fork: boolean }) {
  const stats = board
    ? [
        ["Series", board.stats.series.toLocaleString("en-US")],
        ["Backers", board.stats.backers.toLocaleString("en-US")],
        ["Trades", board.stats.trades.toLocaleString("en-US")],
        ["Canon episodes", board.stats.canonEpisodes.toLocaleString("en-US")],
        ["Volume", usdAmount(board.stats.volumeUsd)],
        ...(medianMs != null ? [[fork ? "Median confirmation (fork)" : "Median confirmation", `${medianMs} ms`]] : []),
      ]
    : [];
  return (
    <section aria-label="KOMA right now" className="mx-auto max-w-[1320px] px-4 pt-6 md:px-8">
      {stats.length > 0 && (
        <dl data-home-stats className="grid grid-cols-3 gap-x-4 gap-y-3 border-y border-rule py-4 md:grid-cols-6">
          {stats.map(([k, v]) => (
            <div key={k}>
              <dt className="text-[11.5px] text-mute">{k}</dt>
              <dd className="font-mono text-[20px] text-paper md:text-[24px]">{v}</dd>
            </div>
          ))}
        </dl>
      )}
      <div className="mt-5">
        <p className="flex items-center gap-1.5 font-display text-[15px] uppercase text-soft">
          <MonadMark width={14} height={14} /> How an episode gets made
        </p>
        <ul data-made-by className="mt-2 grid gap-x-6 gap-y-1.5 text-[13px] sm:grid-cols-2 lg:grid-cols-4">
          {MADE_BY.map((m) => (
            <li key={m.who}>
              <Link href={m.href} className="group block">
                <span className="text-paper group-hover:text-kapow">{m.who}</span> <span className="text-mute">{m.does}</span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
