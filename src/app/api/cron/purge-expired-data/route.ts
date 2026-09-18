import { NextResponse, type NextRequest } from "next/server";
import { purgeExpiredData } from "@/lib/cleanup/purge-expired-data";

export const dynamic = "force-dynamic";

/**
 * Daily sweep of expired anonymous ATS results, stale rate-limit
 * windows, and expired-unaccepted institution invite tokens — see
 * docs/DATA_RETENTION.md for what's covered and why, and
 * src/lib/cleanup/purge-expired-data.ts for the actual queries. Same
 * `CRON_SECRET`-gated `GET` shape as every other `/api/cron/*` route
 * (jobs-sync-adzuna/jobs-sync-reed/jobs-maintenance/dispatch-reminders):
 * checks `Authorization: Bearer <CRON_SECRET>`, fails closed (503) if
 * that env var isn't set. Vercel's own cron runner sends that header
 * automatically once `CRON_SECRET` is set on the project (see
 * vercel.json).
 */
export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    console.error("Purge expired data route called but CRON_SECRET isn't configured.");
    return NextResponse.json({ error: "Not configured" }, { status: 503 });
  }

  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await purgeExpiredData();
  return NextResponse.json(result, { status: result.errors.length > 0 ? 500 : 200 });
}
