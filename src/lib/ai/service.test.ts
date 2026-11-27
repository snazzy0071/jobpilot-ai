import { beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { BadRequestError, RateLimitError } from "@anthropic-ai/sdk";

vi.mock("@/lib/ai/client", () => ({ getAIClient: vi.fn() }));
vi.mock("@/lib/ai/logging", () => ({ logAIUsage: vi.fn() }));

const schema = z.object({ overall: z.number().min(0).max(100), summary: z.string() });

function toolUseResponse(input: unknown) {
  return {
    content: [{ type: "tool_use", name: "respond", input }],
    usage: { input_tokens: 10, output_tokens: 5 },
  };
}

function textOnlyResponse(text: string) {
  return { content: [{ type: "text", text }], usage: { input_tokens: 10, output_tokens: 5 } };
}

function fakeClient(create: ReturnType<typeof vi.fn>) {
  return { messages: { create } };
}

describe("generateStructured", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns the validated data on a well-formed first response, calling the model exactly once", async () => {
    const create = vi.fn().mockResolvedValue(toolUseResponse({ overall: 82, summary: "Good match." }));
    const { getAIClient } = await import("@/lib/ai/client");
    (getAIClient as ReturnType<typeof vi.fn>).mockReturnValue(fakeClient(create));

    const { generateStructured } = await import("@/lib/ai/service");
    const result = await generateStructured({ operation: "test_op", userId: "user-1", prompt: "score this", schema });

    expect(result).toEqual({ overall: 82, summary: "Good match." });
    expect(create).toHaveBeenCalledTimes(1);
  });

  it("retries after a response that fails schema validation, and returns the valid retry", async () => {
    const create = vi
      .fn()
      .mockResolvedValueOnce(toolUseResponse({ overall: "not-a-number", summary: "bad" }))
      .mockResolvedValueOnce(toolUseResponse({ overall: 55, summary: "Recovered on retry." }));
    const { getAIClient } = await import("@/lib/ai/client");
    (getAIClient as ReturnType<typeof vi.fn>).mockReturnValue(fakeClient(create));

    const { generateStructured } = await import("@/lib/ai/service");
    const result = await generateStructured({ operation: "test_op", prompt: "score this", schema });

    expect(result).toEqual({ overall: 55, summary: "Recovered on retry." });
    expect(create).toHaveBeenCalledTimes(2);
  });

  it("retries when the model responds with plain text instead of calling the tool at all", async () => {
    const create = vi
      .fn()
      .mockResolvedValueOnce(textOnlyResponse("I'd rather just chat about this."))
      .mockResolvedValueOnce(toolUseResponse({ overall: 70, summary: "Now via the tool." }));
    const { getAIClient } = await import("@/lib/ai/client");
    (getAIClient as ReturnType<typeof vi.fn>).mockReturnValue(fakeClient(create));

    const { generateStructured } = await import("@/lib/ai/service");
    const result = await generateStructured({ operation: "test_op", prompt: "score this", schema });

    expect(result).toEqual({ overall: 70, summary: "Now via the tool." });
    expect(create).toHaveBeenCalledTimes(2);
  });

  it("throws a safe AIServiceError with code invalid_response after exhausting every retry on persistently invalid output", async () => {
    const create = vi.fn().mockResolvedValue(toolUseResponse({ overall: 999, summary: "always invalid" }));
    const { getAIClient } = await import("@/lib/ai/client");
    (getAIClient as ReturnType<typeof vi.fn>).mockReturnValue(fakeClient(create));

    const { generateStructured, AIServiceError } = await import("@/lib/ai/service");
    const promise = generateStructured({ operation: "test_op", prompt: "score this", schema });

    await expect(promise).rejects.toThrow(AIServiceError);
    await expect(promise.catch((err) => err.code)).resolves.toBe("invalid_response");
    // STRUCTURED_OUTPUT_RETRY_ATTEMPTS = 2 -> the initial attempt plus 2
    // retries, three calls total, never more.
    expect(create).toHaveBeenCalledTimes(3);
  });

  it("never leaks the raw AIServiceError message from the model's response — always the same generic, safe text", async () => {
    const create = vi.fn().mockResolvedValue(toolUseResponse({ overall: 999, summary: "always invalid" }));
    const { getAIClient } = await import("@/lib/ai/client");
    (getAIClient as ReturnType<typeof vi.fn>).mockReturnValue(fakeClient(create));

    const { generateStructured } = await import("@/lib/ai/service");
    await expect(generateStructured({ operation: "test_op", prompt: "score this", schema })).rejects.toThrow(
      "Something went wrong generating that — try again in a moment.",
    );
  });

  it("stops immediately on a genuine API error (e.g. a bad request) — no retry, since asking again the same way can't fix it", async () => {
    const create = vi.fn().mockRejectedValue(new BadRequestError(400, {}, "Invalid request", new Headers()));
    const { getAIClient } = await import("@/lib/ai/client");
    (getAIClient as ReturnType<typeof vi.fn>).mockReturnValue(fakeClient(create));

    const { generateStructured } = await import("@/lib/ai/service");
    await expect(generateStructured({ operation: "test_op", prompt: "score this", schema })).rejects.toThrow();
    expect(create).toHaveBeenCalledTimes(1);
  });

  it("does retry a rate-limit error, unlike other API errors, and can still succeed once it clears", async () => {
    const create = vi
      .fn()
      .mockRejectedValueOnce(new RateLimitError(429, {}, "Rate limited", new Headers()))
      .mockResolvedValueOnce(toolUseResponse({ overall: 40, summary: "Succeeded after the rate limit cleared." }));
    const { getAIClient } = await import("@/lib/ai/client");
    (getAIClient as ReturnType<typeof vi.fn>).mockReturnValue(fakeClient(create));

    const { generateStructured } = await import("@/lib/ai/service");
    const result = await generateStructured({ operation: "test_op", prompt: "score this", schema });

    expect(result).toEqual({ overall: 40, summary: "Succeeded after the rate limit cleared." });
    expect(create).toHaveBeenCalledTimes(2);
  });

  it("logs a successful structured call's usage", async () => {
    const create = vi.fn().mockResolvedValue(toolUseResponse({ overall: 82, summary: "Good match." }));
    const { getAIClient } = await import("@/lib/ai/client");
    (getAIClient as ReturnType<typeof vi.fn>).mockReturnValue(fakeClient(create));
    const { logAIUsage } = await import("@/lib/ai/logging");

    const { generateStructured } = await import("@/lib/ai/service");
    await generateStructured({ operation: "test_op", userId: "user-1", prompt: "score this", schema });

    expect(logAIUsage).toHaveBeenCalledWith(expect.objectContaining({ userId: "user-1", operation: "test_op", success: true }));
  });
});

