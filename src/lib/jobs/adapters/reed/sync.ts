import "server-only";
import { fetchReedJobsPage } from "@/lib/jobs/adapters/reed/client";
import { normalizeReedJob } from "@/lib/jobs/adapters/reed/normalize";
import { runJobSync, type JobFeedAdapter, type JobSyncOptions, type JobSyncResult } from "@/lib/jobs/sync-runner";
import type { ReedJobResult } from "@/lib/jobs/adapters/reed/client";

const reedAdapter: JobFeedAdapter = {
  slug: "reed",
  name: "Reed",
  baseUrl: "https://www.reed.co.uk",
  // A courtesy gap between sequential requests, on top of the client's own 429 retry/backoff.
  betweenRequestsMs: 300,
  fetchPage: (search, page) => fetchReedJobsPage({ keywords: search.keywords, location: search.location, page }),
  normalize: (raw) => normalizeReedJob(raw as ReedJobResult),
};

export type ReedSyncResult = JobSyncResult;

/** One Reed sync run — fetching and normalizing are Reed's; the run itself (logging, errors, dedupe, upsert) is src/lib/jobs/sync-runner.ts. */
export function syncReedJobs(options: JobSyncOptions = {}): Promise<ReedSyncResult> {
  return runJobSync(reedAdapter, options);
}
