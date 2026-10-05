import { readFile } from "node:fs/promises";
import path from "node:path";

/**
 * Which model does what. Every role has a real provider behind an env var and a labelled mock,
 * so the whole studio runs (and is tested) with no keys at all:
 *
 *   script  — the comic's writer.        Kimi (MOONSHOT_API_KEY) → Hunyuan → fal → mock
 *   editor  — the chat that pitches.     Hunyuan (HUNYUAN_API_KEY) → Kimi → fal → mock
 *   image   — sheets, covers, panels.    fal: Hunyuan Image 3 for sheets/covers when HUNYUAN_IMAGE=1,
 *                                        FLUX.2 (+ edit for on-model panels) otherwise → mock
 *
 * KOMA_AI_MODE=mock forces mock everywhere (tests, demos without keys).
 */
export type TextProvider = "kimi" | "hunyuan" | "fal" | "mock";
export type ImageProvider = "fal" | "mock";
export type TextRole = "script" | "editor";

const env = (k: string) => (process.env[k] ?? "").trim();
export const forcedMock = () => env("KOMA_AI_MODE") === "mock";

export const KIMI = {
  base: env("MOONSHOT_BASE_URL") || "https://api.moonshot.ai/v1",
  model: () => env("KIMI_MODEL") || "kimi-k2.6",
  key: () => env("MOONSHOT_API_KEY"),
};
export const HUNYUAN = {
  base: env("HUNYUAN_BASE_URL") || "https://tokenhub-intl.tencentcloudmaas.com/v1",
  model: () => env("HUNYUAN_MODEL") || "hy3",
  key: () => env("HUNYUAN_API_KEY"),
};

export function textProvider(role: TextRole): TextProvider {
  if (forcedMock()) return "mock";
  const order: TextProvider[] = role === "script" ? ["kimi", "hunyuan", "fal"] : ["hunyuan", "kimi", "fal"];
  for (const p of order) {
    if (p === "kimi" && KIMI.key()) return p;
    if (p === "hunyuan" && HUNYUAN.key()) return p;
    if (p === "fal" && env("FAL_KEY")) return p;
  }
  return "mock";
}

export function imageProvider(): ImageProvider {
  return !forcedMock() && env("FAL_KEY") ? "fal" : "mock";
}

/** Hunyuan Image 3 (on fal) draws character sheets and covers when HUNYUAN_IMAGE=1. */
export const hunyuanImage = () => imageProvider() === "fal" && env("HUNYUAN_IMAGE") === "1";

export function aiSummary() {
  const script = textProvider("script");
  const editor = textProvider("editor");
  const image = imageProvider();
  const mock = script === "mock" || editor === "mock" || image === "mock";
  return { mode: mock ? ("mock" as const) : ("live" as const), script, editor, image, hunyuanImage: hunyuanImage() };
}

// ——— OpenAI-compatible chat (Kimi, Hunyuan TokenHub) ———
export type ChatMsg =
  | { role: "system" | "user"; content: string }
  | { role: "assistant"; content: string | null; tool_calls?: ToolCall[]; reasoning_content?: string }
  | { role: "tool"; tool_call_id: string; content: string };
export type ToolCall = { id: string; type: "function"; function: { name: string; arguments: string } };
export type Tool = { type: "function"; function: { name: string; description: string; parameters: Record<string, unknown> } };

type ChatResponse = {
  choices: { message: { content: string | null; tool_calls?: ToolCall[]; reasoning_content?: string }; finish_reason: string }[];
  usage?: { prompt_tokens?: number; completion_tokens?: number };
};

export async function openaiChat(
  provider: "kimi" | "hunyuan",
  o: { messages: ChatMsg[]; maxTokens?: number; json?: boolean; tools?: Tool[]; timeoutMs?: number },
): Promise<ChatResponse["choices"][number]["message"] & { usage?: ChatResponse["usage"] }> {
  const p = provider === "kimi" ? KIMI : HUNYUAN;
  const res = await fetch(`${p.base}/chat/completions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${p.key()}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: p.model(),
      messages: o.messages,
      max_tokens: o.maxTokens ?? 2_000,
      temperature: 0.8,
      ...(o.json ? { response_format: { type: "json_object" } } : {}),
      ...(o.tools ? { tools: o.tools, tool_choice: "auto" } : {}),
    }),
    signal: AbortSignal.timeout(o.timeoutMs ?? 120_000),
  });
  if (!res.ok) throw new Error(`${provider} ${res.status}: ${(await res.text()).slice(0, 240)}`);
  const body = (await res.json()) as ChatResponse;
  const msg = body.choices?.[0]?.message;
  if (!msg) throw new Error(`${provider} returned no message`);
  return { ...msg, usage: body.usage };
}

// ——— Mock art: committed fixture images, labelled MOCK ART on the image itself ———
const MOCK_DIR = path.join(process.cwd(), "public", "mock");
export async function mockImage(kind: "sheet" | "cover" | "panel", seed: number): Promise<Uint8Array> {
  const file = kind === "panel" ? `panel-${(seed % 6) + 1}.jpg` : `${kind}.jpg`;
  return new Uint8Array(await readFile(path.join(MOCK_DIR, file)));
}
