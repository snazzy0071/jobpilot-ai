"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { listCvs } from "@/lib/cvs/queries";
import { listCoverLetters } from "@/lib/cover-letters/queries";
import { getJobMatchesForCv } from "@/lib/jobs/queries";
import { matchJobsToSponsors } from "@/lib/jobs/sponsor-match";
import { addJobToTracker } from "@/lib/jobs/tracker/actions";
import { createApplication, updateApplicationStatus } from "@/lib/applications/actions";
import { listApplications } from "@/lib/applications/queries";
import { gateAutoApply } from "@/lib/auto-apply/access";
import { getAutoApplySettings, QUEUE_FIELDS, toQueueItem, type QueueRow } from "@/lib/auto-apply/data";
import { dedupeKey, evaluateJob, remainingToday, ukDayWindow, type EligibilityReason } from "@/lib/auto-apply/eligibility";
import { resolveAdapter } from "@/lib/auto-apply/adapters/registry";
import { dueItems, runAttempt } from "@/lib/auto-apply/runner";
import { approveSchema, pausedSchema, queueIdSchema, settingsSchema } from "@/lib/auto-apply/schemas";
import { CONSENT_VERSION, LIMITS, type JobFacts, type QueueItem } from "@/lib/auto-apply/types";

// ASSISTED Auto-Apply. Every action here: checks the user is signed in and their PLAN includes it (gateAutoApply), validates the
// input, checks ownership of anything an id points at, and writes through the service role (users can't write these tables — see
// migration 0118) while recording an audit event. Nothing is ever applied for without the user's approval of that application, and
// nothing here tries to get past a site's protections: where software can't apply, the user is handed the link.

export type Failure = { error: string; locked?: true };
export type Result<T = object> = Failure | ({ ok: true } & T);

async function context(): Promise<{ user: { id: string }; admin: ReturnType<typeof createAdminClient> } | Failure> {
  const user = await requireUser();
  const locked = await gateAutoApply(user.id);
  if (locked) return locked;
  return { user, admin: createAdminClient() };
}

async function log(admin: ReturnType<typeof createAdminClient>, userId: string, queueId: string | null, event: string, detail: Record<string, unknown> = {}) {
  const { error } = await admin.from("auto_apply_events").insert({ user_id: userId, queue_id: queueId, event, detail });
  if (error) console.error("auto-apply audit write failed:", error.message);
}

function refresh() {
  revalidatePath("/dashboard/auto-apply");
  revalidatePath("/dashboard/applications");
}

async function ownsDocuments(userId: string, cvId: string | null, coverLetterId: string | null): Promise<string | null> {
  if (cvId && !(await listCvs(userId)).some((cv) => cv.id === cvId && !cv.isArchived)) return "That CV couldn't be found.";
  if (coverLetterId && !(await listCoverLetters(userId)).some((letter) => letter.id === coverLetterId)) return "That cover letter couldn't be found.";
  return null;
}

// ---- settings, pause / resume ---------------------------------------------------------------------------------------------

