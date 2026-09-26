import "server-only";
import { getAdzunaEnv } from "@/lib/jobs/adapters/adzuna/env";
import { fetchFeedJson, requireResultsArray } from "@/lib/jobs/adapters/feed-fetch";
import { JobFeedError } from "@/lib/jobs/feed-error";

const ADZUNA_BASE_URL = "https://api.adzuna.com/v1/api/jobs";
/** Adzuna's own per-page ceiling for the search endpoint. */
const MAX_RESULTS_PER_PAGE = 50;

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
 * Adzuna's own response shape — every field beyond `id` is optional here even where their docs imply it's always
 * present: the normalizer rejects a listing that lacks what the jobs table requires, one listing at a time.
 */
export type AdzunaJobResult = {
  id: string | number;
  title?: string;
  description?: string;
  created?: string;
  redirect_url?: string;
  company?: { display_name?: string };
  location?: { display_name?: string };
};

/**
 * One page of the UK ("gb") job search, newest first. Credentials come from getAdzunaEnv() — process.env read
 * server-side only, never a parameter here, so no call shape can route a client-supplied key through this function.
 */
export async function fetchAdzunaJobsPage(params: AdzunaSearchParams = {}): Promise<{ results: AdzunaJobResult[] }> {
  let credentials;
  try {
    credentials = getAdzunaEnv();
  } catch (err) {
    throw new JobFeedError("not_configured", err instanceof Error ? err.message : "Adzuna isn't configured.");
  }
  const page = Math.max(1, params.page ?? 1);
  const resultsPerPage = Math.min(MAX_RESULTS_PER_PAGE, Math.max(1, params.resultsPerPage ?? MAX_RESULTS_PER_PAGE));

  const url = new URL(`${ADZUNA_BASE_URL}/gb/search/${page}`);
  url.searchParams.set("app_id", credentials.ADZUNA_APP_ID);
  url.searchParams.set("app_key", credentials.ADZUNA_APP_KEY);
  url.searchParams.set("results_per_page", String(resultsPerPage));
  url.searchParams.set("sort_by", "date");
  url.searchParams.set("content-type", "application/json");
  if (params.keywords) url.searchParams.set("what", params.keywords);
  if (params.location) url.searchParams.set("where", params.location);

  const data = await fetchFeedJson("Adzuna", url, { method: "GET" });
  return { results: requireResultsArray("Adzuna", data) as AdzunaJobResult[] };
}
