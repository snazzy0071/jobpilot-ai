import "server-only";
import { fetchWithRateLimitRetry, type RateLimitRetryOptions } from "@/lib/jobs/adapters/http-retry";
import { JobFeedError } from "@/lib/jobs/feed-error";
import { readResponseWithCap, exceedsDeclaredLength } from "@/lib/net/response-cap";

// A page of up to 100 listings with descriptions — same ceiling src/lib/net/safe-fetch.ts uses for a web page.
const MAX_RESPONSE_BYTES = 5 * 1024 * 1024;

/**
 * One GET against a job feed, returning the parsed JSON body or throwing a JobFeedError that says what kind of failure
 * it was. Shared by the Adzuna and Reed clients so both classify failures identically: a rejected key (stop the run),
 * a rate limit that outlasted the retries (stop the run), any other HTTP error, a network failure/timeout, and a 2xx
 * whose body isn't JSON. The request URL is never put in an error message — Adzuna's credentials are query parameters.
 */
export async function fetchFeedJson(provider: string, url: URL, init: RequestInit, retry?: RateLimitRetryOptions): Promise<unknown> {
  let response: Response;
  try {
    response = await fetchWithRateLimitRetry(url, init, retry);
  } catch (err) {
    const timedOut = err instanceof Error && (err.name === "TimeoutError" || err.name === "AbortError");
    throw new JobFeedError("network", timedOut ? `${provider} didn't respond in time.` : `Couldn't reach ${provider}.`);
  }

  if (response.status === 401 || response.status === 403) {
    throw new JobFeedError("auth", `${provider} rejected the API credentials (${response.status}) — check the ${provider} keys.`);
  }
  if (response.status === 429) {
    throw new JobFeedError("rate_limit", `${provider} rate limit exceeded — still throttled after retrying with backoff.`);
  }
  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new JobFeedError("http", `${provider} search failed (${response.status}): ${body.slice(0, 200)}`);
  }

  if (exceedsDeclaredLength(response, MAX_RESPONSE_BYTES)) {
    throw new JobFeedError("bad_response", `${provider} response declared an implausibly large body — refusing to read it.`);
  }
  const body = await readResponseWithCap(response, MAX_RESPONSE_BYTES);
  if (body === null) throw new JobFeedError("bad_response", `${provider} response was larger than expected — refusing to read it.`);

  try {
    return JSON.parse(body.toString("utf-8"));
  } catch {
    throw new JobFeedError("bad_response", `${provider} returned something that isn't JSON.`);
  }
}

/** The list a provider's search response carries, or a bad_response error if the shape isn't what the adapter expects (a provider changing its format must fail the run loudly, not read as "no jobs"). */
export function requireResultsArray(provider: string, data: unknown): unknown[] {
  const results = (data as { results?: unknown } | null)?.results;
  if (!Array.isArray(results)) throw new JobFeedError("bad_response", `${provider} response had no results list — its format may have changed.`);
  return results;
}
