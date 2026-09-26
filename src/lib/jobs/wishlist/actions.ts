"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { getCvEditorData } from "@/lib/cvs/queries";
import { getJobById, getJobSourceName, getJobMatchesForCv } from "@/lib/jobs/queries";
import { matchJobToSponsor } from "@/lib/jobs/sponsor-match";
import { saveJobSchema, unsaveJobSchema, removeSavedJobSchema, updateSavedJobNotesSchema } from "@/lib/jobs/wishlist/schemas";
import type { SavedJob } from "@/lib/jobs/types";

export type SaveJobResult = { error: string } | { savedJob: SavedJob };
export type UnsaveJobResult = { error: string } | { success: true };

type SavedJobRow = {
  id: string;
  job_id: string | null;
  company_name: string;
  job_title: string;
  url: string;
  source_name: string;
  sponsor_status: SavedJob["sponsorStatus"];
  match_score: number | null;
  notes: string | null;
  created_at: string;
};

function toSavedJob(row: SavedJobRow): SavedJob {
  return {
    id: row.id,
    jobId: row.job_id,
    companyName: row.company_name,
    jobTitle: row.job_title,
    url: row.url,
    sourceName: row.source_name,
    sponsorStatus: row.sponsor_status,
    matchScore: row.match_score,
    notes: row.notes,
    createdAt: row.created_at,
  };
}

/**
 * One-click save — every field migration 0062 added to saved_jobs is
 * resolved here, server-side, from data this app itself already trusts
 * (getJobById, the live sponsor cross-reference, an existing
 * job_matches row), never accepted as client-submitted values even
 * though the calling card already has all of this on screen — a
 * client could otherwise submit a fabricated company name, sponsor
 * status, or score. `cvId` is the only thing the caller actually
 * supplies beyond the job id, and only to pick *which* CV's score (if
 * any) to snapshot; it's still re-verified as the requesting user's
 * own CV via getCvEditorData before anything is read from it.
 *
 * Idempotent-by-conflict rather than upsert: saved_jobs' own
 * unique(user_id, job_id) means a duplicate save is a real 23505,
 * reported as a plain "already saved" message rather than silently
 * overwriting the original snapshot (e.g. a since-changed match score
 * shouldn't quietly replace what the user actually saw when they first
 * saved it).
 */
export async function saveJob(input: { jobId: string; cvId?: string }): Promise<SaveJobResult> {
  const user = await requireUser();

  const parsed = saveJobSchema.safeParse(input);
  if (!parsed.success) return { error: "Invalid request." };

  const job = await getJobById(parsed.data.jobId);
  if (!job) return { error: "That job couldn't be found." };

  // A failed register lookup must not be saved as a sponsor status ("not found" would be a claim): ask the user to retry.
  let sponsorMatch;
  let sourceName;
  try {
    [sponsorMatch, sourceName] = await Promise.all([matchJobToSponsor(job.companyName), getJobSourceName(job.sourceId)]);
  } catch (err) {
    console.error("saveJob: sponsor check failed:", err);
    return { error: "Couldn't check the sponsor register just now — try again in a moment." };
  }

  let matchScore: number | null = null;
  if (parsed.data.cvId) {
    const cv = await getCvEditorData(user.id, parsed.data.cvId);
    if (cv) {
      const existing = await getJobMatchesForCv([job.id], cv.versionId);
      matchScore = existing.get(job.id)?.matchScore ?? null;
    }
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("saved_jobs")
    .insert({
      user_id: user.id,
      job_id: job.id,
      company_name: job.companyName,
      job_title: job.title,
      url: job.url,
      // job_sources rows are never deleted anywhere in this codebase,
      // so this should always resolve — the fallback only guards
      // against a genuine data-integrity gap, not normal operation.
      source_name: sourceName ?? "Unknown source",
      sponsor_status: sponsorMatch.status,
      match_score: matchScore,
    })
    .select("id, job_id, company_name, job_title, url, source_name, sponsor_status, match_score, notes, created_at")
    .single();

  if (error) {
    if (error.code === "23505") return { error: "You've already saved this job." };
    return { error: "Couldn't save that job — try again." };
  }

  revalidatePath("/dashboard/jobs");
  return { savedJob: toSavedJob(data) };
}

export async function unsaveJob(input: { jobId: string }): Promise<UnsaveJobResult> {
  const user = await requireUser();

  const parsed = unsaveJobSchema.safeParse(input);
  if (!parsed.success) return { error: "Invalid request." };

  const supabase = await createClient();
  const { error } = await supabase.from("saved_jobs").delete().eq("user_id", user.id).eq("job_id", parsed.data.jobId);
  if (error) return { error: "Couldn't remove that job — try again." };

  revalidatePath("/dashboard/jobs");
  return { success: true };
}

/** Remove one saved job by its own id: the saved page's remove, which also works for a job whose listing has since been pruned (no job id left to unsave by). */
export async function removeSavedJob(input: { savedJobId: string }): Promise<UnsaveJobResult> {
  const user = await requireUser();

  const parsed = removeSavedJobSchema.safeParse(input);
  if (!parsed.success) return { error: "Invalid request." };

  const supabase = await createClient();
  const { error } = await supabase.from("saved_jobs").delete().eq("id", parsed.data.savedJobId).eq("user_id", user.id);
  if (error) return { error: "Couldn't remove that job — try again." };

  revalidatePath("/dashboard/jobs");
  revalidatePath("/dashboard/jobs/saved");
  return { success: true };
}

export type SaveNotesResult = { error: string } | { notes: string | null };

/** The user's own note on a saved job (the only field of a saved job they edit: everything else is the snapshot taken when they saved it). */
export async function updateSavedJobNotes(input: { savedJobId: string; notes: string }): Promise<SaveNotesResult> {
  const user = await requireUser();

  const parsed = updateSavedJobNotesSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("saved_jobs")
    .update({ notes: parsed.data.notes })
    .eq("id", parsed.data.savedJobId)
    .eq("user_id", user.id)
    .select("notes")
    .maybeSingle();
  if (error) return { error: "Couldn't save that note — try again." };
  if (!data) return { error: "That saved job couldn't be found." };

  revalidatePath("/dashboard/jobs/saved");
  return { notes: data.notes };
}
