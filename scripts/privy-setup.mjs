// Privy setup for the backer autopilot, against the app in .env.local (PRIVY_APP_ID / PRIVY_APP_SECRET):
// creates a P-256 authorization key and a 1-of-1 key quorum holding it (the session signer backers add with a
// policy), then writes PRIVY_AUTHORIZATION_KEY and PRIVY_SIGNER_ID to .env.local (gitignored, mode 600).
// Idempotent: an existing PRIVY_SIGNER_ID that Privy still knows is kept. Prints no secret.
//   node scripts/privy-setup.mjs
import { chmodSync, readFileSync, writeFileSync } from "node:fs";
import { PrivyClient, generateP256KeyPair } from "@privy-io/node";

const FILE = ".env.local";
const text = readFileSync(FILE, "utf8");
const env = Object.fromEntries(text.split("\n").filter((l) => l.includes("=")).map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).trim()]));
if (!env.PRIVY_APP_ID || !env.PRIVY_APP_SECRET) throw new Error("PRIVY_APP_ID / PRIVY_APP_SECRET missing from .env.local");
const privy = new PrivyClient({ appId: env.PRIVY_APP_ID, appSecret: env.PRIVY_APP_SECRET });

if (env.PRIVY_SIGNER_ID && env.PRIVY_AUTHORIZATION_KEY) {
  const q = await privy.keyQuorums().get(env.PRIVY_SIGNER_ID).catch(() => null);
  if (q) {
    console.log("Privy signer already set up (key quorum found); nothing to do.");
    process.exit(0);
  }
}
const kp = await generateP256KeyPair();
const quorum = await privy.keyQuorums().create({ public_keys: [kp.publicKey], authorization_threshold: 1, display_name: "KOMA autopilot" });
const set = (s, k, v) => (new RegExp(`^${k}=.*$`, "m").test(s) ? s.replace(new RegExp(`^${k}=.*$`, "m"), `${k}=${v}`) : `${s.replace(/\n?$/, "\n")}${k}=${v}\n`);
let out = set(text, "PRIVY_AUTHORIZATION_KEY", kp.privateKey);
out = set(out, "PRIVY_SIGNER_ID", quorum.id);
writeFileSync(FILE, out);
chmodSync(FILE, 0o600);
console.log("Privy signer set up: key quorum created, PRIVY_AUTHORIZATION_KEY and PRIVY_SIGNER_ID written to .env.local.");
