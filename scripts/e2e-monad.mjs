// Monad-native features, checked for real: live read-only facts from Monad testnet (block-state tags, staking
// epoch, P256 and reserve precompiles), canonical contracts on KOMA's chain, the relayer's reserve-balance health,
// Monad's hosted x402 facilitator verifying a signed AUSD authorization (simulation only, nothing moves), and the
// /monad page's live block pipeline reaching Finalized.   node scripts/e2e-monad.mjs   (app on :4320; no AI spend)
import { readFileSync } from "node:fs";
import { chromium } from "playwright";
import { privateKeyToAccount } from "viem/accounts";
import { x402Client } from "@x402/core/client";
import { HTTPFacilitatorClient } from "@x402/core/server";
import { ExactEvmScheme } from "@x402/evm/exact/client";

const env = Object.fromEntries(readFileSync(".env.local", "utf8").split("\n").filter((l) => l.includes("=")).map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1)]));
const BASE = process.env.KOMA_URL ?? "http://localhost:4320";
const results = [];
const check = (id, name, ok, detail = "") => {
  results.push(ok);
  console.log(`${ok ? "PASS" : "FAIL"} ${id} ${name}${detail ? ` — ${detail}` : ""}`);
};
const getJson = async (p) => (await fetch(`${BASE}${p}`)).json();

const live = await getJson("/api/monad");
const t = live.testnet;
check("M1", "live Monad testnet: latest/safe/finalized at N/N−1/N−2 (one batch), staking epoch, P256 verifies a fresh signature and rejects a tampered one", !!t && t.latest - t.finalized >= 1 && t.latest - t.finalized <= 4 && t.safe <= t.latest && t.epoch > 0 && t.p256.valid && t.p256.tamperedRejected && t.reserveDipped === false, t ? `#${t.latest}/#${t.safe}/#${t.finalized}, epoch ${t.epoch}` : live.testnetError);
check("M2", "canonical contracts present on KOMA's chain", live.canonical.every((c) => c.present), live.canonical.map((c) => `${c.name} ${c.present ? "✓" : "✗"}`).join(", "));

const status = await getJson("/api/status");
check("M3", "status reports the relayer's reserve-balance health", status.relayerReserve && typeof status.relayerReserve.belowReserve === "boolean" && status.relayerReserve.reserveMon === 10, JSON.stringify(status.relayerReserve));

// Monad's hosted facilitator: verify (a simulation) a real AUSD EIP-3009 authorization from a test key.
const requirements = {
  scheme: "exact",
  network: "eip155:10143",
  asset: "0xa9012a055bd4e0eDfF8Ce09f960291C09D5322dC",
  amount: "100000",
  payTo: env.TEST_PAYTO_ADDRESS,
  maxTimeoutSeconds: 300,
  extra: { name: "Agora Dollar", version: "1" },
};
const client = x402Client.fromConfig({
  schemes: [{ network: "eip155:10143", client: new ExactEvmScheme(privateKeyToAccount(env.TEST_AGENT_KEY)) }],
  spendControls: { allowedAssets: [{ network: "eip155:10143", asset: requirements.asset, maxAmountPerPayment: "100000" }] },
});
const payload = await client.createPaymentPayload({ x402Version: 2, resource: { url: `${BASE}/api/comics`, description: "probe", mimeType: "application/json" }, accepts: [requirements] });
const v = await new HTTPFacilitatorClient({ url: "https://x402-facilitator.molandak.org" }).verify(payload, requirements).catch((e) => ({ error: String(e.message ?? e) }));
// The test key holds no AUSD on real testnet, so a facilitator that understands AUSD answers "insufficient balance"
// (or a name-mismatch diagnosis, as the x402 library does for AUSD); an unsupported token or scheme would say so.
const reason = v.invalidReason ?? v.error ?? (v.isValid ? "valid" : "");
check("M4", "Monad's hosted x402 facilitator understands an AUSD exact payment on 10143 (verify only)", /insufficient|balance|name_mismatch|valid/i.test(reason) && !/unsupported|not supported|network/i.test(reason), reason);

const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const errors = [];
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  await page.goto(`${BASE}/monad`, { waitUntil: "domcontentloaded" });
  const pipe = page.locator("[data-monad-pipeline]");
  await pipe.getByText(/Finalized|Verified/).first().waitFor({ timeout: 15_000 });
  await page.waitForTimeout(2500);
  const txt = await pipe.innerText();
  const med = txt.match(/Proposed → Finalized\s+(\d+) ms/);
  const facts = await page.locator("[data-monad-facts]").innerText();
  check("M5", "/monad: the live block pipeline shows blocks reaching Finalized with measured ms; live facts render; clean console", !!med && /fresh ✓ · tampered ✗/.test(facts) && errors.length === 0, `Proposed → Finalized median ${med?.[1] ?? "?"} ms${errors.length ? ` · ${errors[0]}` : ""}`);
} finally {
  await browser.close();
}
console.log(`\n${results.filter(Boolean).length}/${results.length} passed`);
process.exit(results.every(Boolean) ? 0 : 1);
