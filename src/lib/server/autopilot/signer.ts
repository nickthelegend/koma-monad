import { PrivyClient } from "@privy-io/node";
import { privateKeyToAccount } from "viem/accounts";
import type { Addr } from "@/lib/launchpad/types";
import { evaluate, privyPolicy, type AutopilotPolicy, type TypedPayload } from "./policy";

/**
 * Who signs for a backer while they're away.
 *
 *   privy    — a Privy session signer on the backer's embedded wallet. KOMA holds an authorization key
 *              (PRIVY_AUTHORIZATION_KEY) for a key quorum (PRIVY_SIGNER_ID) the backer added with a policy;
 *              Privy signs inside its enclave only if the policy allows it.
 *   fixture  — MOCK, local tests only: KOMA_AUTOPILOT_FIXTURE_KEYS maps test addresses to their keys, and the
 *              same policy is enforced in code. Never enabled when Privy is configured.
 *   off      — neither is configured; the autopilot panel explains what's missing.
 */
export type SignerMode = "privy" | "fixture" | "off";

const env = (k: string) => (process.env[k] ?? "").trim();

export function signerMode(): SignerMode {
  if (env("PRIVY_APP_ID") && env("PRIVY_APP_SECRET") && env("PRIVY_AUTHORIZATION_KEY") && env("PRIVY_SIGNER_ID")) return "privy";
  if (env("KOMA_AUTOPILOT_FIXTURE_KEYS")) return "fixture";
  return "off";
}

let client: PrivyClient | null = null;
function privy() {
  client ??= new PrivyClient({ appId: env("PRIVY_APP_ID"), appSecret: env("PRIVY_APP_SECRET") });
  return client;
}

function fixtureKey(address: Addr): `0x${string}` | null {
  try {
    const keys = JSON.parse(env("KOMA_AUTOPILOT_FIXTURE_KEYS")) as Record<string, `0x${string}`>;
    const hit = Object.entries(keys).find(([a]) => a.toLowerCase() === address.toLowerCase());
    return hit?.[1] ?? null;
  } catch {
    return null;
  }
}

/** The signer id the backer's wallet must add (with the policy) so KOMA can sign. */
export const signerId = () => (signerMode() === "privy" ? env("PRIVY_SIGNER_ID") : "fixture-signer");

/** Creates the policy for an enrollment. Privy stores it; the fixture mode just names it. */
export async function createPolicy(p: AutopilotPolicy, name: string): Promise<string> {
  if (signerMode() === "privy") {
    const created = await privy().policies().create(privyPolicy(p, name) as never);
    return (created as { id: string }).id;
  }
  return `fixture-policy:${name}`;
}

/** Checks a claimed Privy wallet id really is this address's embedded wallet. */
export async function walletMatches(walletId: string, address: Addr): Promise<boolean> {
  if (signerMode() !== "privy") return Boolean(fixtureKey(address));
  const w = (await privy().wallets().get(walletId)) as { address?: string };
  return w.address?.toLowerCase() === address.toLowerCase();
}

const json = (v: unknown): unknown =>
  typeof v === "bigint" ? v.toString() : Array.isArray(v) ? v.map(json) : v && typeof v === "object" ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, json(x)])) : v;

/**
 * Signs one EIP-712 payload for a backer. The local policy check always runs first; in Privy mode the
 * policy attached to the session signer is enforced again by Privy.
 */
export async function signFor(
  who: { address: Addr; walletId: string | null; policy: AutopilotPolicy },
  t: TypedPayload & { types: Record<string, { name: string; type: string }[]> },
): Promise<`0x${string}`> {
  const verdict = evaluate(who.policy, t);
  if (!verdict.ok) throw new Error(`autopilot policy refused: ${verdict.reason}`);
  const mode = signerMode();
  if (mode === "privy") {
    if (!who.walletId) throw new Error("no Privy wallet id on this enrollment");
    const r = await privy()
      .wallets()
      .ethereum()
      .signTypedData(who.walletId, {
        params: { typed_data: { domain: json(t.domain) as never, types: t.types as never, primary_type: t.primaryType, message: json(t.message) as never } },
        authorization_context: { authorization_private_keys: [env("PRIVY_AUTHORIZATION_KEY")] },
      } as never);
    return (r as { signature: `0x${string}` }).signature;
  }
  if (mode === "fixture") {
    const key = fixtureKey(who.address);
    if (!key) throw new Error("no fixture key for this address");
    const acct = privateKeyToAccount(key);
    return acct.signTypedData({ domain: t.domain as never, types: t.types, primaryType: t.primaryType, message: t.message } as never);
  }
  throw new Error("autopilot signer isn't configured");
}
