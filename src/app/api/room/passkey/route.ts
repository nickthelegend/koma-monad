import { NextResponse, type NextRequest } from "next/server";
import { clientIp } from "@/lib/server/client-ip";
import { limited } from "@/lib/server/rate-limit";
import { checkSignature, type Signed } from "@/lib/server/room";
import { issueChallenge, registerPasskey, verifyUnlock, type Assertion } from "@/lib/server/passkey";

export const dynamic = "force-dynamic";

/**
 * The Writers' Room passkey, verified on chain by Monad's P256VERIFY precompile (0x0100).
 *   GET                                        → { challenge }  (one-time, 2 min)
 *   PUT  { room, ts, sig, credentialId, x, y } → register the room's passkey public key (signed by the room key)
 *   POST { room, challenge, assertion }        → { local, testnet }: the unlock's signature checked via eth_call
 */
const bad = (error: string, status = 400) => NextResponse.json({ error }, { status });

export async function GET(req: NextRequest) {
  if (limited(`pk:${clientIp(req)}`, 60_000, 30)) return bad("Too many requests.", 429);
  return NextResponse.json({ challenge: issueChallenge() }, { headers: { "Cache-Control": "no-store" } });
}

export async function PUT(req: NextRequest) {
  if (limited(`pk:${clientIp(req)}`, 60_000, 30)) return bad("Too many requests.", 429);
  const b = (await req.json().catch(() => null)) as (Signed & { credentialId: string; x: string; y: string }) | null;
  if (!b || typeof b.credentialId !== "string" || typeof b.x !== "string" || typeof b.y !== "string") return bad("Send { room, ts, sig, credentialId, x, y }.");
  const why = checkSignature("passkey", b, `${b.credentialId}:${b.x.toLowerCase()}:${b.y.toLowerCase()}`);
  if (why) return bad(why, 401);
  const err = registerPasskey(b.room, b.credentialId, b.x, b.y);
  return err ? bad(err) : NextResponse.json({ ok: true });
}

export async function POST(req: NextRequest) {
  if (limited(`pk:${clientIp(req)}`, 60_000, 30)) return bad("Too many requests.", 429);
  const b = (await req.json().catch(() => null)) as { room?: string; challenge?: string; assertion?: Assertion } | null;
  if (!b?.room || !b.challenge || !b.assertion) return bad("Send { room, challenge, assertion }.");
  const r = await verifyUnlock(b.room, b.challenge, b.assertion, req.nextUrl.origin);
  return r.ok ? NextResponse.json({ local: r.local, testnet: r.testnet }) : bad(r.error, 422);
}
