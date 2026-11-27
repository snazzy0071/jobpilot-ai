import "server-only";
import { DEFAULT_TIMEOUT_MS } from "@/lib/ai/config";

/**
 * Fallback AI provider for testing: Groq's OpenAI-compatible API running
 * open-source Llama models. Used only when ANTHROPIC_API_KEY isn't set and
 * GROQ_API_KEY is (see getAIProvider in service.ts), so every AI feature can
 * be exercised before a Claude key exists. Plain fetch — no extra SDK.
 */

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
export const GROQ_DEFAULT_MODEL = process.env.GROQ_MODEL || "llama-3.3-70b-versatile";

export function getGroqApiKey(): string | null {
  const key = process.env.GROQ_API_KEY?.trim();
  return key ? key : null;
}

/** An HTTP error from Groq, carrying the status so service.ts can classify it like an Anthropic APIError. */
export class GroqHTTPError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = "GroqHTTPError";
  }
}

export class GroqTimeoutError extends Error {
  constructor() {
    super("Groq request timed out.");
    this.name = "GroqTimeoutError";
  }
}

type GroqTool = { name: string; description: string; parameters: Record<string, unknown> };

export type GroqResult = { text: string; toolInput: unknown | undefined; inputTokens: number; outputTokens: number };

export async function groqChat(options: {
  model?: string;
  system?: string;
  prompt: string;
  maxTokens: number;
  tool?: GroqTool;
}): Promise<GroqResult> {
  const apiKey = getGroqApiKey();
  if (!apiKey) throw new GroqHTTPError("GROQ_API_KEY isn't set.", 401);

  const messages = [
    ...(options.system ? [{ role: "system", content: options.system }] : []),
    { role: "user", content: options.prompt },
  ];
  const body: Record<string, unknown> = {
    model: options.model ?? GROQ_DEFAULT_MODEL,
    max_tokens: options.maxTokens,
    messages,
  };
  if (options.tool) {
    body.tools = [{ type: "function", function: options.tool }];
    body.tool_choice = { type: "function", function: { name: options.tool.name } };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS * 2);
  let response: Response;
  try {
    response = await fetch(GROQ_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } catch (err) {
    if (controller.signal.aborted) throw new GroqTimeoutError();
    throw err;
  } finally {
    clearTimeout(timer);
  }

  if (!response.ok) {
    const detail = (await response.text().catch(() => "")).slice(0, 300);
    throw new GroqHTTPError(`Groq returned ${response.status}: ${detail}`, response.status);
  }

  const data = (await response.json()) as {
    choices?: { message?: { content?: string | null; tool_calls?: { function?: { name?: string; arguments?: string } }[] } }[];
    usage?: { prompt_tokens?: number; completion_tokens?: number };
  };
  const message = data.choices?.[0]?.message;
  const call = message?.tool_calls?.find((c) => c.function?.name === options.tool?.name);

  let toolInput: unknown;
  if (call?.function?.arguments) {
    try {
      toolInput = JSON.parse(call.function.arguments);
    } catch {
      toolInput = undefined;
    }
  }

  return {
    text: message?.content ?? "",
    toolInput,
    inputTokens: data.usage?.prompt_tokens ?? 0,
    outputTokens: data.usage?.completion_tokens ?? 0,
  };
}
