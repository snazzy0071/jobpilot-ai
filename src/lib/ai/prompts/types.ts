import type { z } from "zod";

/**
 * A versioned server prompt. `version` is bumped whenever the prompt
 * text or `schema` changes in a way that could change the output — so a
 * result can always be traced back to exactly which wording/shape
 * produced it, not just "the ATS prompt" as of some unknown point in
 * time. Passed through to ai_usage_logs.prompt_version (migration
 * 0023) alongside the usual token/cost/latency fields.
 *
 * `schema` is present only for prompts with structured output — per
 * this task, not every prompt needs one (cover-letter is deliberately
 * plain prose; see that file). Where it is present, it's both what the
 * model is forced to answer through (via generateStructuredGated's
 * forced tool call) and what the response is re-validated against —
 * z.toJSONSchema already emits `additionalProperties: false` at every
 * object level by default, so "strict" here doesn't need anything extra
 * beyond normal `z.object(...)` usage plus real bounds (min/max/enum)
 * on every field, which each prompt below adds explicitly.
 */
export type PromptDefinition<TInput, TOutput = string> = {
  id: string;
  version: string;
  /** Matches the `operation` label used by the AI gateway for rate-limit/entitlement/logging keys. */
  operation: string;
  buildSystem: (input: TInput) => string;
  buildPrompt: (input: TInput) => string;
  schema?: z.ZodType<TOutput>;
};

/**
 * Turns a PromptDefinition + its input into the `operation`/`promptVersion`/
 * `system`/`prompt` fields every generateTextGated/generateStructuredGated
 * call needs — so a call site can't hand-type `operation`/`promptVersion`
 * and let them drift out of sync with the definition actually used. Callers
 * still supply their own `userId`, `featureKey`/`meteredKey` guard, and (for
 * structured prompts) `schema` from the definition itself.
 */
export function toPromptCallOptions<TInput, TOutput>(
  definition: PromptDefinition<TInput, TOutput>,
  input: TInput,
): { operation: string; promptVersion: string; system: string; prompt: string } {
  return {
    operation: definition.operation,
    promptVersion: definition.version,
    system: definition.buildSystem(input),
    prompt: definition.buildPrompt(input),
  };
}
