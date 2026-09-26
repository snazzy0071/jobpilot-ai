"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { listCvs } from "@/lib/cvs/queries";
import { getJobById } from "@/lib/jobs/queries";
import { resolveSnapshotFreeze, SnapshotError } from "@/lib/applications/snapshot";
import { addJobToTrackerSchema } from "@/lib/jobs/tracker/schemas";

export type AddJobToTrackerResult = { error: string } | { applicationId: string; alreadyTracked: boolean };

/** The job facts an application starts from — read server-side from the listing (or the saved snapshot), never from what the browser says. */
type TrackerSeed = {
  jobId: string | null;
  companyName: string;
  jobTitle: string;
  location: string | null;
  url: string;
  deadline: string | null;
};

async function findExistingApplicationId(userId: string, seed: TrackerSeed): Promise<string | null> {
  const supabase = await createClient();
  let query = supabase.from("applications").select("id").eq("user_id", userId).limit(1);
  // A live job is unique per (user, job) in the database. A saved job whose listing is gone has no job id; its own
  // posting link is the identity it has.
  query = seed.jobId ? query.eq("job_id", seed.jobId) : query.eq("url", seed.url);
  const { data } = await query.maybeSingle();
  return data?.id ?? null;
}

/**
 * "Add to tracker": turns a job from the feed (or a saved job) into a Wishlist application, linked to the listing.
 * The company, title, location, link and deadline come from the job row itself; the sponsor status is resolved live
 * from the register through the same snapshot rule the tracker uses everywhere (src/lib/applications/snapshot.ts) —
 * nothing here trusts the caller beyond the job id. The match score is deliberately not copied: the tracker freezes it
 * (with the CV version) when the application first reaches Applied, from the job link and CV set here.
 *
 * Idempotent: a job already in the tracker returns that application instead of creating a second one. The database
 * enforces it too (unique per user + job), so two quick clicks can't race past the check.
 */
export async function addJobToTracker(input: { jobId?: string; savedJobId?: string; cvId?: string }): Promise<AddJobToTrackerResult> {
  const user = await requireUser();

  const parsed = addJobToTrackerSchema.safeParse(input);
  if (!parsed.success) return { error: "Invalid request." };

  const supabase = await createClient();
  let seed: TrackerSeed;
  if (parsed.data.jobId) {
    const job = await getJobById(parsed.data.jobId);
    if (!job) return { error: "That job is no longer listed." };
    seed = {
      jobId: job.id,
      companyName: job.companyName,
      jobTitle: job.title,
      location: job.location,
      url: job.url,
      deadline: job.expiresAt ? job.expiresAt.slice(0, 10) : null,
    };
  } else {
    const { data: saved } = await supabase
      .from("saved_jobs")
      .select("job_id, company_name, job_title, url")
      .eq("id", parsed.data.savedJobId!)
      .eq("user_id", user.id)
      .maybeSingle();
    if (!saved) return { error: "That saved job couldn't be found." };
    // The listing may still be live (fresher location/deadline) or gone (the snapshot is all there is).
    const live = saved.job_id ? await getJobById(saved.job_id) : null;
    seed = {
      jobId: live ? live.id : null,
      companyName: saved.company_name,
      jobTitle: saved.job_title,
      location: live?.location ?? null,
      url: saved.url,
      deadline: live?.expiresAt ? live.expiresAt.slice(0, 10) : null,
    };
  }

  const existingId = await findExistingApplicationId(user.id, seed);
  if (existingId) return { applicationId: existingId, alreadyTracked: true };

  let cvId: string | null = null;
  if (parsed.data.cvId) {
    const cvs = await listCvs(user.id);
    if (!cvs.some((cv) => cv.id === parsed.data.cvId)) return { error: "That CV couldn't be found." };
    cvId = parsed.data.cvId;
  }

  let snapshot;
  try {
    snapshot = await resolveSnapshotFreeze({
      userId: user.id,
      companyName: seed.companyName,
      jobTitle: seed.jobTitle,
      cvId,
      jobId: seed.jobId,
      newStatus: "wishlist",
      existing: null,
    });
  } catch (err) {
    console.error("addJobToTracker: snapshot failed:", err);
    return { error: err instanceof SnapshotError ? err.message : "Couldn't add that job to your tracker — try again." };
  }

  const { data, error } = await supabase
    .from("applications")
    .insert({
      user_id: user.id,
      job_id: seed.jobId,
      company_name: seed.companyName,
      job_title: seed.jobTitle,
      location: seed.location,
      url: seed.url,
      deadline: seed.deadline,
      status: "wishlist",
      cv_id: cvId,
      sponsor_status: snapshot.sponsorStatus,
      match_score: snapshot.matchScore,
      submitted_cv_version_id: snapshot.submittedCvVersionId,
      frozen_at: snapshot.frozenAt,
    })
    .select("id")
    .single();

  if (error || !data) {
    if (error?.code === "23505") {
      // Lost a race with another click/tab: the other insert won.
      const winner = await findExistingApplicationId(user.id, seed);
      if (winner) return { applicationId: winner, alreadyTracked: true };
    }
    return { error: "Couldn't add that job to your tracker — try again." };
  }

  revalidatePath("/dashboard/applications");
  revalidatePath("/dashboard/jobs");
  return { applicationId: data.id, alreadyTracked: false };
}
