// Model config lives here, in one place, instead of a model name string
// copy-pasted into every future call site — matching the same reasoning
// as src/config/plans.ts being the one source of truth for plan data.

// Read directly from process.env, not via getAIEnv() (src/lib/ai/env.ts)
// — that function also requires ANTHROPIC_API_KEY and throws if it's
// missing, which would turn this optional, always-has-a-fallback
// override into an eager crash for every page that imports this module
// (client.ts, service.ts, ...) the moment the API key isn't configured,
// exactly the "fails next build itself" problem env.ts's own lazy
// pattern exists to avoid. ANTHROPIC_MODEL was previously documented in
// .env.example/validated by aiEnvSchema but never actually read
// anywhere — this is what makes that documented "optional, overrides
// the default" behavior real.
export const DEFAULT_MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-5";
export const DEFAULT_MAX_TOKENS = 2048;
export const DEFAULT_TIMEOUT_MS = 30_000;

// Transport-level retries (network errors, 429s, 5xxs) are handled by
// the Anthropic SDK client itself via its own `maxRetries` option — see
// src/lib/ai/client.ts. This is a *separate*, application-level retry
// count for a failure the SDK can't see: the model responding without
// calling the expected tool, or calling it with input that fails schema
// validation. See src/lib/ai/service.ts's generateStructured.
export const STRUCTURED_OUTPUT_RETRY_ATTEMPTS = 2;
export const TRANSPORT_MAX_RETRIES = 2;

// Short-window abuse/burst protection (src/lib/ai/rate-limit.ts) — a
// fixed count of requests per fixed window, per user per operation.
// Deliberately not a plan entitlement: this protects the Anthropic API
// and the server from being hammered regardless of tier, not a business
// upsell lever. A fixed (not sliding) window is a known, accepted
// simplification — see rate-limit.ts.
export const AI_RATE_LIMIT_WINDOW_SECONDS = 60;
export const AI_RATE_LIMIT_MAX_REQUESTS = 10;

// Applied to any error text before it's logged (src/lib/ai/service.ts's
// classifyError) — defense in depth against a future custom zod
// `.refine()` message, or an unusually verbose provider error,
// accidentally embedding a large chunk of request/response data. Zod's
// own default issue messages never echo the invalid value (verified),
// but a caller-supplied schema could still do so via a custom message.
export const MAX_LOGGED_ERROR_MESSAGE_LENGTH = 300;

/**
 * Approximate, per million tokens, in USD. For internal cost tracking
 * and alerting only — verify against https://www.anthropic.com/pricing
 * before using these figures for anything resembling real financial
 * reporting; provider pricing changes independently of this file.
 */
export const MODEL_PRICING_PER_MILLION_TOKENS: Record<string, { input: number; output: number }> = {
  "claude-sonnet-5": { input: 3, output: 15 },
  "claude-opus-5": { input: 15, output: 75 },
  "claude-haiku-4-5-20251001": { input: 0.8, output: 4 },
  "claude-fable-5-1": { input: 3, output: 15 },
};

/** Returns 0 for a model with no known pricing, rather than guessing. */
export function estimateCostUsd(model: string, inputTokens: number, outputTokens: number): number {
  const pricing = MODEL_PRICING_PER_MILLION_TOKENS[model];
  if (!pricing) return 0;
  return (inputTokens / 1_000_000) * pricing.input + (outputTokens / 1_000_000) * pricing.output;
}
