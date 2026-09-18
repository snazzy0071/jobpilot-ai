import "server-only";
import { getAdzunaEnv } from "@/lib/jobs/adapters/adzuna/env";
import { readResponseWithCap, exceedsDeclaredLength } from "@/lib/net/response-cap";

const ADZUNA_BASE_URL = "https://api.adzuna.com/v1/api/jobs";
/** Adzuna's own per-page ceiling for the search endpoint. */
const MAX_RESULTS_PER_PAGE = 50;
const REQUEST_TIMEOUT_MS = 15_000;
// Generous for a page of up to 50 job listings with descriptions —
// same ceiling src/lib/net/safe-fetch.ts uses for a whole web page.
const MAX_RESPONSE_BYTES = 5 * 1024 * 1024;

export type AdzunaSearchParams = {
  /** Free-text keywords (Adzuna's `what`). */
  keywords?: string;
  /** Free-text location (Adzuna's `where`) — a UK town/city/region. */
  location?: string;
  /** 1-indexed, matching Adzuna's own page numbering. */
  page?: number;
  resultsPerPage?: number;
};

/**
 * Adzuna's own response shape — every field beyond `id`/`title`/
 * `redirect_url` is optional here even where their docs imply it's
 * always present, since this is unverified against a live account
 * (no Adzuna credentials in this environment) and a normalizer that
 * assumes too much would crash on the first listing that doesn't match.
 */
export type AdzunaJobResult = {
  id: string;
  title?: string;
  description?: string;
  created?: string;
  redirect_url?: string;
  company?: { display_name?: string };
  location?: { display_name?: string };
};

type AdzunaSearchResponse = {
  results?: AdzunaJobResult[];
  count?: number;
};

/**
 * One page of the UK ("gb") job search. Credentials come from
 * getAdzunaEnv() — process.env read server-side only, never accepted as
 * a parameter here, so there's no call shape that could route a client-
 * supplied key through this function by mistake.
 */
export async function fetchAdzunaJobsPage(params: AdzunaSearchParams = {}): Promise<{
  results: AdzunaJobResult[];
  count: number;
}> {
  const { ADZUNA_APP_ID, ADZUNA_APP_KEY } = getAdzunaEnv();
  const page = Math.max(1, params.page ?? 1);
  const resultsPerPage = Math.min(MAX_RESULTS_PER_PAGE, Math.max(1, params.resultsPerPage ?? MAX_RESULTS_PER_PAGE));

  const url = new URL(`${ADZUNA_BASE_URL}/gb/search/${page}`);
  url.searchParams.set("app_id", ADZUNA_APP_ID);
  url.searchParams.set("app_key", ADZUNA_APP_KEY);
  url.searchParams.set("results_per_page", String(resultsPerPage));
  url.searchParams.set("content-type", "application/json");
  if (params.keywords) url.searchParams.set("what", params.keywords);
  if (params.location) url.searchParams.set("where", params.location);

  const response = await fetch(url, { method: "GET", signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
  if (!response.ok) {
    // Adzuna's own error body sometimes has useful detail (e.g. "Invalid
    // app_id or app_key") — surfaced in the thrown message, but never
    // the request URL itself, which carries the credentials as query
    // params.
    const body = await response.text().catch(() => "");
    throw new Error(`Adzuna search failed (${response.status}): ${body.slice(0, 300)}`);
  }

  if (exceedsDeclaredLength(response, MAX_RESPONSE_BYTES)) {
    throw new Error("Adzuna search response declared an implausibly large body — refusing to read it.");
  }
  const body = await readResponseWithCap(response, MAX_RESPONSE_BYTES);
  if (body === null) {
    throw new Error("Adzuna search response was larger than expected — refusing to read it.");
  }

  const data = JSON.parse(body.toString("utf-8")) as AdzunaSearchResponse;
  return { results: data.results ?? [], count: data.count ?? 0 };
}
