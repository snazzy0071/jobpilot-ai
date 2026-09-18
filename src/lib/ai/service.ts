import "server-only";
import Anthropic, {
  APIError,
  RateLimitError,
  AuthenticationError,
  PermissionDeniedError,
  APIConnectionTimeoutError,
} from "@anthropic-ai/sdk";
import { z } from "zod";
import { getAIClient } from "@/lib/ai/client";
import {
  DEFAULT_MODEL,
  DEFAULT_MAX_TOKENS,
  STRUCTURED_OUTPUT_RETRY_ATTEMPTS,
  MAX_LOGGED_ERROR_MESSAGE_LENGTH,
} from "@/lib/ai/config";
import { logAIUsage } from "@/lib/ai/logging";
import { AIServiceError } from "@/lib/ai/errors";

/**
 * THE server-only AI service — every future AI-powered feature (cover
 * letter drafts, LinkedIn rewrites, interview feedback, job match
 * scoring) should call `generateText`/`generateStructured` from here
 * rather than constructing its own Anthropic client. One place means one
 * place that has retries, timeouts, logging, and safe error handling
 * right, instead of each feature reinventing (or forgetting) them.
 *
 * This does NOT check entitlements or consume usage — callers are
 * responsible for calling requireFeature/requireUsageAllowed from
 * src/lib/entitlements/service.ts *before* calling into this service,
 * and releaseUsage if the AI call fails after usage was reserved. Mixing
 * that concern into this file would couple "how to call Claude safely"
 * to "what plan does this user have", which have no reason to change
 * together.
 */

type ErrorClassification = {
  safeMessage: string;
  code: AIServiceError["code"];
  logMessage: string;
};

const GENERIC_SAFE_MESSAGE = "Something went wrong generating that — try again in a moment.";

// Applied once, at the single choke point where any error message is
// handed to the logger — not scattered across every classifyError
// branch — so nothing new can accidentally skip it. Zod's own default
// issue messages never include the invalid value itself (verified), but
// this guards against a future custom `.refine()` message, or an
// unusually verbose provider error, doing so anyway; it's a length cap,
// not a content-aware redactor, so it's not a substitute for keeping
// prompt/response text out of error messages in the first place — see
// the module doc comment.
function truncateForLog(message: string): string {
  return message.length > MAX_LOGGED_ERROR_MESSAGE_LENGTH
    ? `${message.slice(0, MAX_LOGGED_ERROR_MESSAGE_LENGTH)}… (truncated)`
    : message;
}

function classifyError(err: unknown): ErrorClassification {
  if (err instanceof z.ZodError) {
    return {
      safeMessage: GENERIC_SAFE_MESSAGE,
      code: "invalid_response",
      logMessage: `Structured response failed schema validation: ${err.message}`,
    };
  }
  if (err instanceof APIConnectionTimeoutError) {
    return { safeMessage: "That took too long — try again in a moment.", code: "timeout", logMessage: err.message };
  }
  if (err instanceof RateLimitError) {
    return {
      safeMessage: "AI features are busy right now — try again shortly.",
      code: "provider_error",
      logMessage: err.message,
    };
  }
  if (err instanceof AuthenticationError || err instanceof PermissionDeniedError) {
    // Never tell the user "invalid API key" — that's an operator
    // problem, not theirs, and naming it invites probing.
    return {
      safeMessage: "AI features aren't available right now.",
      code: "not_configured",
      logMessage: err.message,
    };
  }
  if (err instanceof APIError) {
    return { safeMessage: GENERIC_SAFE_MESSAGE, code: "provider_error", logMessage: `[${err.status}] ${err.message}` };
  }
  if (err instanceof Error) {
    return { safeMessage: GENERIC_SAFE_MESSAGE, code: "provider_error", logMessage: err.message };
  }
  return { safeMessage: GENERIC_SAFE_MESSAGE, code: "provider_error", logMessage: String(err) };
}

function getClientOrThrowConfigError(): Anthropic {
  try {
    return getAIClient();
  } catch {
    throw new AIServiceError("AI features aren't available right now.", "not_configured");
  }
}

export type GenerateTextOptions = {
  /** Short label for logging/cost tracking, e.g. "cover_letter_draft". */
  operation: string;
  /** Attributes the usage log to a user — omit for a system-initiated call. */
  userId?: string | null;
  /** Version of the src/lib/ai/prompts/ definition this call came from, e.g. "1.0.0". */
  promptVersion?: string;
  system?: string;
  prompt: string;
  model?: string;
  maxTokens?: number;
};

