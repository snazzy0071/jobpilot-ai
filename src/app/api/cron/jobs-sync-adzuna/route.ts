import { NextResponse, type NextRequest } from "next/server";
import { syncAdzunaJobs } from "@/lib/jobs/adapters/adzuna/sync";
import { consumeSystemRateLimit } from "@/lib/rate-limit/ip-limit";

export const dynamic = "force-dynamic";

/**
 * Triggers one Adzuna sync run — meant for a scheduled trigger (Vercel
 * Cron or similar), not a browser or any authenticated-user session, so
 * this is gated on a shared secret (`CRON_SECRET`, `.env.example`) via
 * the `Authorization: Bearer <secret>` header, the same convention
 * Vercel's own docs recommend for a cron-invoked route. Fails closed:
 * an unset CRON_SECRET refuses every request rather than leaving the
 * endpoint open, same "no implicit trust" reasoning as this session's
 * own profiles privilege-escalation fix.
 *
 * Bounded to a handful of pages per run (src/lib/jobs/adapters/adzuna/
 * sync.ts's own maxPages cap) specifically so this fits inside a single
 * serverless invocation — unlike the sponsor register sync (a
 * multi-minute, ~130k-row job that needed GitHub Actions instead), a
 * few hundred Adzuna listings per run is comfortably short enough for a
 * Route Handler.
 */
export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    console.error("Adzuna sync route called but CRON_SECRET isn't configured.");
    return NextResponse.json({ error: "Not configured" }, { status: 503 });
  }

  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Defense in depth against a leaked CRON_SECRET or a misfiring
  // duplicate trigger causing a run-storm against Adzuna's API — the
  // secret check above is the real access control, this just bounds
  // how often even a valid caller can kick off a run.
  if (!(await consumeSystemRateLimit("cron_jobs_sync_adzuna", { windowSeconds: 10 * 60, maxRequests: 2 }))) {
    return NextResponse.json({ error: "Too many sync runs — try again shortly." }, { status: 429 });
  }

  const keywords = req.nextUrl.searchParams.get("keywords") ?? undefined;
  const location = req.nextUrl.searchParams.get("location") ?? undefined;
  const maxPagesParam = req.nextUrl.searchParams.get("maxPages");
  const maxPages = maxPagesParam ? Number(maxPagesParam) : undefined;

  let result;
  try {
    result = await syncAdzunaJobs({ keywords, location, maxPages });
  } catch (err) {
    console.error("Adzuna sync failed:", err);
    return NextResponse.json({ error: "Sync failed" }, { status: 500 });
  }

  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: 502 });
  }

  return NextResponse.json(result);
}
