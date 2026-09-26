import { isBearerMatch } from "@/lib/auth/bearer";
import { NextResponse, type NextRequest } from "next/server";
import { runJobsMaintenance } from "@/lib/jobs/maintenance";

export const dynamic = "force-dynamic";
// Bulk sweep over every job row — bounded well under the 300s default.
export const maxDuration = 60;

/**
 * Cross-source expiry sweep + pruning (src/lib/jobs/maintenance.ts) —
 * separate from the per-source sync routes since it operates over
 * every job regardless of where it came from. Same CRON_SECRET gating
 * as /api/cron/jobs-sync-adzuna/jobs-sync-reed; see that route's own
 * doc comment for why this is a bearer-token-gated GET rather than an
 * admin-session route.
 */
export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    console.error("Jobs maintenance route called but CRON_SECRET isn't configured.");
    return NextResponse.json({ error: "Not configured" }, { status: 503 });
  }

  const authHeader = req.headers.get("authorization");
  if (!isBearerMatch(authHeader, cronSecret)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await runJobsMaintenance();
  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: 502 });
  }

  return NextResponse.json(result);
}
