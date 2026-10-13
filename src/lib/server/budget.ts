import { db } from "./store";

// Daily fal spend guard. Every fal call records what it (probably) cost in its
// own SQLite table; routes can ask `assertBudget(estimate)` before starting work.
//
// Prices, from the fal model pages (checked 2026-09-30):
// - fal-ai/flux-2 (FLUX.2 [dev] text-to-image): $0.012 per megapixel of output.
// - fal-ai/flux-2/edit (FLUX.2 [dev] edit): $0.012 per megapixel of input AND
//   output; every input image is resized to 1 MP first, so each reference costs
//   $0.012 on top of the output. fal's own example: 1024x1024 out + one input = $0.024.
// - fal-ai/flux/dev (old panel model, for comparison): $0.025 per megapixel.
// - openrouter/router: billed per token at the OpenRouter price of the model;
//   the response carries `usage.cost`, which we record when present.
//   anthropic/claude-sonnet-4.5 on OpenRouter: $3 / M input, $15 / M output.
// fal counts 1024x1024 as 1 MP; we round megapixels UP so estimates never undershoot.

const MP_USD = 0.012;
const LLM_IN_PER_TOKEN = 3 / 1_000_000;
const LLM_OUT_PER_TOKEN = 15 / 1_000_000;

export type SpendKind = "llm" | "sheet" | "panel" | "panel-ref";

/** Megapixels as fal bills them (1024x1024 = 1), rounded up. */
export const megapixels = (w: number, h: number) => Math.max(1, Math.ceil((w * h) / (1024 * 1024)));

/** fal's price for fal-ai/hunyuan-image/v3/text-to-image (api.fal.ai/v1/models/pricing). */
const HUNYUAN_MP_USD = 0.1;

export const estimate = {
  /**
   * One LLM call. Script: ~1.5k prompt tokens, ~1.1k output tokens per page
   * (measured ~$0.02 for a 1-page script). Chat turn: ~1.5k in + transcript, ~350 out.
   */
  llm(kind: "script" | "chat", pages = 1) {
    const [inTok, outTok] = kind === "script" ? [1_600, 300 + 1_100 * pages] : [2_000, 400];
    return round(inTok * LLM_IN_PER_TOKEN + outTok * LLM_OUT_PER_TOKEN);
  },
  /** FLUX.2 character turnaround sheet (1024x576 → 1 MP → $0.012). */
  sheet(width = 1024, height = 576) {
    return round(megapixels(width, height) * MP_USD);
  },
  /** One panel: FLUX.2 t2i without refs; FLUX.2 edit adds 1 MP per reference image. */
  panel(width = 1024, height = 1024, refs = 0) {
    return round((megapixels(width, height) + Math.min(refs, 4)) * MP_USD);
  },
  /** Tencent HunyuanImage 3.0 on fal (sheets and covers when HUNYUAN_IMAGE=1): $0.10 per megapixel. */
  hunyuan(width: number, height: number) {
    return round(megapixels(width, height) * HUNYUAN_MP_USD);
  },
  /** A whole comic: script + cover + 4 panels per page (+ optional sheets, refs per panel). */
  comic(pages: number, o: { sheets?: number; refs?: number } = {}) {
    const panels = pages * 4 + 1;
    return round(this.llm("script", pages) + (o.sheets ?? 0) * this.sheet() + panels * this.panel(1024, 1024, o.refs ?? 0));
  },
};

export class BudgetExceededError extends Error {
  readonly spentUsd: number;
  readonly capUsd: number;
  readonly estimatedUsd: number;
  readonly day: string;
  constructor(s: { spentUsd: number; capUsd: number; day: string }, estimatedUsd: number) {
    super(`Today's AI budget is used up ($${s.spentUsd.toFixed(2)} of $${s.capUsd.toFixed(2)}). Try again after 00:00 UTC.`);
    this.name = "BudgetExceededError";
    this.spentUsd = s.spentUsd;
    this.capUsd = s.capUsd;
    this.estimatedUsd = estimatedUsd;
    this.day = s.day;
  }
}

const round = (usd: number) => Math.round(usd * 1e6) / 1e6;
const today = () => new Date().toISOString().slice(0, 10);
const capUsd = () => {
  const raw = process.env.KOMA_FAL_DAILY_USD;
  const n = raw ? Number(raw) : NaN;
  return Number.isFinite(n) && n >= 0 ? n : 15;
};

