import { NextResponse } from "next/server";
import { monadLive } from "@/lib/server/monad-live";

export const dynamic = "force-dynamic";

/** Live read-only Monad testnet facts (block-state tags, staking epoch, P256 and reserve precompiles) + canonical contracts on KOMA's chain. */
export async function GET() {
  return NextResponse.json(await monadLive(), { headers: { "Cache-Control": "no-store" } });
}
