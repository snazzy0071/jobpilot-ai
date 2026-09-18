import { NextResponse, type NextRequest } from "next/server";
import { dispatchDueReminders } from "@/lib/applications/reminders/dispatch";

export const dynamic = "force-dynamic";

/**
 * Delivers every due application reminder (real email + in-app state)
 * — same `CRON_SECRET`-gated `GET` shape as every other `/api/cron/*`
 * route this session (jobs-sync-adzuna/jobs-sync-reed/jobs-
 * maintenance): checks `Authorization: Bearer <CRON_SECRET>`, fails
 * closed (503) if that env var isn't set. Vercel's own cron runner
 * sends that header automatically once `CRON_SECRET` is set on the
 * project (see vercel.json).
 */
export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    console.error("Reminder dispatch route called but CRON_SECRET isn't configured.");
    return NextResponse.json({ error: "Not configured" }, { status: 503 });
  }

  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await dispatchDueReminders();
    return NextResponse.json(result);
  } catch (err) {
    console.error("Reminder dispatch failed:", err);
    return NextResponse.json({ error: "Dispatch failed" }, { status: 500 });
  }
}
