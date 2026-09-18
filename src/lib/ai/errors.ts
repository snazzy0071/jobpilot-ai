/**
 * The only error shape src/lib/ai/service.ts throws to callers. The
 * message is always safe to show a user or put in a toast — never the
 * raw Anthropic error, which can include request details that have no
 * business reaching the browser. The real error (if any) is logged
 * server-side (console.error + ai_usage_logs.error_message), not
 * discarded — just not forwarded to the caller.
 */
export class AIServiceError extends Error {
  constructor(
    message: string,
    public readonly code:
      | "not_configured"
      | "invalid_response"
      | "provider_error"
      | "timeout"
      | "unauthorized"
      | "rate_limited",
  ) {
    super(message);
    this.name = "AIServiceError";
  }
}
