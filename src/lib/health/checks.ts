import "server-only";
import { createClient } from "@/lib/supabase/server";
import { getAIEnv } from "@/lib/ai/env";
import { getStripeEnv } from "@/lib/stripe/env";
import { getEmailEnv } from "@/lib/email/env";
import { deriveSponsorSyncState, SPONSOR_SYNC_STALE_AFTER_HOURS } from "@/lib/admin/sponsors/sync-state";
import type { HealthCheckResult, HealthStatus } from "@/lib/health/types";

// 4x the 6-hourly job-sync cron interval (vercel.json) — a real buffer
// against one missed run before calling a source "degraded", not a
// hair-trigger that flags every minor delay.
const STALE_JOB_SYNC_HOURS = 24;

function result(key: string, label: string, status: HealthStatus, detail: string): HealthCheckResult {
  return { key, label, status, detail, checkedAt: new Date().toISOString() };
}

/**
 * A live query against our own database — safe to run on every public
 * page load, unlike the config-presence-only checks below, because
 * it's our own infrastructure (already-provisioned, generous limits),
 * not a rate-limited or billed third-party API. 42P01 ("relation does
 * not exist") still means the request reached Postgres through
 * PostgREST with a valid key — that counts as reachable here,
 * independent of whether every table has been migrated in yet (same
 * reasoning this app's pre-existing /status check already used).
 */
export async function checkDatabase(): Promise<HealthCheckResult> {
  const supabase = await createClient();
  const { error } = await supabase.from("profiles").select("id", { count: "exact", head: true });
  if (!error || error.code === "42P01") return result("database", "Database", "operational", "Reachable via Supabase Postgres.");
  return result("database", "Database", "down", `Query failed: ${error.message}`);
}

/**
 * Config-presence only, never a live call to Anthropic — this module
 * is shared with the fully public, unauthenticated /status page, and a
 * real API call from there would add cost and rate-limit exposure to a
 * route anyone (or anything scraping it) can hit repeatedly. Every one
 * of `getAIEnv()`/`getStripeEnv()`/`getEmailEnv()` already throws a
 * plain, descriptive Error when its own env vars are missing (each
 * file's own "validated on demand, call at the point of use" comment)
 * — a health check *is* that point of use, so catching that throw is
 * both correct and requires no new validation logic.
 */
export async function checkAi(): Promise<HealthCheckResult> {
  try {
    getAIEnv();
    return result("ai", "AI (Claude)", "operational", "ANTHROPIC_API_KEY is configured.");
  } catch (error) {
    return result("ai", "AI (Claude)", "not_configured", error instanceof Error ? error.message : "Not configured.");
  }
}

/** Same config-presence-only reasoning as checkAi above — Stripe's own API has cheap, safe read-only calls, but a third-party network call still has no place on a shared, unauthenticated route regardless of whether that specific call happens to be free. */
export async function checkStripe(): Promise<HealthCheckResult> {
  try {
    getStripeEnv();
    return result("stripe", "Payments (Stripe)", "operational", "Stripe keys and price ids are configured.");
  } catch (error) {
    return result("stripe", "Payments (Stripe)", "not_configured", error instanceof Error ? error.message : "Not configured.");
  }
}

export async function checkEmail(): Promise<HealthCheckResult> {
  try {
    getEmailEnv();
    return result("email", "Email delivery", "operational", "RESEND_API_KEY and RESEND_FROM_EMAIL are configured.");
  } catch (error) {
    return result("email", "Email delivery", "not_configured", error instanceof Error ? error.message : "Not configured.");
  }
}

/**
 * The sponsor register syncs daily from the Home Office's published CSV (.github/workflows/sponsors-sync.yml).
 * `sponsor_sync_status` and `sponsor_imports` are readable by anyone, so the regular client is enough. Uses the same
 * derivation as the admin page (src/lib/admin/sponsors/sync-state.ts): a failed newest run or a last completed sync
 * older than the stale window is `degraded`; a register that has never synced is `down` (the public directory
 * is empty without it).
 */
