import "server-only";
import { createClient } from "@/lib/supabase/server";
import { createSubmittedCvVersion } from "@/lib/cvs/internal";
import { getJobMatchesForCv } from "@/lib/jobs/queries";
import { matchJobToSponsor } from "@/lib/jobs/sponsor-match";
import type { Application, ApplicationStatus } from "@/lib/applications/types";

export type SnapshotFields = {
  sponsorStatus: Application["sponsorStatus"];
  matchScore: Application["matchScore"];
  submittedCvVersionId: string | null;
  frozenAt: string | null;
};

/** A failure the person can act on ("try again"), worded for them — thrown rather than returned so a save can never carry on with a half-resolved snapshot. */
export class SnapshotError extends Error {}

async function currentCvVersionId(userId: string, cvId: string): Promise<string | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("cv_versions")
    .select("id")
    .eq("cv_id", cvId)
    .eq("user_id", userId)
    .eq("is_current", true)
    .maybeSingle();
  return data?.id ?? null;
}

async function liveMatchScore(jobId: string | null, cvVersionId: string | null): Promise<number | null> {
  if (!jobId || !cvVersionId) return null;
  const matches = await getJobMatchesForCv([jobId], cvVersionId);
  return matches.get(jobId)?.matchScore ?? null;
}

/**
 * The one place that decides what applications.sponsor_status / match_score / submitted_cv_version_id / frozen_at
 * should be for a given save — used by createApplication, updateApplication, updateApplicationStatus and add-to-tracker
 * alike, so the freeze rule can't drift between the ways an application's status can change.
 *
 * - Already frozen (`existing.frozenAt`): returns `existing` untouched — no lookups, regardless of what the company,
 *   CV or status are now. Migration 0065's trigger is the backstop if a caller ever tried to change it.
 * - Not frozen and `newStatus` is not 'applied': sponsor state and (when a job and CV are linked) the job's match score
 *   are resolved live so the card is informative — they keep tracking the company/CV until the freeze — but nothing is
 *   frozen and no CV copy is made.
 * - `newStatus` is 'applied' for the first time: FREEZE. Sponsor state is looked up from the register now; the linked
 *   CV's current content is copied into a permanent, non-current CV version ("Submitted: role at company") and that
 *   copy's id is what's stored (freezing the live version's id would freeze nothing: edits change it in place); the
 *   match score is the stored score for that CV and job, if one exists. `frozenAt` is set. If the register can't be
 *   checked or the CV copy can't be made this throws a SnapshotError — the application is NOT moved to Applied with a
 *   half-frozen snapshot; the person can simply try again.
 */
export async function resolveSnapshotFreeze(params: {
  userId: string;
  companyName: string;
  jobTitle: string;
  cvId: string | null;
  jobId: string | null;
  newStatus: ApplicationStatus;
  existing: SnapshotFields | null;
}): Promise<SnapshotFields> {
  if (params.existing?.frozenAt) return params.existing;

  let sponsorStatus: SnapshotFields["sponsorStatus"];
  try {
    sponsorStatus = (await matchJobToSponsor(params.companyName)).status;
  } catch (err) {
    console.error("resolveSnapshotFreeze: sponsor check failed:", err);
    throw new SnapshotError("Couldn't check the sponsor register just now — try again in a moment.");
  }

  const versionId = params.cvId ? await currentCvVersionId(params.userId, params.cvId) : null;

  if (params.newStatus !== "applied") {
    return { sponsorStatus, matchScore: await liveMatchScore(params.jobId, versionId), submittedCvVersionId: null, frozenAt: null };
  }

  let submittedCvVersionId: string | null = null;
  let matchScore: number | null = null;
  if (params.cvId && versionId) {
    matchScore = await liveMatchScore(params.jobId, versionId);
    const supabase = await createClient();
    submittedCvVersionId = await createSubmittedCvVersion(
      supabase,
      params.userId,
      params.cvId,
      versionId,
      `Submitted: ${params.jobTitle} at ${params.companyName}`,
    );
    if (!submittedCvVersionId) throw new SnapshotError("Couldn't save a copy of your CV for this application — try again.");
  }

  return { sponsorStatus, matchScore, submittedCvVersionId, frozenAt: new Date().toISOString() };
}
