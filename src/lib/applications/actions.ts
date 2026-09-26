"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { listCvs } from "@/lib/cvs/queries";
import { listCoverLetters } from "@/lib/cover-letters/queries";
import { resolveSnapshotFreeze, SnapshotError, type SnapshotFields } from "@/lib/applications/snapshot";
import {
  createApplicationSchema,
  updateApplicationSchema,
  deleteApplicationSchema,
  updateApplicationStatusSchema,
} from "@/lib/applications/schemas";
import { getApplicationById, toApplication, APPLICATION_SELECT_FIELDS } from "@/lib/applications/queries";
import type { Application } from "@/lib/applications/types";

export type ApplicationActionResult = { error: string } | { application: Application };
export type ApplicationMutationResult = { error: string } | { success: string } | void;

/** resolveSnapshotFreeze, with a failure turned into a message for the person instead of an unhandled throw. */
async function resolveSnapshot(params: Parameters<typeof resolveSnapshotFreeze>[0]): Promise<{ snapshot: SnapshotFields } | { error: string }> {
  try {
    return { snapshot: await resolveSnapshotFreeze(params) };
  } catch (err) {
    if (err instanceof SnapshotError) return { error: err.message };
    console.error("resolveSnapshot failed:", err);
    return { error: "Couldn't save that application — try again." };
  }
}

/** The form's "None" options carry a placeholder value ("__no_cv__"); that means no link, not an invalid id. */
function idOrUndefined(value: FormDataEntryValue | null): string | undefined {
  return typeof value === "string" && value !== "" && !value.startsWith("__") ? value : undefined;
}

function applicationInputFromFormData(formData: FormData) {
  return {
    companyName: formData.get("companyName"),
    jobTitle: formData.get("jobTitle"),
    location: formData.get("location") || undefined,
    salary: formData.get("salary") || undefined,
    url: formData.get("url") || undefined,
    deadline: formData.get("deadline") || undefined,
    notes: formData.get("notes") || undefined,
    status: formData.get("status"),
    cvId: idOrUndefined(formData.get("cvId")),
    coverLetterId: idOrUndefined(formData.get("coverLetterId")),
  };
}

/** Confirms a picked cvId/coverLetterId genuinely belongs to this user — the foreign key alone only checks the row exists, not who owns it (migration 0064's own comment on why this check has to live here). Returns an error string, or null when everything given (if anything) checks out. */
async function verifyOwnedLinks(userId: string, cvId: string | null, coverLetterId: string | null): Promise<string | null> {
  if (cvId) {
    const cvs = await listCvs(userId);
    if (!cvs.some((cv) => cv.id === cvId)) return "That CV couldn't be found.";
  }
  if (coverLetterId) {
    const coverLetters = await listCoverLetters(userId);
    if (!coverLetters.some((letter) => letter.id === coverLetterId)) return "That cover letter couldn't be found.";
  }
  return null;
}

/**
 * `sponsorStatus`/`matchScore`/`submittedCvVersionId`/`frozenAt` are
 * always resolved via `resolveSnapshotFreeze`
 * (src/lib/applications/snapshot.ts) — never user-typed. A new
 * application has no `existing` snapshot yet, so this only ever
 * freezes here if it's created directly at `status: 'applied'`
 * (skipping Wishlist entirely); otherwise it behaves exactly as before
 * — `sponsorStatus` resolved live, nothing else set yet.
 */