/** Plain-text generation — retries (transport-level, via the client), timeout, logging, and safe errors, no schema. */
export async function generateText(options: GenerateTextOptions): Promise<string> {
  const {
    operation,
    userId = null,
    promptVersion = null,
    system,
    prompt,
    model = DEFAULT_MODEL,
    maxTokens = DEFAULT_MAX_TOKENS,
  } = options;
  const startedAt = Date.now();
  const client = getClientOrThrowConfigError();

  try {
    const response = await client.messages.create({
      model,
      max_tokens: maxTokens,
      system,
      messages: [{ role: "user", content: prompt }],
    });

    const textBlock = response.content.find(
      (block): block is Anthropic.TextBlock => block.type === "text",
    );
    const text = textBlock?.text ?? "";

    await logAIUsage({
      userId,
      operation,
      promptVersion,
      model,
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
      success: true,
      durationMs: Date.now() - startedAt,
    });

    return text;
  } catch (err) {
    const { safeMessage, code, logMessage } = classifyError(err);
    await logAIUsage({
      userId,
      operation,
      promptVersion,
      model,
      inputTokens: 0,
      outputTokens: 0,
      success: false,
      errorMessage: truncateForLog(logMessage),
      durationMs: Date.now() - startedAt,
    });
    console.error(`AI operation "${operation}" failed:`, err);
    throw new AIServiceError(safeMessage, code);
  }
}

export type GenerateStructuredOptions<T> = Omit<GenerateTextOptions, "prompt"> & {
  prompt: string;
  /** Both validates the response and is converted to the tool schema Claude is forced to answer with. */
  schema: z.ZodType<T>;
};

/**
 * Structured-output generation: forces the model to respond via a single
 * tool call shaped by `schema` (more reliable than asking for JSON in
 * the prompt and hoping), then validates the tool call's input against
 * the same schema before returning it — trust but verify the model
 * actually produced what was asked for.
 *
 * Retries up to STRUCTURED_OUTPUT_RETRY_ATTEMPTS additional times
 * specifically when the model doesn't call the tool or the input fails
 * validation — failures the transport layer's own retry (in
 * src/lib/ai/client.ts) can't see, since the HTTP call itself succeeded.
 * A genuine API error (auth, bad request) is not retried this way — see
 * the comment inline — since another attempt won't fix those.
 */
export async function generateStructured<T>(options: GenerateStructuredOptions<T>): Promise<T> {
  const {
    operation,
    userId = null,
    promptVersion = null,
    system,
    prompt,
    schema,
    model = DEFAULT_MODEL,
    maxTokens = DEFAULT_MAX_TOKENS,
  } = options;
  const startedAt = Date.now();
  const client = getClientOrThrowConfigError();

  const toolName = "respond";
  const inputSchema = z.toJSONSchema(schema) as Anthropic.Tool.InputSchema;

  let lastError: unknown;
  let totalInputTokens = 0;
  let totalOutputTokens = 0;

  for (let attempt = 0; attempt <= STRUCTURED_OUTPUT_RETRY_ATTEMPTS; attempt++) {
    try {
      const response = await client.messages.create({
        model,
        max_tokens: maxTokens,
        system,
        messages: [{ role: "user", content: prompt }],
        tools: [
          {
            name: toolName,
            description: "Provide the structured response for this request.",
            input_schema: inputSchema,
          },
        ],
        tool_choice: { type: "tool", name: toolName },
      });

      totalInputTokens += response.usage.input_tokens;
      totalOutputTokens += response.usage.output_tokens;

      const toolUse = response.content.find(
        (block): block is Anthropic.ToolUseBlock => block.type === "tool_use" && block.name === toolName,
      );

      if (!toolUse) {
        lastError = new Error("Model did not return the expected structured tool call.");
        continue;
      }

      const parsed = schema.safeParse(toolUse.input);
      if (!parsed.success) {
        lastError = parsed.error;
        continue;
      }

      await logAIUsage({
        userId,
        operation,
        promptVersion,
        model,
        inputTokens: totalInputTokens,
        outputTokens: totalOutputTokens,
        success: true,
        durationMs: Date.now() - startedAt,
      });

      return parsed.data;
    } catch (err) {
      lastError = err;
      // A real API error (bad request, auth) won't be fixed by asking
      // again the same way a one-off malformed response might — stop
      // burning attempts on something that will just fail identically.
      if (err instanceof APIError && !(err instanceof RateLimitError)) {
        break;
      }
    }
  }

  const { safeMessage, code, logMessage } = classifyError(lastError);
  await logAIUsage({
    userId,
    operation,
    promptVersion,
    model,
    inputTokens: totalInputTokens,
    outputTokens: totalOutputTokens,
    success: false,
    errorMessage: truncateForLog(logMessage),
    durationMs: Date.now() - startedAt,
  });
  console.error(`AI structured operation "${operation}" failed after retries:`, lastError);
  throw new AIServiceError(safeMessage, code);
}

export { AIServiceError } from "@/lib/ai/errors";
