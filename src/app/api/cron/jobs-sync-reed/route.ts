import { NextResponse, type NextRequest } from "next/server";
import { syncReedJobs } from "@/lib/jobs/adapters/reed/sync";
import { consumeSystemRateLimit } from "@/lib/rate-limit/ip-limit";

export const dynamic = "force-dynamic";

/**
 * Same shape and gating as /api/cron/jobs-sync-adzuna — see that
 * route's own doc comment for why this is a CRON_SECRET-gated GET
 * rather than an admin-session route, and why it fails closed when
 * CRON_SECRET itself isn't set.
 */
export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    console.error("Reed sync route called but CRON_SECRET isn't configured.");
    return NextResponse.json({ error: "Not configured" }, { status: 503 });
  }

  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Defense in depth against a leaked CRON_SECRET or a misfiring
  // duplicate trigger causing a run-storm against Reed's API — see
  // /api/cron/jobs-sync-adzuna's own comment on this same check.
  if (!(await consumeSystemRateLimit("cron_jobs_sync_reed", { windowSeconds: 10 * 60, maxRequests: 2 }))) {
    return NextResponse.json({ error: "Too many sync runs — try again shortly." }, { status: 429 });
  }

  const keywords = req.nextUrl.searchParams.get("keywords") ?? undefined;
  const location = req.nextUrl.searchParams.get("location") ?? undefined;
  const maxPagesParam = req.nextUrl.searchParams.get("maxPages");
  const maxPages = maxPagesParam ? Number(maxPagesParam) : undefined;

  let result;
  try {
    result = await syncReedJobs({ keywords, location, maxPages });
  } catch (err) {
    console.error("Reed sync failed:", err);
    return NextResponse.json({ error: "Sync failed" }, { status: 500 });
  }

  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: 502 });
  }

  return NextResponse.json(result);
}
