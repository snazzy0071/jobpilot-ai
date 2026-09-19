import "server-only";
import { createClient } from "@/lib/supabase/server";
import { getAIEnv } from "@/lib/ai/env";
import { getStripeEnv } from "@/lib/stripe/env";
import { getEmailEnv } from "@/lib/email/env";
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
 * `sponsor_sync_status` carries "Anyone can view" RLS (built on top of
 * migration 0049's `sponsor_imports`, same policy), so the regular
 * client is enough. This pipeline genuinely has no ingestion job wired
 * up yet — that migration's own comment says so — so a row-less result
 * is the accurate "not configured" state, not a false alarm.
 */
export async function checkSponsorSync(): Promise<HealthCheckResult> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("sponsor_sync_status").select("completed_at").maybeSingle();
  if (error) return result("sponsor_sync", "Sponsor register sync", "down", `Query failed: ${error.message}`);
  if (!data?.completed_at) {
    return result(
      "sponsor_sync",
      "Sponsor register sync",
      "not_configured",
      "No sponsor sync has ever completed — no ingestion job is wired up yet.",
    );
  }
  return result("sponsor_sync", "Sponsor register sync", "operational", `Last completed sync: ${data.completed_at}.`);
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
