import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { estimateCostUsd } from "@/lib/ai/config";

export type AIUsageLogEntry = {
  userId?: string | null;
  operation: string;
  /** Which versioned prompt (src/lib/ai/prompts/) produced this call, if any — e.g. "1.0.0". */
  promptVersion?: string | null;
  model: string;
  inputTokens: number;
  outputTokens: number;
  success: boolean;
  errorMessage?: string | null;
  durationMs: number;
};

/**
 * Persists one row per Claude API call — successful or not — to
 * ai_usage_logs (migration 0021). ai_usage_logs has no client-writable
 * policy, so this goes through the admin (service-role) client, same as
 * every other trusted-server-side-only write in this codebase.
 */
export async function logAIUsage(entry: AIUsageLogEntry): Promise<void> {
  const admin = createAdminClient();
  const estimatedCostUsd = estimateCostUsd(entry.model, entry.inputTokens, entry.outputTokens);

  const { error } = await admin.from("ai_usage_logs").insert({
    user_id: entry.userId ?? null,
    operation: entry.operation,
    prompt_version: entry.promptVersion ?? null,
    model: entry.model,
    input_tokens: entry.inputTokens,
    output_tokens: entry.outputTokens,
    estimated_cost_usd: estimatedCostUsd,
    success: entry.success,
    error_message: entry.errorMessage ?? null,
    duration_ms: entry.durationMs,
  });

  if (error) {
    // A logging failure must never surface as the AI call's own error —
    // the caller already has their real result (or real failure);
    // losing one usage-log row is far preferable to masking that behind
    // a confusing secondary error about logging.
    console.error("logAIUsage failed:", error.message);
  }
}
