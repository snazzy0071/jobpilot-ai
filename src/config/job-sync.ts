// What the scheduled job sync asks Adzuna and Reed for. Neither provider offers "give me everything" — every request is
// a keyword (and optionally location) search — so the feed is exactly as broad as this list. These are search terms,
// not listings: every job in the database comes from a provider response.
//
// The first two target the product's purpose (roles that mention sponsorship); the rest are broad role families that
// cover the bulk of UK listings a Skilled Worker candidate looks at. Add or remove terms freely — each search costs up
// to JOB_SYNC_MAX_PAGES_PER_SEARCH requests per provider per run, and the run stops starting new requests once it has
// used JOB_SYNC_TIME_BUDGET_MS (the cron route's serverless time limit).

export type JobSyncSearch = { keywords?: string; location?: string };

export const JOB_SYNC_SEARCHES: JobSyncSearch[] = [
  { keywords: "visa sponsorship" },
  { keywords: "skilled worker visa" },
  { keywords: "graduate" },
  { keywords: "software engineer" },
  { keywords: "data analyst" },
  { keywords: "nurse" },
  { keywords: "accountant" },
  { keywords: "project manager" },
  { keywords: "marketing" },
  { keywords: "engineer" },
];

export const JOB_SYNC_MAX_PAGES_PER_SEARCH = 2;

/** Comfortably under the cron routes' maxDuration (120s), leaving room to write what was fetched. */
export const JOB_SYNC_TIME_BUDGET_MS = 85_000;
