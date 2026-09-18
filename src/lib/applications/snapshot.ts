import "server-only";
import { getCvEditorData } from "@/lib/cvs/queries";
import { getJobMatchesForCv } from "@/lib/jobs/queries";
import { matchJobToSponsor } from "@/lib/jobs/sponsor-match";
import type { Application, ApplicationStatus } from "@/lib/applications/types";

export type SnapshotFields = {
  sponsorStatus: Application["sponsorStatus"];
  matchScore: Application["matchScore"];
  submittedCvVersionId: string | null;
  frozenAt: string | null;
};

/**
 * The one place that decides what applications.sponsor_status/
 * match_score/submitted_cv_version_id/frozen_at should be for a given
 * save — used by createApplication, updateApplication, and
 * updateApplicationStatus alike (src/lib/applications/actions.ts), so
 * the freeze rule can't drift between the three different ways an
 * application's status can change.
 *
 * - Already frozen (`existing.frozenAt` set): returns `existing`
 *   completely untouched — no new sponsor lookup, no new CV read,
 *   regardless of what companyName/cvId/newStatus are *now*. This is
 *   the primary "never overwrite" path; migration 0065's trigger is
 *   the backstop for if this ever fails to be true.
 * - Not yet frozen, and `newStatus` is `'applied'` (reached for the
 *   first time): resolves sponsor state, a matching CV version, and
 *   any existing match score live, right now, and freezes all of it —
 *   `frozenAt` becomes non-null from this call onward.
 * - Not yet frozen, any other status: resolves `sponsorStatus` live —
 *   same as every save has always done pre-freeze (migration 0064) —
 *   but leaves `matchScore`/`submittedCvVersionId` null; those two are
 *   only ever meaningful once actually frozen at Applied, never before.
 */
export async function resolveSnapshotFreeze(params: {
  userId: string;
  companyName: string;
  cvId: string | null;
  jobId: string | null;
  newStatus: ApplicationStatus;
  existing: SnapshotFields | null;
}): Promise<SnapshotFields> {
  if (params.existing?.frozenAt) return params.existing;

  const sponsorMatch = await matchJobToSponsor(params.companyName);

  if (params.newStatus !== "applied") {
    return { sponsorStatus: sponsorMatch.status, matchScore: null, submittedCvVersionId: null, frozenAt: null };
  }

  let submittedCvVersionId: string | null = null;
  let matchScore: Application["matchScore"] = null;
  if (params.cvId) {
    const cv = await getCvEditorData(params.userId, params.cvId);
    if (cv) {
      submittedCvVersionId = cv.versionId;
      if (params.jobId) {
        const existingMatches = await getJobMatchesForCv([params.jobId], cv.versionId);
        matchScore = existingMatches.get(params.jobId)?.matchScore ?? null;
      }
    }
  }

  return {
    sponsorStatus: sponsorMatch.status,
    matchScore,
    submittedCvVersionId,
    frozenAt: new Date().toISOString(),
  };
}
