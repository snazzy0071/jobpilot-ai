import "server-only";
import { getReedEnv } from "@/lib/jobs/adapters/reed/env";
import { fetchFeedJson, requireResultsArray } from "@/lib/jobs/adapters/feed-fetch";
import { JobFeedError } from "@/lib/jobs/feed-error";

const REED_SEARCH_URL = "https://www.reed.co.uk/api/1.0/search";
/** Reed's own per-page ceiling for the search endpoint. */
const MAX_RESULTS_TO_TAKE = 100;

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
 * Reed's own response shape — every field beyond `jobId` is optional here even where their docs imply it's always
 * present: the normalizer rejects a listing that lacks what the jobs table requires, one listing at a time.
 * `jobDescription` is the search endpoint's own (truncated) description — the full text lives behind a separate
 * per-job detail call this adapter deliberately doesn't make, to keep a sync at one request per page instead of
 * one-plus-N, which would multiply the rate-limit exposure.
 */
export type ReedJobResult = {
  jobId: number | string;
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

/**
 * One page of the UK job search. Credentials come from getReedEnv() — process.env read server-side only, never a
 * parameter here.
 *
 * Reed authenticates via HTTP Basic Auth with the API key as the username and an empty password (their documented
 * scheme), so the key never appears in the URL. Failures are classified by fetchFeedJson (rejected key, rate limit
 * after backoff retries, other HTTP error, network/timeout, non-JSON body).
 */
export async function fetchReedJobsPage(params: ReedSearchParams = {}): Promise<{ results: ReedJobResult[] }> {
  let apiKey: string;
  try {
    apiKey = getReedEnv().REED_API_KEY;
  } catch (err) {
    throw new JobFeedError("not_configured", err instanceof Error ? err.message : "Reed isn't configured.");
  }
  const page = Math.max(1, params.page ?? 1);
  const resultsToTake = Math.min(MAX_RESULTS_TO_TAKE, Math.max(1, params.resultsPerPage ?? MAX_RESULTS_TO_TAKE));
  const resultsToSkip = (page - 1) * resultsToTake;

  const url = new URL(REED_SEARCH_URL);
  url.searchParams.set("resultsToTake", String(resultsToTake));
  url.searchParams.set("resultsToSkip", String(resultsToSkip));
  if (params.keywords) url.searchParams.set("keywords", params.keywords);
  if (params.location) url.searchParams.set("locationName", params.location);

  const authorization = `Basic ${Buffer.from(`${apiKey}:`).toString("base64")}`;
  const data = await fetchFeedJson("Reed", url, { method: "GET", headers: { Authorization: authorization } });
  return { results: requireResultsArray("Reed", data) as ReedJobResult[] };
}
