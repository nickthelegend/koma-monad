import { randomBytes } from "node:crypto";
import { p256 } from "@noble/curves/p256";
import { bytesToHex, concatBytes, isHex, sha256, type Hex } from "viem";
import { MONAD } from "@/lib/monad";
import { config, publicClient } from "./config";
import { db } from "./store";

/**
 * Writers' Room passkeys verified on chain. The room's passkey public key (P256, from the WebAuthn attestation) is
 * registered once, signed by the room key. Each unlock's assertion, over a one-time challenge from here, is checked
 * (challenge, origin, user verification), then its signature is verified by Monad's P256VERIFY precompile
 * (0x0100, EIP-7951) with eth_call: on KOMA's own chain and, read-only, on Monad testnet itself.
 */
let ready = false;
function table() {
  const d = db();
  if (!ready) {
    d.exec("CREATE TABLE IF NOT EXISTS room_passkeys (room TEXT PRIMARY KEY, credential_id TEXT NOT NULL, x TEXT NOT NULL, y TEXT NOT NULL, created_at INTEGER NOT NULL)");
    ready = true;
  }
  return d;
}

const challenges = new Map<string, number>();
const b64url = (b: Uint8Array) => Buffer.from(b).toString("base64url");
const unb64 = (s: string) => new Uint8Array(Buffer.from(s, "base64url"));

/** A one-time challenge, good for 2 minutes. */
export function issueChallenge() {
  const now = Date.now();
  for (const [c, exp] of challenges) if (exp < now) challenges.delete(c);
  if (challenges.size > 5000) throw new Error("too many open challenges");
  const c = b64url(randomBytes(32));
  challenges.set(c, now + 120_000);
  return c;
}

export function registerPasskey(room: string, credentialId: string, x: string, y: string): string | null {
  if (!isHex(x) || x.length !== 66 || !isHex(y) || y.length !== 66) return "x and y must be 32-byte hex";
  if (!/^[A-Za-z0-9_-]{16,400}$/.test(credentialId)) return "bad credential id";
  // The point must be on P256, or no signature could ever verify.
  try {
    p256.ProjectivePoint.fromHex(`04${x.slice(2)}${y.slice(2)}`).assertValidity();
  } catch {
    return "not a P256 public key";
  }
  table()
    .prepare("INSERT INTO room_passkeys (room, credential_id, x, y, created_at) VALUES (?, ?, ?, ?, ?) ON CONFLICT(room) DO NOTHING")
    .run(room.toLowerCase(), credentialId, x.toLowerCase(), y.toLowerCase(), Math.floor(Date.now() / 1000));
  return null;
}

export const passkeyOf = (room: string) =>
  table().prepare("SELECT credential_id, x, y FROM room_passkeys WHERE room = ?").get(room.toLowerCase()) as { credential_id: string; x: string; y: string } | undefined;

export type Assertion = { credentialId: string; authenticatorData: string; clientDataJSON: string; signature: string };
export type PasskeyCheck = { ok: true; input: Hex; local: boolean; testnet: boolean | null } | { ok: false; error: string };

/** EIP-7951 input: sha256(authenticatorData ‖ sha256(clientDataJSON)) ‖ r ‖ s ‖ qx ‖ qy. */
export function p256Input(a: Assertion, x: string, y: string): Hex {
  const authData = unb64(a.authenticatorData);
  const clientHash = sha256(unb64(a.clientDataJSON), "bytes");
  const digest = sha256(concatBytes([authData, clientHash]), "bytes");
  const sig = p256.Signature.fromDER(unb64(a.signature));
  const word = (n: bigint) => n.toString(16).padStart(64, "0");
  return `${bytesToHex(digest)}${word(sig.r)}${word(sig.s)}${x.slice(2)}${y.slice(2)}` as Hex;
}

const isOne = (r: string | undefined) => typeof r === "string" && /^0x0*1$/.test(r);

export async function verifyUnlock(room: string, challenge: string, a: Assertion, origin: string): Promise<PasskeyCheck> {
  const key = passkeyOf(room);
  if (!key) return { ok: false, error: "This room has no passkey registered for on-chain checks." };
  if (key.credential_id !== a.credentialId) return { ok: false, error: "That passkey isn't this room's." };
  const exp = challenges.get(challenge);
  challenges.delete(challenge);
  if (!exp || exp < Date.now()) return { ok: false, error: "Challenge expired or already used." };
  let client: { type?: string; challenge?: string; origin?: string };
  try {
    client = JSON.parse(Buffer.from(unb64(a.clientDataJSON)).toString("utf8"));
  } catch {
    return { ok: false, error: "Malformed clientDataJSON." };
  }
  if (client.type !== "webauthn.get" || client.challenge !== challenge) return { ok: false, error: "Assertion isn't for this challenge." };
  if (client.origin !== origin) return { ok: false, error: "Assertion is from another origin." };
  const flags = unb64(a.authenticatorData)[32] ?? 0;
  if ((flags & 0x04) === 0) return { ok: false, error: "The passkey didn't verify the user." };

  let input: Hex;
  try {
    input = p256Input(a, key.x, key.y);
  } catch {
    return { ok: false, error: "Malformed signature." };
  }
  const local = await publicClient
    .call({ to: MONAD.precompiles.p256, data: input })
    .then((r) => isOne(r.data))
    .catch(() => false);
  // The same check on Monad testnet itself (read-only eth_call), when KOMA isn't already running there.
  const testnet =
    config.network.chain.id === MONAD.testnet.chainId && !/127\.0\.0\.1|localhost/.test(config.rpcUrl)
      ? local
      : await fetch(MONAD.testnet.rpc, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "eth_call", params: [{ to: MONAD.precompiles.p256, data: input }, "latest"] }),
          signal: AbortSignal.timeout(5000),
        })
          .then((r) => r.json() as Promise<{ result?: string }>)
          .then((j) => isOne(j.result))
          .catch(() => null);
  return { ok: true, input, local, testnet };
}
