import "server-only";
import { getReedEnv } from "@/lib/jobs/adapters/reed/env";
import { fetchWithRateLimitRetry } from "@/lib/jobs/adapters/http-retry";
import { readResponseWithCap, exceedsDeclaredLength } from "@/lib/net/response-cap";

const REED_SEARCH_URL = "https://www.reed.co.uk/api/1.0/search";
/** Reed's own per-page ceiling for the search endpoint. */
const MAX_RESULTS_TO_TAKE = 100;
// Generous for a page of up to 100 job listings — same ceiling
// src/lib/net/safe-fetch.ts uses for a whole web page.
const MAX_RESPONSE_BYTES = 5 * 1024 * 1024;

export type ReedSearchParams = {
  /** Free-text keywords (Reed's `keywords`). */
  keywords?: string;
  /** Free-text UK location (Reed's `locationName`). */
  location?: string;
  /** 1-indexed — converted to Reed's own `resultsToSkip` offset below. */
  page?: number;
  resultsPerPage?: number;
};

/**
 * Reed's own response shape — every field beyond `jobId`/`jobTitle`/
 * `jobUrl` is optional here even where their docs imply it's always
 * present, same defensive reasoning as
 * src/lib/jobs/adapters/adzuna/client.ts's AdzunaJobResult: this is
 * unverified against a live account (no Reed credentials in this
 * environment), so a normalizer that assumes too much would crash on
 * the first listing that doesn't match. `jobDescription` here is the
 * search endpoint's own (truncated) description — the full text lives
 * behind a separate per-job detail call this adapter deliberately
 * doesn't make, to keep one sync run at one request per page rather
 * than one-plus-N, which would multiply exactly the rate-limit
 * exposure this task asks to handle.
 */
export type ReedJobResult = {
  jobId: number;
  employerName?: string;
  jobTitle?: string;
  locationName?: string;
  jobDescription?: string;
  jobUrl?: string;
  /** Reed's own "dd/MM/yyyy" format, not ISO — parsed in normalize.ts. */
  date?: string;
  /** Also "dd/MM/yyyy". */
  expirationDate?: string;
};

type ReedSearchResponse = {
  results?: ReedJobResult[];
  totalResults?: number;
};

/**
 * One page of the UK job search. Credentials come from getReedEnv() —
 * process.env read server-side only, never accepted as a parameter
 * here, same "no call shape that could route a client-supplied key
 * through this by mistake" reasoning as the Adzuna adapter.
 *
 * Reed authenticates via HTTP Basic Auth with the API key as the
 * username and an empty password (their documented scheme — there's no
 * header-based alternative), so the key never appears in the URL the
 * way Adzuna's app_id/app_key do.
 */
export async function fetchReedJobsPage(params: ReedSearchParams = {}): Promise<{
  results: ReedJobResult[];
  totalResults: number;
}> {
  const { REED_API_KEY } = getReedEnv();
  const page = Math.max(1, params.page ?? 1);
  const resultsToTake = Math.min(MAX_RESULTS_TO_TAKE, Math.max(1, params.resultsPerPage ?? MAX_RESULTS_TO_TAKE));
  const resultsToSkip = (page - 1) * resultsToTake;

  const url = new URL(REED_SEARCH_URL);
  url.searchParams.set("resultsToTake", String(resultsToTake));
  url.searchParams.set("resultsToSkip", String(resultsToSkip));
  if (params.keywords) url.searchParams.set("keywords", params.keywords);
  if (params.location) url.searchParams.set("locationName", params.location);

  const authorization = `Basic ${Buffer.from(`${REED_API_KEY}:`).toString("base64")}`;

  const response = await fetchWithRateLimitRetry(url, {
    method: "GET",
    headers: { Authorization: authorization },
  });

  if (response.status === 401 || response.status === 403) {
    throw new Error(`Reed rejected the API key (${response.status}) — check REED_API_KEY.`);
  }
  if (response.status === 429) {
    throw new Error("Reed rate limit exceeded — request still throttled after retrying with backoff.");
  }
  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`Reed search failed (${response.status}): ${body.slice(0, 300)}`);
  }

  if (exceedsDeclaredLength(response, MAX_RESPONSE_BYTES)) {
    throw new Error("Reed search response declared an implausibly large body — refusing to read it.");
  }
  const body = await readResponseWithCap(response, MAX_RESPONSE_BYTES);
  if (body === null) {
    throw new Error("Reed search response was larger than expected — refusing to read it.");
  }

  const data = JSON.parse(body.toString("utf-8")) as ReedSearchResponse;
  return { results: data.results ?? [], totalResults: data.totalResults ?? 0 };
}
