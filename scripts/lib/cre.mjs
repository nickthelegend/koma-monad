// Chainlink CRE canon settlement in local e2e runs. With KOMA_CANON_FINALIZER=cre the app's keeper leaves due
// canon slots to the CRE workflow (cre/koma-canon); locally that's `fork-settle.ts`, the workflow's rules
// delivered through Monad testnet's MockKeystoneForwarder (no `cre login` needed). Local anvil fork only.
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const WORKFLOW = fileURLToPath(new URL("../../cre/koma-canon/", import.meta.url));
const BUN = process.env.BUN ?? `${process.env.HOME}/.bun/bin/bun`;

/** Whether the app leaves canon settlement to CRE (`/api/canon/due` → creSettles). */
export async function creSettles(base) {
  const due = await fetch(`${base}/api/canon/due`).then((r) => r.json()).catch(() => null);
  return Boolean(due?.creSettles);
}

/**
 * One koma-canon run. `key` pays the forwarder transaction (any funded fork account: the report, not the sender,
 * is what counts). Returns the harness's JSON summary { tx, delivered, settled: [{seriesId, episode, winner, votesRoot}], batch }.
 */
export function settleViaCre(key, rpc = "http://127.0.0.1:18643") {
  const out = execFileSync(BUN, ["fork-settle.ts", "config.local-fork.json"], {
    cwd: WORKFLOW,
    env: { ...process.env, FORK_PRIVATE_KEY: key, FORK_RPC: rpc },
    encoding: "utf8",
  });
  const last = out.trim().split("\n").at(-1);
  return JSON.parse(last);
}
