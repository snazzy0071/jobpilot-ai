import type { NextRequest } from "next/server";
import { syncReedJobs } from "@/lib/jobs/adapters/reed/sync";
import { handleJobSyncRequest } from "@/lib/jobs/cron";

export const dynamic = "force-dynamic";
// Several paged upstream requests plus batched upserts; the run time-boxes itself well inside this
// (JOB_SYNC_TIME_BUDGET_MS in src/config/job-sync.ts).
export const maxDuration = 120;

/** Daily Reed sync (vercel.json) — see src/lib/jobs/cron.ts for the gating, rate limit and response shape. */
export async function GET(req: NextRequest) {
  return handleJobSyncRequest(req, { label: "Reed", rateLimitKey: "cron_jobs_sync_reed", sync: syncReedJobs });
}