export async function checkSponsorSync(): Promise<HealthCheckResult> {
  const supabase = await createClient();
  const [{ data: status, error }, { data: latest }] = await Promise.all([
    supabase.from("sponsor_sync_status").select("completed_at, source_date").maybeSingle(),
    supabase.from("sponsor_imports").select("status, started_at").order("started_at", { ascending: false }).limit(1).maybeSingle(),
  ]);
  if (error) return result("sponsor_sync", "Sponsor register sync", "down", `Query failed: ${error.message}`);

  const state = deriveSponsorSyncState({
    latestStatus: latest?.status ?? null,
    latestStartedAt: latest?.started_at ?? null,
    lastCompletedAt: status?.completed_at ?? null,
  });
  if (state === "never") return result("sponsor_sync", "Sponsor register sync", "down", "No sponsor sync has ever completed.");
  const lastOk = `Last completed sync: ${status?.completed_at} (register dated ${status?.source_date}).`;
  if (state === "failed") return result("sponsor_sync", "Sponsor register sync", "degraded", `The latest sync failed. ${lastOk}`);
  if (state === "stale") {
    return result("sponsor_sync", "Sponsor register sync", "degraded", `No completed sync in ${SPONSOR_SYNC_STALE_AFTER_HOURS} hours. ${lastOk}`);
  }
  return result("sponsor_sync", "Sponsor register sync", "operational", lastOk);
}

/**
 * Job sync (Adzuna/Reed) genuinely runs on a cron — unlike sponsor
 * sync, staleness here is a real signal, not a false alarm. Per active
 * source: no run ever recorded is `down` for that source; the most
 * recent run failing, or a completed run older than
 * STALE_JOB_SYNC_HOURS, is `degraded`; otherwise `operational`. The
 * overall result is the worst status across every active source.
 */
export async function checkJobSync(): Promise<HealthCheckResult> {
  const supabase = await createClient();
  // "manual" holds hand-entered listings and has no feed to sync — counting it made this check read "down: never synced" forever.
  const { data: sources, error: sourcesError } = await supabase
    .from("job_sources")
    .select("id, name")
    .eq("is_active", true)
    .neq("slug", "manual");
  if (sourcesError) return result("job_sync", "Job feed sync", "down", `Query failed: ${sourcesError.message}`);
  if (!sources || sources.length === 0) {
    return result("job_sync", "Job feed sync", "not_configured", "No active job sources configured.");
  }

  const staleCutoff = Date.now() - STALE_JOB_SYNC_HOURS * 60 * 60 * 1000;

  const perSource = await Promise.all(
    sources.map(async (source) => {
      const { data: lastRun } = await supabase
        .from("job_imports")
        .select("status, completed_at")
        .eq("source_id", source.id)
        .eq("run_type", "sync")
        .order("started_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!lastRun) return { name: source.name, status: "down" as HealthStatus, note: "never synced" };
      if (lastRun.status === "failed") return { name: source.name, status: "degraded" as HealthStatus, note: "last run failed" };
      if (!lastRun.completed_at || new Date(lastRun.completed_at).getTime() < staleCutoff) {
        return { name: source.name, status: "degraded" as HealthStatus, note: `stale since ${lastRun.completed_at ?? "unknown"}` };
      }
      return { name: source.name, status: "operational" as HealthStatus, note: `synced ${lastRun.completed_at}` };
    }),
  );

  const worst: HealthStatus = perSource.some((source) => source.status === "down")
    ? "down"
    : perSource.some((source) => source.status === "degraded")
      ? "degraded"
      : "operational";

  const detail = perSource.map((source) => `${source.name}: ${source.note}`).join("; ");
  return result("job_sync", "Job feed sync", worst, detail);
}

export async function runAllHealthChecks(): Promise<HealthCheckResult[]> {
  return Promise.all([checkDatabase(), checkAi(), checkStripe(), checkEmail(), checkSponsorSync(), checkJobSync()]);
}