const g = globalThis as unknown as { __komaBudgetTable?: boolean };
function table() {
  const conn = db();
  if (!g.__komaBudgetTable) {
    conn.exec(`
      CREATE TABLE IF NOT EXISTS fal_spend (
        id INTEGER PRIMARY KEY,
        day TEXT NOT NULL,
        at INTEGER NOT NULL,
        kind TEXT NOT NULL,
        usd REAL NOT NULL
      );
      CREATE INDEX IF NOT EXISTS fal_spend_day ON fal_spend (day);
    `);
    g.__komaBudgetTable = true;
  }
  return conn;
}

/** Spend so far today (UTC), the cap, and the day key. */
export function budgetStatus() {
  const day = today();
  const row = table().prepare("SELECT coalesce(sum(usd), 0) AS usd FROM fal_spend WHERE day = ?").get(day) as { usd: number };
  return { spentUsd: round(row.usd), capUsd: capUsd(), day };
}

/** Throws BudgetExceededError if spending `estimatedUsd` more today would pass KOMA_FAL_DAILY_USD. */
export function assertBudget(estimatedUsd: number) {
  const s = budgetStatus();
  if (s.spentUsd + estimatedUsd > s.capUsd) throw new BudgetExceededError(s, estimatedUsd);
  return s;
}

/** Log one fal call's cost. Never throws: bookkeeping must not break a paid job. */
export function recordSpend(kind: SpendKind, usd: number) {
  if (!(usd > 0)) return;
  try {
    table().prepare("INSERT INTO fal_spend (day, at, kind, usd) VALUES (?, ?, ?, ?)").run(today(), Date.now(), kind, round(usd));
  } catch (e) {
    console.error("[koma] could not record fal spend", e);
  }
}

// ——— Daily capacity: counts on top of the USD cap ———
// Public endpoints are paid in free testnet AUSD, so a stranger could otherwise spend the real Moonshot credit and
// fal balance behind them. Each kind has a persisted per-day (UTC) count; over it, routes refuse *before* taking any
// payment. Env overrides (e.g. for a demo recording): KOMA_DAILY_ISSUES, KOMA_DAILY_LAUNCHES, KOMA_DAILY_LLM_CALLS.
export type CapacityKind = "issue" | "launch" | "llm";
const CAP_ENV: Record<CapacityKind, [string, number]> = { issue: ["KOMA_DAILY_ISSUES", 20], launch: ["KOMA_DAILY_LAUNCHES", 10], llm: ["KOMA_DAILY_LLM_CALLS", 150] };
const capOf = (k: CapacityKind) => {
  const [name, def] = CAP_ENV[k];
  const n = Number(process.env[name]);
  return process.env[name] && Number.isFinite(n) && n >= 0 ? n : def;
};

export class CapacityError extends Error {
  constructor(readonly kind: CapacityKind, readonly cap: number) {
    super(
      kind === "llm"
        ? "KOMA's writers have reached today's capacity. Try again after 00:00 UTC."
        : `Daily capacity reached: KOMA makes ${cap} ${kind === "issue" ? "issues" : "launches"} a day on this testnet, and today's are done. Nothing was charged. Try again after 00:00 UTC.`,
    );
    this.name = "CapacityError";
  }
}

function countTable() {
  const conn = db();
  conn.exec("CREATE TABLE IF NOT EXISTS daily_count (day TEXT NOT NULL, kind TEXT NOT NULL, n INTEGER NOT NULL, PRIMARY KEY (day, kind))");
  return conn;
}
export function usedToday(k: CapacityKind): number {
  return (countTable().prepare("SELECT n FROM daily_count WHERE day = ? AND kind = ?").get(today(), k) as { n: number } | undefined)?.n ?? 0;
}
/** Throws CapacityError when today's count for `k` is at its cap. Call before quoting or charging. */
export function assertCapacity(k: CapacityKind) {
  const cap = capOf(k);
  if (usedToday(k) >= cap) throw new CapacityError(k, cap);
}
/** Counts one use (after payment is accepted, or after a paid model call). Never throws. */
export function countUse(k: CapacityKind) {
  try {
    countTable().prepare("INSERT INTO daily_count (day, kind, n) VALUES (?, ?, 1) ON CONFLICT(day, kind) DO UPDATE SET n = n + 1").run(today(), k);
  } catch (e) {
    console.error("[koma] could not count", k, e);
  }
}
export const capacityStatus = () => Object.fromEntries((Object.keys(CAP_ENV) as CapacityKind[]).map((k) => [k, { used: usedToday(k), cap: capOf(k) }]));
