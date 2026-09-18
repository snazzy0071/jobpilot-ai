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