describe("Groq (Llama) test fallback", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("ANTHROPIC_API_KEY", "");
    vi.stubEnv("GROQ_API_KEY", "test-groq-key");
  });

  it("uses Groq for structured output when only GROQ_API_KEY is set", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: null, tool_calls: [{ function: { name: "respond", arguments: JSON.stringify({ overall: 70, summary: "Fine." }) } }] } }],
        usage: { prompt_tokens: 12, completion_tokens: 6 },
      }),
    });
    vi.stubGlobal("fetch", fetchMock);
    const { getAIClient } = await import("@/lib/ai/client");

    const { generateStructured } = await import("@/lib/ai/service");
    const result = await generateStructured({ operation: "test_op", prompt: "score this", schema });

    expect(result).toEqual({ overall: 70, summary: "Fine." });
    expect(getAIClient).not.toHaveBeenCalled();
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.tool_choice).toEqual({ type: "function", function: { name: "respond" } });
    expect(body.tools[0].function.parameters.$schema).toBeUndefined();
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("maps a Groq 401 to the safe not-configured error", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 401, text: async () => "invalid key" }));
    const { generateText } = await import("@/lib/ai/service");
    await expect(generateText({ operation: "test_op", prompt: "hi" })).rejects.toMatchObject({ code: "not_configured" });
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });
});
