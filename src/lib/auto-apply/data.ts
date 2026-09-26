import "server-only";
import { createClient } from "@/lib/supabase/server";
import { DEFAULT_SETTINGS, type AutoApplySettings, type QueueEvent, type QueueItem, type QueueStatus } from "@/lib/auto-apply/types";

// Reads go through the signed-in user's own client (RLS: their rows only). Writes are in actions.ts, through the service role, after
// the plan, ownership and rules have been checked — users cannot write these tables through the API (migration 0118).

type SettingsRow = {
  enabled: boolean;
  paused: boolean;
  min_match_score: number;
  role_keywords: string[];
  locations: string[];
  min_salary: number | null;
  include_unknown_salary: boolean;
  sponsor_only: boolean;
  daily_limit: number;
  cv_id: string | null;
  cover_letter_id: string | null;
  consent_at: string | null;
  consent_version: string | null;
};

export const QUEUE_FIELDS =
  "id, job_id, company_name, job_title, location, apply_url, status, match_score, sponsor_status, cv_id, cover_letter_id, adapter, attempt_count, max_attempts, next_attempt_at, last_error, application_id, approved_at, applied_at, created_at";

export type QueueRow = {
  id: string;
  job_id: string | null;
  company_name: string;
  job_title: string;
  location: string | null;
  apply_url: string;
  status: QueueStatus;
  match_score: number | null;
  sponsor_status: string | null;
  cv_id: string | null;
  cover_letter_id: string | null;
  adapter: string | null;
  attempt_count: number;
  max_attempts: number;
  next_attempt_at: string | null;
  last_error: string | null;
  application_id: string | null;
  approved_at: string | null;
  applied_at: string | null;
  created_at: string;
};

export function toSettings(row: SettingsRow): AutoApplySettings {
  return {
    enabled: row.enabled,
    paused: row.paused,
    minMatchScore: row.min_match_score,
    roleKeywords: row.role_keywords,
    locations: row.locations,
    minSalary: row.min_salary,
    includeUnknownSalary: row.include_unknown_salary,
    sponsorOnly: row.sponsor_only,
    dailyLimit: row.daily_limit,
    cvId: row.cv_id,
    coverLetterId: row.cover_letter_id,
    consentAt: row.consent_at,
    consentVersion: row.consent_version,
  };
}

export function toQueueItem(row: QueueRow): QueueItem {
  return {
    id: row.id,
    jobId: row.job_id,
    companyName: row.company_name,
    jobTitle: row.job_title,
    location: row.location,
    applyUrl: row.apply_url,
    status: row.status,
    matchScore: row.match_score,
    sponsorStatus: row.sponsor_status,
    cvId: row.cv_id,
    coverLetterId: row.cover_letter_id,
    adapter: row.adapter,
    attemptCount: row.attempt_count,
    maxAttempts: row.max_attempts,
    nextAttemptAt: row.next_attempt_at,
    lastError: row.last_error,
    applicationId: row.application_id,
    approvedAt: row.approved_at,
    appliedAt: row.applied_at,
    createdAt: row.created_at,
  };
}

/** The user's settings, or the defaults when they've never saved any. Throws on a database error — an outage must not look like "not set up". */
export async function getAutoApplySettings(userId: string): Promise<AutoApplySettings> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("auto_apply_settings").select("*").eq("user_id", userId).maybeSingle();
  if (error) throw new Error("Couldn't load your Auto-Apply settings.");
  return data ? toSettings(data as SettingsRow) : DEFAULT_SETTINGS;
}

export async function listQueue(userId: string): Promise<QueueItem[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("auto_apply_queue").select(QUEUE_FIELDS).eq("user_id", userId).order("created_at", { ascending: false }).limit(300);
  if (error) throw new Error("Couldn't load your queue.");
  return ((data ?? []) as unknown as QueueRow[]).map(toQueueItem);
}

export async function listEvents(userId: string, limit = 60): Promise<QueueEvent[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("auto_apply_events").select("id, queue_id, event, detail, created_at").eq("user_id", userId).order("created_at", { ascending: false }).limit(limit);
  if (error) throw new Error("Couldn't load your history.");
  return (data ?? []).map((row) => ({ id: row.id, queueId: row.queue_id, event: row.event, detail: (row.detail ?? {}) as Record<string, unknown>, createdAt: row.created_at }));
}
