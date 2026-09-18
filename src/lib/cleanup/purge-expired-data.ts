import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Every retention window enforced here — and why each number was
 * picked — is written up in full in docs/DATA_RETENTION.md. This file
 * is the enforcement; that file is the policy. Keep them in sync: a
 * constant changed here without updating that doc is real drift, not a
 * style nit.
 */

// quick_scan_results: doesn't duplicate a retention number — it deletes
// whatever src/lib/quick-scan/results.ts's own RETENTION_DAYS (90)
// already stamped onto expires_at at creation time, so the two can
// never drift even if that constant changes.
export async function purgeExpiredQuickScanResults(supabase: ReturnType<typeof createAdminClient>): Promise<number> {
  const { data, error } = await supabase
    .from("quick_scan_results")
    .delete()
    .lt("expires_at", new Date().toISOString())
    .select("id");
  if (error) throw new Error(`Couldn't purge expired Quick Scan results: ${error.message}`);
  return data?.length ?? 0;
}

// anonymous_rate_limits: the longest-lived window any scope in this
// table uses today is Quick Scan's email-scoped cap, a calendar month
// (src/lib/quick-scan/rate-limit.ts's getCurrentMonthStart()) — 35 days
// is comfortably past the start of even a just-begun current month, so
// this can never delete a window still being checked against, for any
// scope (the IP-daily and PDF-hourly scopes are long stale well before
// this cutoff too).
const ANONYMOUS_RATE_LIMIT_RETENTION_DAYS = 35;

export async function purgeStaleAnonymousRateLimits(supabase: ReturnType<typeof createAdminClient>): Promise<number> {
  const cutoff = new Date(Date.now() - ANONYMOUS_RATE_LIMIT_RETENTION_DAYS * 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await supabase.from("anonymous_rate_limits").delete().lt("window_start", cutoff).select("id");
  if (error) throw new Error(`Couldn't purge stale anonymous rate limits: ${error.message}`);
  return data?.length ?? 0;
}

// ai_rate_limit_windows: migration 0022's own TODO comment already
// flagged this table as needing periodic cleanup. Windows are 60
// seconds long (src/lib/ai/config.ts's AI_RATE_LIMIT_WINDOW_SECONDS),
// so 7 days is generous, not tight.
const AI_RATE_LIMIT_RETENTION_DAYS = 7;

export async function purgeStaleAiRateLimitWindows(supabase: ReturnType<typeof createAdminClient>): Promise<number> {
  const cutoff = new Date(Date.now() - AI_RATE_LIMIT_RETENTION_DAYS * 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await supabase.from("ai_rate_limit_windows").delete().lt("window_start", cutoff).select("id");
  if (error) throw new Error(`Couldn't purge stale AI rate limit windows: ${error.message}`);
  return data?.length ?? 0;
}

// institution_invites: only ever deletes a row that's both expired
// *and* never accepted — an accepted invite is a real membership-
// history record (still displayed by the admin invites list), never
// touched here regardless of age. This also fixes a real, previously-
// latent bug: the table's own partial unique index
// (institution_id, email where accepted_at is null) blocked re-inviting
// the same email once an old invite lapsed, until an admin specifically
// used "Resend" rather than "Invite" again — deleting the dead row
// removes that blocker.
export async function purgeExpiredInstitutionInvites(supabase: ReturnType<typeof createAdminClient>): Promise<number> {
  const { data, error } = await supabase
    .from("institution_invites")
    .delete()
    .is("accepted_at", null)
    .lt("expires_at", new Date().toISOString())
    .select("id");
  if (error) throw new Error(`Couldn't purge expired institution invites: ${error.message}`);
  return data?.length ?? 0;
}

export type PurgeExpiredDataResult = {
  quickScanResultsPurged: number;
  anonymousRateLimitsPurged: number;
  aiRateLimitWindowsPurged: number;
  institutionInvitesPurged: number;
  errors: string[];
};

/**
 * The scheduled sweep behind GET /api/cron/purge-expired-data. Every
 * step below is independent and runs even if an earlier one failed, so
 * one broken sweep never hides that the others still ran — the caller
 * gets every count that did succeed plus a list of what didn't, rather
 * than one failure collapsing the whole result into an opaque error.
 *
 * What's deliberately NOT swept here, and why, is written up in
 * docs/DATA_RETENTION.md — audit/compliance tables (admin_audit_logs,
 * billing_events, email_send_logs, data_export_logs) are durable by
 * design, not temporary, and access_codes/access_code_redemptions are
 * real business records, not ephemeral session state. Temporary audio
 * (voice interview speak/transcribe) and uploaded CV files
 * (/api/files/parse, Quick Scan's own upload) need no sweep at all —
 * neither is ever persisted anywhere in the first place.
 */
export async function purgeExpiredData(): Promise<PurgeExpiredDataResult> {
  const supabase = createAdminClient();
  const errors: string[] = [];

  async function run(label: string, sweep: () => Promise<number>): Promise<number> {
    try {
      return await sweep();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      console.error(`purgeExpiredData: ${label} failed:`, message);
      errors.push(`${label}: ${message}`);
      return 0;
    }
  }

  const quickScanResultsPurged = await run("quick_scan_results", () => purgeExpiredQuickScanResults(supabase));
  const anonymousRateLimitsPurged = await run("anonymous_rate_limits", () => purgeStaleAnonymousRateLimits(supabase));
  const aiRateLimitWindowsPurged = await run("ai_rate_limit_windows", () => purgeStaleAiRateLimitWindows(supabase));
  const institutionInvitesPurged = await run("institution_invites", () => purgeExpiredInstitutionInvites(supabase));

  return { quickScanResultsPurged, anonymousRateLimitsPurged, aiRateLimitWindowsPurged, institutionInvitesPurged, errors };
}
