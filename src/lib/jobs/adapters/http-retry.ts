import "server-only";

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// A structural guarantee, not an opt-in: if a caller doesn't pass its
// own `init.signal`, one is added here — bounds total wall-clock time
// (across every retry attempt and backoff delay, not just one HTTP
// round trip) rather than leaving a request that could hang
// indefinitely if a caller forgets to set a timeout itself.
const DEFAULT_TIMEOUT_MS = 15_000;

export type RateLimitRetryOptions = {
  maxRetries?: number;
  /** Used when the response gives no Retry-After header — doubled each subsequent attempt. */
  baseDelayMs?: number;
};

/**
 * A plain `fetch` wrapper that retries only on 429 (Too Many Requests),
 * honoring a numeric `Retry-After` header (seconds) when the API sends
 * one, and falling back to exponential backoff otherwise. Every other
 * status — including other 4xx/5xx — is returned as-is on the first
 * attempt; retrying a 401 or a 500 blindly wouldn't help and would just
 * slow down a genuine failure.
 *
 * The specific delay numbers here are a conservative, general-purpose
 * default, not sourced from any one provider's documented rate limit —
 * there's no live account for any job-source API in this environment to
 * verify an exact figure against, so this errs toward being polite
 * rather than precise.
 */
export async function fetchWithRateLimitRetry(
  url: string | URL,
  init: RequestInit,
  options: RateLimitRetryOptions = {},
): Promise<Response> {
  const maxRetries = options.maxRetries ?? 3;
  const baseDelayMs = options.baseDelayMs ?? 1000;
  const requestInit: RequestInit = { ...init, signal: init.signal ?? AbortSignal.timeout(DEFAULT_TIMEOUT_MS) };

  let response: Response;
  for (let attempt = 0; ; attempt++) {
    response = await fetch(url, requestInit);
    if (response.status !== 429 || attempt >= maxRetries) return response;

    const retryAfterHeader = response.headers.get("retry-after");
    const retryAfterSeconds = retryAfterHeader ? Number(retryAfterHeader) : NaN;
    const delayMs = Number.isFinite(retryAfterSeconds) && retryAfterSeconds >= 0
      ? retryAfterSeconds * 1000
      : baseDelayMs * 2 ** attempt;

    await sleep(delayMs);
  }
}
