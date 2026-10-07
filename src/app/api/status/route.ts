import { NextResponse } from "next/server";
import { config, publicClient } from "@/lib/server/config";
import { launchpad } from "@/lib/server/launchpad/addresses";
import { budgetStatus } from "@/lib/server/budget";
import { falHealth } from "@/lib/server/fal-health";
import { aiSummary } from "@/lib/server/providers";
import { inFlightFeesWei } from "@/lib/server/speed";

export const dynamic = "force-dynamic";

/** What the studio needs to know before quoting: is the server ready, and on which chain. */
export async function GET() {
  const lp = launchpad();
  const relayerEth = config.account ? await publicClient.getBalance({ address: config.account.address }).then((b) => Number(b) / 1e18).catch(() => null) : null;
  return NextResponse.json({
    ready: config.missing.length === 0,
    missing: config.missing,
    network: config.network.key,
    caip: config.network.caip,
    chainId: config.network.chain.id,
    usdc: config.network.usdc,
    faucet: config.network.faucet,
    publicUrl: config.publicUrl,
    payTo: config.payTo ?? null,
    contract: config.contract ?? null,
    facilitator: config.account?.address ?? null,
    relayerEth,
    // Monad reserve balance: in-flight max gas fees must fit within min(10 MON, balance).
    relayerReserve: relayerEth === null ? null : { reserveMon: 10, belowReserve: relayerEth < 10, inFlightMon: Number(inFlightFeesWei()) / 1e18 },
    budget: budgetStatus(),
    ai: { ...aiSummary(), ...(await falHealth()) },
    launchpad: lp ? { engine: lp.engine, addresses: lp } : null,
  });
}
