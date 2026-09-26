import type { AdminSponsorSyncState } from "@/lib/admin/sponsors/types";

// The workflow runs daily, and the register itself is republished on working days — so a completed sync older than
// this means the schedule has stopped working (or every run since has failed), not just that nothing changed.
export const SPONSOR_SYNC_STALE_AFTER_HOURS = 36;
// A real run takes minutes. One still "processing" after this long has died without recording a failure.
export const SPONSOR_SYNC_STUCK_AFTER_MINUTES = 60;

/** Pure so it can be tested without a database: what should an admin be told about the sync's health? */
export function deriveSponsorSyncState(params: {
  latestStatus: string | null;
  latestStartedAt: string | null;
  lastCompletedAt: string | null;
  now?: number;
}): AdminSponsorSyncState {
  const now = params.now ?? Date.now();
  if (params.latestStatus === "failed") return "failed";
  if (
    params.latestStatus === "processing" &&
    params.latestStartedAt &&
    now - new Date(params.latestStartedAt).getTime() < SPONSOR_SYNC_STUCK_AFTER_MINUTES * 60 * 1000
  ) {
    return "running";
  }
  if (!params.lastCompletedAt) return "never";
  return now - new Date(params.lastCompletedAt).getTime() > SPONSOR_SYNC_STALE_AFTER_HOURS * 60 * 60 * 1000 ? "stale" : "ok";
}
