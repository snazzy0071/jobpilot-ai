import "server-only";
import { NextResponse, type NextRequest } from "next/server";
import { consumeSystemRateLimit } from "@/lib/rate-limit/ip-limit";
import type { JobSyncOptions, JobSyncResult } from "@/lib/jobs/sync-runner";

/** Optional overrides for a manual run — with none, the sync runs the configured searches (src/config/job-sync.ts). */
function parseOverrides(req: NextRequest): { options: JobSyncOptions } | { error: string } {
  const keywords = req.nextUrl.searchParams.get("keywords")?.trim() || undefined;
  const location = req.nextUrl.searchParams.get("location")?.trim() || undefined;
  const maxPagesParam = req.nextUrl.searchParams.get("maxPages");

  const printable = /^[^\u0000-\u001f]{1,100}$/;
  if ((keywords && !printable.test(keywords)) || (location && !printable.test(location))) {
    return { error: "keywords and location must be 1-100 printable characters." };
  }
  let maxPages: number | undefined;
  if (maxPagesParam !== null) {
    maxPages = Number(maxPagesParam);
    if (!Number.isInteger(maxPages) || maxPages < 1 || maxPages > 10) return { error: "maxPages must be a whole number from 1 to 10." };
  }
  return { options: { searches: keywords || location ? [{ keywords, location }] : undefined, maxPages } };
}

/**
 * The shared shape of the CRON_SECRET-gated sync routes (Adzuna, Reed): meant for a scheduled trigger, not a browser
 * or a user session, so it is gated on `Authorization: Bearer <CRON_SECRET>` and fails closed — an unset CRON_SECRET
 * refuses every request rather than leaving the endpoint open. A rate limit bounds how often even a valid caller can
 * start a run (a leaked secret or a misfiring duplicate trigger must not cause a run-storm against a provider).
 * A run that recorded a failure answers 502 so the scheduler shows it red; a completed run answers 200 with its counts
 * and any warnings.
 */
export async function handleJobSyncRequest(
  req: NextRequest,
  config: { label: string; rateLimitKey: string; sync: (options: JobSyncOptions) => Promise<JobSyncResult> },
): Promise<NextResponse> {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    console.error(`${config.label} sync route called but CRON_SECRET isn't configured.`);
    return NextResponse.json({ error: "Not configured" }, { status: 503 });
  }
  if (req.headers.get("authorization") !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const overrides = parseOverrides(req);
  if ("error" in overrides) return NextResponse.json({ error: overrides.error }, { status: 400 });

  if (!(await consumeSystemRateLimit(config.rateLimitKey, { windowSeconds: 10 * 60, maxRequests: 3 }))) {
    return NextResponse.json({ error: "Too many sync runs — try again shortly." }, { status: 429 });
  }

  let result: JobSyncResult;
  try {
    result = await config.sync(overrides.options);
  } catch (err) {
    console.error(`${config.label} sync crashed:`, err);
    return NextResponse.json({ error: "Sync failed" }, { status: 500 });
  }

  if ("error" in result) {
    console.error(`${config.label} sync failed:`, result.error);
    return NextResponse.json({ error: result.error }, { status: 502 });
  }
  return NextResponse.json(result);
}