export async function createApplication(formData: FormData): Promise<ApplicationActionResult> {
  const user = await requireUser();

  const parsed = createApplicationSchema.safeParse(applicationInputFromFormData(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const ownershipError = await verifyOwnedLinks(user.id, parsed.data.cvId, parsed.data.coverLetterId);
  if (ownershipError) return { error: ownershipError };

  const resolved = await resolveSnapshot({
    userId: user.id,
    companyName: parsed.data.companyName,
    jobTitle: parsed.data.jobTitle,
    cvId: parsed.data.cvId,
    jobId: null,
    newStatus: parsed.data.status,
    existing: null,
  });
  if ("error" in resolved) return { error: resolved.error };
  const snapshot = resolved.snapshot;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("applications")
    .insert({
      user_id: user.id,
      company_name: parsed.data.companyName,
      job_title: parsed.data.jobTitle,
      location: parsed.data.location,
      salary: parsed.data.salary,
      url: parsed.data.url,
      deadline: parsed.data.deadline,
      notes: parsed.data.notes,
      status: parsed.data.status,
      cv_id: parsed.data.cvId,
      cover_letter_id: parsed.data.coverLetterId,
      sponsor_status: snapshot.sponsorStatus,
      match_score: snapshot.matchScore,
      submitted_cv_version_id: snapshot.submittedCvVersionId,
      frozen_at: snapshot.frozenAt,
    })
    .select(APPLICATION_SELECT_FIELDS)
    .single();

  if (error || !data) return { error: "Couldn't save that application — try again." };

  revalidatePath("/dashboard/applications");
  return { application: toApplication(data) };
}

export async function updateApplication(
  _prevState: ApplicationMutationResult,
  formData: FormData,
): Promise<ApplicationMutationResult> {
  const user = await requireUser();

  const parsed = updateApplicationSchema.safeParse({ id: formData.get("id"), ...applicationInputFromFormData(formData) });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const existing = await getApplicationById(user.id, parsed.data.id);
  if (!existing) return { error: "That application couldn't be found." };

  const ownershipError = await verifyOwnedLinks(user.id, parsed.data.cvId, parsed.data.coverLetterId);
  if (ownershipError) return { error: ownershipError };

  // Once existing.frozenAt is set, resolveSnapshotFreeze returns these
  // four fields completely untouched — companyName/cvId edited here
  // can no longer change what was frozen at Applied. Migration 0065's
  // own trigger is the backstop if this call site (or any future one)
  // ever fails to honour that.
  const resolved = await resolveSnapshot({
    userId: user.id,
    companyName: parsed.data.companyName,
    jobTitle: parsed.data.jobTitle,
    cvId: parsed.data.cvId,
    jobId: existing.jobId,
    newStatus: parsed.data.status,
    existing: {
      sponsorStatus: existing.sponsorStatus,
      matchScore: existing.matchScore,
      submittedCvVersionId: existing.submittedCvVersionId,
      frozenAt: existing.frozenAt,
    },
  });
  if ("error" in resolved) return { error: resolved.error };
  const snapshot = resolved.snapshot;

  const supabase = await createClient();
  const { error } = await supabase
    .from("applications")
    .update({
      company_name: parsed.data.companyName,
      job_title: parsed.data.jobTitle,
      location: parsed.data.location,
      salary: parsed.data.salary,
      url: parsed.data.url,
      deadline: parsed.data.deadline,
      notes: parsed.data.notes,
      status: parsed.data.status,
      cv_id: parsed.data.cvId,
      cover_letter_id: parsed.data.coverLetterId,
      sponsor_status: snapshot.sponsorStatus,
      match_score: snapshot.matchScore,
      submitted_cv_version_id: snapshot.submittedCvVersionId,
      frozen_at: snapshot.frozenAt,
    })
    .eq("id", parsed.data.id)
    .eq("user_id", user.id);

  if (error) return { error: "Couldn't save that application — try again." };

  revalidatePath("/dashboard/applications");
  revalidatePath(`/dashboard/applications/${parsed.data.id}/edit`);
  return { success: "Saved." };
}

/** The application as the server stored it after the move: it carries the freeze (sponsor state, score, submitted CV copy) and applied date that the move may have set. */
export type UpdateApplicationStatusResult = { error: string } | { application: Application };

/**
 * The kanban/table's own move — id + new status, but now also
 * carrying whatever freeze `resolveSnapshotFreeze` decides this move
 * triggers (first arrival at 'applied') or leaves alone (everything
 * else, including every move once already frozen). Still never
 * touches any other field on the row — scoped by `.eq("id",
 * ...).eq("user_id", user.id)` alongside RLS, same as before.
 *
 * Nothing here writes to application_status_history directly — that
 * table is written by migration 0063's own
 * `log_application_status_change` trigger, which fires automatically
 * on this exact `update of status`.
 */
export async function updateApplicationStatus(input: {
  id: string;
  status: Application["status"];
}): Promise<UpdateApplicationStatusResult> {
  const user = await requireUser();

  const parsed = updateApplicationStatusSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const existing = await getApplicationById(user.id, parsed.data.id);
  if (!existing) return { error: "That application couldn't be found." };

  const resolved = await resolveSnapshot({
    userId: user.id,
    companyName: existing.companyName,
    jobTitle: existing.jobTitle,
    cvId: existing.cvId,
    jobId: existing.jobId,
    newStatus: parsed.data.status,
    existing: {
      sponsorStatus: existing.sponsorStatus,
      matchScore: existing.matchScore,
      submittedCvVersionId: existing.submittedCvVersionId,
      frozenAt: existing.frozenAt,
    },
  });
  if ("error" in resolved) return { error: resolved.error };
  const snapshot = resolved.snapshot;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("applications")
    .update({
      status: parsed.data.status,
      sponsor_status: snapshot.sponsorStatus,
      match_score: snapshot.matchScore,
      submitted_cv_version_id: snapshot.submittedCvVersionId,
      frozen_at: snapshot.frozenAt,
    })
    .eq("id", parsed.data.id)
    .eq("user_id", user.id)
    .select(APPLICATION_SELECT_FIELDS)
    .maybeSingle();

  if (error) return { error: "Couldn't move that card — try again." };
  if (!data) return { error: "That application couldn't be found." };

  revalidatePath("/dashboard/applications");
  revalidatePath("/dashboard/applications/analytics");
  return { application: toApplication(data) };
}

export async function deleteApplication(
  _prevState: ApplicationMutationResult,
  formData: FormData,
): Promise<ApplicationMutationResult> {
  const user = await requireUser();

  const parsed = deleteApplicationSchema.safeParse({ id: formData.get("id") });
  if (!parsed.success) return { error: "Invalid request." };

  const supabase = await createClient();
  const { error } = await supabase.from("applications").delete().eq("id", parsed.data.id).eq("user_id", user.id);
  if (error) return { error: "Couldn't delete that application — try again." };

  revalidatePath("/dashboard/applications");
  return { success: "Deleted." };
}
