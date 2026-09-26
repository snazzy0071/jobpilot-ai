import "server-only";
import { fetchAdzunaJobsPage } from "@/lib/jobs/adapters/adzuna/client";
import { normalizeAdzunaJob } from "@/lib/jobs/adapters/adzuna/normalize";
import { runJobSync, type JobFeedAdapter, type JobSyncOptions, type JobSyncResult } from "@/lib/jobs/sync-runner";
import type { AdzunaJobResult } from "@/lib/jobs/adapters/adzuna/client";

const adzunaAdapter: JobFeedAdapter = {
  slug: "adzuna",
  name: "Adzuna",
  baseUrl: "https://www.adzuna.co.uk",
  betweenRequestsMs: 250,
  fetchPage: (search, page) => fetchAdzunaJobsPage({ keywords: search.keywords, location: search.location, page }),
  normalize: (raw) => normalizeAdzunaJob(raw as AdzunaJobResult),
};

export type AdzunaSyncResult = JobSyncResult;

/** One Adzuna sync run — fetching and normalizing are Adzuna's; the run itself (logging, errors, dedupe, upsert) is src/lib/jobs/sync-runner.ts. */
export function syncAdzunaJobs(options: JobSyncOptions = {}): Promise<AdzunaSyncResult> {
  return runJobSync(adzunaAdapter, options);
}