export async function saveAutoApplySettings(formData: FormData): Promise<Result> {
  const ctx = await context();
  if ("error" in ctx) return ctx;

  const parsed = settingsSchema.safeParse({
    enabled: formData.get("enabled") === "on",
    minMatchScore: formData.get("minMatchScore"),
    roleKeywords: (formData.get("roleKeywords") as string | null) ?? "",
    locations: (formData.get("locations") as string | null) ?? "",
    minSalary: (formData.get("minSalary") as string | null) ?? "",
    includeUnknownSalary: formData.get("includeUnknownSalary") === "on",
    sponsorOnly: formData.get("sponsorOnly") === "on",
    dailyLimit: formData.get("dailyLimit"),
    cvId: formData.get("cvId"),
    coverLetterId: formData.get("coverLetterId"),
    consent: formData.get("consent") === "on",
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const data = parsed.data;

  const docError = await ownsDocuments(ctx.user.id, data.cvId, data.coverLetterId);
  if (docError) return { error: docError };
  if (data.enabled && !data.cvId) return { error: "Choose the CV to apply with before turning Auto-Apply on." };

  const before = await getAutoApplySettings(ctx.user.id);
  const consentCurrent = before.consentAt !== null && before.consentVersion === CONSENT_VERSION;
  if (data.enabled && !consentCurrent && !data.consent) return { error: "Please confirm you understand how Auto-Apply works before turning it on." };
  const giveConsent = data.consent && !consentCurrent;

  const { error } = await ctx.admin.from("auto_apply_settings").upsert(
    {
      user_id: ctx.user.id,
      enabled: data.enabled,
      min_match_score: data.minMatchScore,
      role_keywords: data.roleKeywords,
      locations: data.locations,
      min_salary: data.minSalary,
      include_unknown_salary: data.includeUnknownSalary,
      sponsor_only: data.sponsorOnly,
      daily_limit: data.dailyLimit,
      cv_id: data.cvId,
      cover_letter_id: data.coverLetterId,
      ...(giveConsent ? { consent_at: new Date().toISOString(), consent_version: CONSENT_VERSION } : {}),
    },
    { onConflict: "user_id" },
  );
  if (error) return { error: "Couldn't save your settings — try again." };

  if (giveConsent) await log(ctx.admin, ctx.user.id, null, "consent_given", { version: CONSENT_VERSION });
  if (data.enabled !== before.enabled) await log(ctx.admin, ctx.user.id, null, data.enabled ? "enabled" : "disabled");
  await log(ctx.admin, ctx.user.id, null, "settings_changed", { minMatchScore: data.minMatchScore, dailyLimit: data.dailyLimit, sponsorOnly: data.sponsorOnly, roles: data.roleKeywords.length, locations: data.locations.length, hasMinSalary: data.minSalary !== null });
  refresh();
  return { ok: true };
}

export async function setAutoApplyPaused(input: { paused: boolean }): Promise<Result> {
  const ctx = await context();
  if ("error" in ctx) return ctx;
  const parsed = pausedSchema.safeParse(input);
  if (!parsed.success) return { error: "Invalid request." };

  const { error } = await ctx.admin.from("auto_apply_settings").upsert({ user_id: ctx.user.id, paused: parsed.data.paused }, { onConflict: "user_id" });
  if (error) return { error: "Couldn't update that — try again." };
  await log(ctx.admin, ctx.user.id, null, parsed.data.paused ? "paused" : "resumed");
  refresh();
  return { ok: true };
}

// ---- finding matches ------------------------------------------------------------------------------------------------------

export type FindResult = Result<{ added: number; considered: number; duplicates: number; skipped: Partial<Record<EligibilityReason, number>> }>;

/**
 * Builds the review queue from jobs already in the feed. It uses ONLY match scores the user has already produced for their chosen CV
 * (no new AI call, no charge) — a job with no score isn't eligible, and the result says how many were left out for that reason.
 * Jobs already in the queue, or already applied for in the tracker (by listing, or by employer + title through another feed), are
 * never queued again. The review queue is capped, and nothing here approves anything.
 */
export async function findMatchingJobs(): Promise<FindResult> {
  const ctx = await context();
  if ("error" in ctx) return ctx;

  const settings = await getAutoApplySettings(ctx.user.id);
  if (!settings.enabled) return { error: "Turn Auto-Apply on in your settings first." };
  if (settings.paused) return { error: "Auto-Apply is paused — resume it to find matches." };
  if (!settings.cvId) return { error: "Choose the CV to apply with first." };

  const supabase = await createClient();
  const { data: version } = await supabase.from("cv_versions").select("id").eq("cv_id", settings.cvId).eq("user_id", ctx.user.id).eq("is_current", true).maybeSingle();
  if (!version) return { error: "That CV couldn't be found — choose another." };

  const { data: jobRows, error: jobsError } = await supabase
    .from("jobs")
    .select("id, title, company_name, location, url, is_active")
    .eq("is_active", true)
    .order("posted_at", { ascending: false, nullsFirst: false })
    .limit(300);
  if (jobsError) return { error: "Couldn't load jobs — try again." };
  const jobs = jobRows ?? [];

  const [matches, queueRes, applications] = await Promise.all([
    getJobMatchesForCv(jobs.map((job) => job.id), version.id),
    ctx.admin.from("auto_apply_queue").select("job_id, dedupe_key, status").eq("user_id", ctx.user.id),
    listApplications(ctx.user.id),
  ]);
  if (queueRes.error) return { error: "Couldn't check your queue — try again." };

  const takenJobs = new Set((queueRes.data ?? []).map((row) => row.job_id).filter(Boolean));
  const takenKeys = new Set((queueRes.data ?? []).map((row) => row.dedupe_key));
  // Already applied for through the tracker (a Wishlist entry is only interest, so it doesn't block).
  const appliedStatuses = new Set(["applied", "interview", "offer", "rejected"]);
  for (const application of applications) {
    if (!appliedStatuses.has(application.status)) continue;
    if (application.jobId) takenJobs.add(application.jobId);
    takenKeys.add(dedupeKey(application.companyName, application.jobTitle));
  }
  const pending = (queueRes.data ?? []).filter((row) => row.status === "pending_review").length;
  let capacity = Math.max(0, LIMITS.maxPending - pending);

  const skipped: Partial<Record<EligibilityReason, number>> = {};
  let duplicates = 0;
  const seenNow = new Set<string>();
  const facts = (job: (typeof jobs)[number], sponsorConfirmed: boolean): JobFacts => ({
    jobId: job.id,
    title: job.title,
    company: job.company_name,
    location: job.location,
    applyUrl: job.url,
    matchScore: matches.get(job.id)?.matchScore ?? null,
    sponsorConfirmed,
    salaryMin: null, // the feeds publish no structured salary
    active: job.is_active,
  });

  // Phase 1: every rule except sponsorship (the register lookup is batched, and only needed for jobs that get this far).
  const candidates: (typeof jobs)[number][] = [];
  for (const job of jobs) {
    const key = dedupeKey(job.company_name, job.title);
    if (takenJobs.has(job.id) || takenKeys.has(key) || seenNow.has(key)) {
      duplicates += 1;
      continue;
    }
    const result = evaluateJob(settings, facts(job, true));
    if (!result.eligible) {
      for (const reason of result.reasons) skipped[reason] = (skipped[reason] ?? 0) + 1;
      continue;
    }
    seenNow.add(key);
    candidates.push(job);
  }

  const sponsors = candidates.length > 0 ? await matchJobsToSponsors(candidates.map((job) => job.company_name)) : new Map();
  const rows: Record<string, unknown>[] = [];
  for (const job of candidates) {
    const status = sponsors.get(job.company_name.trim())?.status ?? "unconfirmed";
    const result = evaluateJob(settings, facts(job, status === "confirmed_sponsor"));
    if (!result.eligible) {
      for (const reason of result.reasons) skipped[reason] = (skipped[reason] ?? 0) + 1;
      continue;
    }
    if (capacity <= 0) break;
    capacity -= 1;
    rows.push({
      user_id: ctx.user.id,
      job_id: job.id,
      company_name: job.company_name,
      job_title: job.title,
      location: job.location,
      apply_url: job.url,
      dedupe_key: dedupeKey(job.company_name, job.title),
      status: "pending_review",
      match_score: matches.get(job.id)?.matchScore ?? null,
      sponsor_status: status,
      cv_id: settings.cvId,
      cover_letter_id: settings.coverLetterId,
    });
  }

  let added = 0;
  if (rows.length > 0) {
    const { data: inserted, error } = await ctx.admin.from("auto_apply_queue").upsert(rows, { onConflict: "user_id,dedupe_key", ignoreDuplicates: true }).select("id, job_title, company_name, match_score");
    if (error) return { error: "Couldn't queue those jobs — try again." };
    added = inserted?.length ?? 0;
    if (inserted && inserted.length > 0) {
      await ctx.admin.from("auto_apply_events").insert(inserted.map((row) => ({ user_id: ctx.user.id, queue_id: row.id, event: "queued", detail: { matchScore: row.match_score } })));
    }
  }
  await log(ctx.admin, ctx.user.id, null, "search", { considered: jobs.length, added, duplicates });
  refresh();
  return { ok: true, added, considered: jobs.length, duplicates, skipped };
}

// ---- review, approval, processing -----------------------------------------------------------------------------------------

async function loadItem(admin: ReturnType<typeof createAdminClient>, userId: string, id: string): Promise<QueueItem | null> {
  const { data } = await admin.from("auto_apply_queue").select(QUEUE_FIELDS).eq("id", id).eq("user_id", userId).maybeSingle();
  return data ? toQueueItem(data as unknown as QueueRow) : null;
}

/** Puts an application into the user's tracker as Applied (the job link and CV snapshot rules are the tracker's own). Returns the tracker id. */
async function logInTracker(userId: string, item: QueueItem): Promise<{ applicationId: string } | Failure> {
  let applicationId: string | null = null;
  if (item.jobId) {
    const tracked = await addJobToTracker({ jobId: item.jobId, cvId: item.cvId ?? undefined });
    if (!("error" in tracked)) applicationId = tracked.applicationId;
  }
  if (!applicationId) {
    // The listing may be gone: the queue item carries its own snapshot of the employer, title and link.
    const form = new FormData();
    form.set("companyName", item.companyName);
    form.set("jobTitle", item.jobTitle);
    if (item.location) form.set("location", item.location);
    form.set("url", item.applyUrl);
    form.set("status", "wishlist");
    if (item.cvId) form.set("cvId", item.cvId);
    const created = await createApplication(form);
    if ("error" in created) return { error: created.error };
    applicationId = created.application.id;
  }
  const moved = await updateApplicationStatus({ id: applicationId, status: "applied" });
  if ("error" in moved) return { error: moved.error };
  if (item.coverLetterId) {
    const supabase = await createClient();
    await supabase.from("applications").update({ cover_letter_id: item.coverLetterId }).eq("id", applicationId).eq("user_id", userId);
  }
  return { applicationId };
}

/** One attempt for one approved item, claimed first so two requests can't process it twice. */
async function attempt(admin: ReturnType<typeof createAdminClient>, userId: string, item: QueueItem): Promise<QueueItem["status"] | null> {
  const { data: claimed } = await admin.from("auto_apply_queue").update({ status: "processing" }).eq("id", item.id).eq("user_id", userId).eq("status", "approved").select("id").maybeSingle();
  if (!claimed) return null; // someone else has it, or it is no longer approved

  const adapter = resolveAdapter(item.applyUrl);
  const result = await runAttempt({ attemptCount: item.attemptCount, maxAttempts: item.maxAttempts, hasApplyUrl: item.applyUrl.length > 0 }, adapter, { queueId: item.id, applyUrl: item.applyUrl, companyName: item.companyName, jobTitle: item.jobTitle, cvId: item.cvId, coverLetterId: item.coverLetterId }, new Date());

  let applicationId: string | null = null;
  const event = result.event;
  if (result.sent) {
    // Really sent by an adapter: record it in the tracker. If that fails the application is still marked applied (it was sent).
    const tracked = await logInTracker(userId, item);
    if ("applicationId" in tracked) applicationId = tracked.applicationId;
    else await log(admin, userId, item.id, "tracker_log_failed", { adapter: adapter.id });
  }

  await admin
    .from("auto_apply_queue")
    .update({
      status: result.status,
      attempt_count: result.attemptCount,
      next_attempt_at: result.nextAttemptAt ? result.nextAttemptAt.toISOString() : null,
      last_error: result.lastError,
      adapter: adapter.id,
      application_id: applicationId,
      ...(result.status === "applied" ? { applied_at: new Date().toISOString() } : {}),
    })
    .eq("id", item.id)
    .eq("user_id", userId);
  await log(admin, userId, item.id, event, { adapter: adapter.id, attempt: result.attemptCount, status: result.status, ...(result.lastError ? { reason: result.lastError } : {}) });
  return result.status;
}

export async function approveQueueItem(input: { id: string; cvId?: string | null; coverLetterId?: string | null }): Promise<Result<{ status: string }>> {
  const ctx = await context();
  if ("error" in ctx) return ctx;
  const parsed = approveSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const settings = await getAutoApplySettings(ctx.user.id);
  if (!settings.enabled) return { error: "Auto-Apply is turned off." };
  if (settings.paused) return { error: "Auto-Apply is paused — resume it before approving applications." };

  const item = await loadItem(ctx.admin, ctx.user.id, parsed.data.id);
  if (!item) return { error: "That application couldn't be found." };
  if (item.status !== "pending_review") return { error: "That application has already been dealt with." };

  const cvId = parsed.data.cvId !== undefined ? parsed.data.cvId : item.cvId;
  const coverLetterId = parsed.data.coverLetterId !== undefined ? parsed.data.coverLetterId : item.coverLetterId;
  if (!cvId) return { error: "Choose a CV for this application first." };
  const docError = await ownsDocuments(ctx.user.id, cvId, coverLetterId);
  if (docError) return { error: docError };

  // Duplicate prevention at the moment it matters: already applied for since it was queued? Then withdraw it instead.
  const applications = await listApplications(ctx.user.id);
  const appliedBefore = applications.some((a) => ["applied", "interview", "offer", "rejected"].includes(a.status) && ((item.jobId && a.jobId === item.jobId) || dedupeKey(a.companyName, a.jobTitle) === dedupeKey(item.companyName, item.jobTitle)));
  if (appliedBefore) {
    await ctx.admin.from("auto_apply_queue").update({ status: "cancelled", last_error: "Already applied for — it's in your tracker." }).eq("id", item.id).eq("user_id", ctx.user.id);
    await log(ctx.admin, ctx.user.id, item.id, "duplicate_prevented", {});
    refresh();
    return { error: "You've already applied for this one — it's in your tracker, so it was removed from the queue." };
  }

  // Daily limit: approvals in today's UK calendar day.
  const { start, end } = ukDayWindow();
  const { count } = await ctx.admin.from("auto_apply_queue").select("id", { count: "exact", head: true }).eq("user_id", ctx.user.id).gte("approved_at", start.toISOString()).lt("approved_at", end.toISOString());
  if (remainingToday(settings.dailyLimit, count ?? 0) <= 0) return { error: `You've reached today's limit of ${settings.dailyLimit}. It resets at midnight UK time.` };

  const adapter = resolveAdapter(item.applyUrl);
  const { data: approved } = await ctx.admin
    .from("auto_apply_queue")
    .update({ status: "approved", approved_at: new Date().toISOString(), cv_id: cvId, cover_letter_id: coverLetterId, adapter: adapter.id })
    .eq("id", item.id)
    .eq("user_id", ctx.user.id)
    .eq("status", "pending_review")
    .select(QUEUE_FIELDS)
    .maybeSingle();
  if (!approved) return { error: "That application has already been dealt with." };
  await log(ctx.admin, ctx.user.id, item.id, "approved", { adapter: adapter.id, hasCoverLetter: coverLetterId !== null });

  const status = (await attempt(ctx.admin, ctx.user.id, toQueueItem(approved as unknown as QueueRow))) ?? "approved";
  refresh();
  return { ok: true, status };
}

/** Runs every approved item whose retry time has come (at most 10 a time). Does nothing while paused. */
export async function processDueQueue(): Promise<Result<{ processed: number }>> {
  const ctx = await context();
  if ("error" in ctx) return ctx;
  const settings = await getAutoApplySettings(ctx.user.id);
  if (settings.paused) return { error: "Auto-Apply is paused — resume it to process the queue." };
  if (!settings.enabled) return { error: "Auto-Apply is turned off." };

  const { data } = await ctx.admin.from("auto_apply_queue").select(QUEUE_FIELDS).eq("user_id", ctx.user.id).eq("status", "approved");
  const due = dueItems(((data ?? []) as unknown as QueueRow[]).map(toQueueItem), new Date()).slice(0, 10);
  let processed = 0;
  for (const item of due) {
    if ((await attempt(ctx.admin, ctx.user.id, item)) !== null) processed += 1;
  }
  refresh();
  return { ok: true, processed };
}

/** "I've applied": the user did it by hand on the employer's site. Logs it in the tracker, then closes the item. */
export async function confirmApplied(input: { id: string }): Promise<Result> {
  const ctx = await context();
  if ("error" in ctx) return ctx;
  const parsed = queueIdSchema.safeParse(input);
  if (!parsed.success) return { error: "Invalid request." };

  const item = await loadItem(ctx.admin, ctx.user.id, parsed.data.id);
  if (!item) return { error: "That application couldn't be found." };
  if (item.status !== "needs_manual") return { error: "That application isn't waiting for you to apply." };

  const tracked = await logInTracker(ctx.user.id, item);
  if ("error" in tracked) return { error: `We couldn't add it to your tracker: ${tracked.error} Nothing has changed — try again.` };

  const { data: updated } = await ctx.admin
    .from("auto_apply_queue")
    .update({ status: "applied", applied_at: new Date().toISOString(), application_id: tracked.applicationId })
    .eq("id", item.id)
    .eq("user_id", ctx.user.id)
    .eq("status", "needs_manual")
    .select("id")
    .maybeSingle();
  if (!updated) return { error: "That application has already been dealt with." };
  await log(ctx.admin, ctx.user.id, item.id, "applied_confirmed", { by: "user" });
  refresh();
  return { ok: true };
}

/** Skip it (not for me) or withdraw an approved one that hasn't gone anywhere. */
export async function dismissQueueItem(input: { id: string }): Promise<Result> {
  const ctx = await context();
  if ("error" in ctx) return ctx;
  const parsed = queueIdSchema.safeParse(input);
  if (!parsed.success) return { error: "Invalid request." };

  const item = await loadItem(ctx.admin, ctx.user.id, parsed.data.id);
  if (!item) return { error: "That application couldn't be found." };
  const next = item.status === "pending_review" || item.status === "needs_manual" ? "skipped" : item.status === "approved" ? "cancelled" : null;
  if (!next) return { error: "That application can't be changed any more." };

  const { data: updated } = await ctx.admin.from("auto_apply_queue").update({ status: next }).eq("id", item.id).eq("user_id", ctx.user.id).eq("status", item.status).select("id").maybeSingle();
  if (!updated) return { error: "That application has already been dealt with." };
  await log(ctx.admin, ctx.user.id, item.id, next === "skipped" ? "skipped" : "cancelled", { from: item.status });
  refresh();
  return { ok: true };
}
