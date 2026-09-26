import "server-only";
import { createClient } from "@/lib/supabase/server";
import { getCvEditorData, listCvs } from "@/lib/cvs/queries";
import { hasTestPrepAccess } from "@/lib/test-prep/access";
import { accuracyByType } from "@/lib/test-prep/accuracy";
import { loadAccuracyRows } from "@/lib/test-prep/history-data";
import { listActiveTestTypes } from "@/lib/test-prep/queries";
import { ASSESSMENT_PREP } from "@/config/assessment-prep";
import { computeCvReadiness, type CvReadiness } from "@/lib/graduate-schemes/preparation/readiness";
import { journeyPercent, nextStep, stepStatuses, type JourneyInput, type JourneyStep, type StepStatus, type TestRow } from "@/lib/graduate-schemes/preparation/progress";
import { ASSESSMENT_LABELS, type GraduateScheme } from "@/lib/graduate-schemes/types";

export type PreparationState = {
  started: boolean;
  startedAt: string | null;
  cvOptions: { id: string; title: string }[];
  cv: { id: string; title: string; versionId: string; readiness: CvReadiness } | null;
  ats: { scanId: string; score: number; keywordScore: number; createdAt: string; missingKeywords: string[] } | null;
  tests: TestRow[];
  testsLocked: boolean;
  interviews: { id: string; mode: string; status: string; overallScore: number | null; createdAt: string }[];
  tracker: { applicationId: string; status: string; deadline: string | null } | null;
  statuses: Record<JourneyStep, StepStatus>;
  next: JourneyStep | null;
  percent: number;
};

/**
 * Everything the journey shows, read live from the tools' own data for this user and scheme — nothing is copied, so a score
 * or status here is always the current one. Throws on a database error: an outage must never look like "nothing started".
 */
export async function getPreparationState(userId: string, scheme: GraduateScheme): Promise<PreparationState> {
  const supabase = await createClient();

  const { data: prep, error: prepError } = await supabase.from("graduate_scheme_preparations").select("cv_id, started_at").eq("user_id", userId).eq("scheme_id", scheme.id).maybeSingle();
  if (prepError) throw new Error("Couldn't load your preparation.");

  const cvOptions = (await listCvs(userId)).filter((cv) => !cv.isArchived).map((cv) => ({ id: cv.id, title: cv.title }));

  let cv: PreparationState["cv"] = null;
  if (prep?.cv_id) {
    const data = await getCvEditorData(userId, prep.cv_id);
    if (data) cv = { id: data.cvId, title: data.cvTitle, versionId: data.versionId, readiness: computeCvReadiness(data) };
  }

  const { data: scan } = await supabase
    .from("ats_scans")
    .select("id, match_score, keyword_score, created_at")
    .eq("user_id", userId)
    .eq("graduate_scheme_id", scheme.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  let ats: PreparationState["ats"] = null;
  if (scan) {
    const { data: missing } = await supabase.from("ats_keywords").select("keyword").eq("scan_id", scan.id).eq("status", "missing").order("importance", { ascending: true }).limit(5);
    ats = { scanId: scan.id, score: scan.match_score, keywordScore: scan.keyword_score, createdAt: scan.created_at, missingKeywords: (missing ?? []).map((row) => row.keyword) };
  }

  // Test progress: for each kind of assessment this scheme uses that JobPilot really has practice for, the user's own accuracy.
  const practicable = scheme.assessments.filter((assessment) => ASSESSMENT_PREP[assessment.type].links.some((link) => link.testTypeSlug));
  const testsLocked = practicable.length > 0 && !(await hasTestPrepAccess(userId));
  const tests: TestRow[] = [];
  if (practicable.length > 0) {
    const types = await listActiveTestTypes();
    const stats = testsLocked ? new Map() : accuracyByType(await loadAccuracyRows(supabase));
    for (const assessment of practicable) {
      const slug = ASSESSMENT_PREP[assessment.type].links.find((link) => link.testTypeSlug)!.testTypeSlug!;
      if (tests.some((row) => row.testTypeSlug === slug)) continue;
      const type = types.find((t) => t.slug === slug);
      const stat = type ? stats.get(type.id) : undefined;
      tests.push({ assessmentType: assessment.type, testTypeSlug: slug, name: type?.name ?? ASSESSMENT_LABELS[assessment.type], answers: stat?.total ?? 0, accuracy: stat && stat.total > 0 ? stat.accuracy : null });
    }
  }

  const { data: sessions, error: sessionsError } = await supabase
    .from("interview_sessions")
    .select("id, mode, status, overall_score, created_at")
    .eq("user_id", userId)
    .eq("graduate_scheme_id", scheme.id)
    .order("created_at", { ascending: false });
  if (sessionsError) throw new Error("Couldn't load your interview progress.");
  const interviews = (sessions ?? []).map((row) => ({ id: row.id, mode: row.mode as string, status: row.status as string, overallScore: row.overall_score as number | null, createdAt: row.created_at as string }));

  const { data: application } = await supabase.from("applications").select("id, status, deadline").eq("user_id", userId).eq("graduate_scheme_id", scheme.id).maybeSingle();
  const tracker = application ? { applicationId: application.id, status: application.status as string, deadline: (application.deadline as string | null) ?? null } : null;

  const completed = interviews.filter((session) => session.status === "completed");
  const input: JourneyInput = {
    started: Boolean(prep),
    cv: cv ? { id: cv.id, title: cv.title, readinessPercent: cv.readiness.percent, ready: cv.readiness.ready } : null,
    ats: ats ? { scanId: ats.scanId, score: ats.score, createdAt: ats.createdAt } : null,
    tests,
    testsLocked,
    interview: {
      total: interviews.length,
      completed: completed.length,
      bestScore: completed.reduce<number | null>((best, session) => (session.overallScore !== null && (best === null || session.overallScore > best) ? session.overallScore : best), null),
      inProgressId: interviews.find((session) => session.status === "in_progress")?.id ?? null,
      latestCompletedId: completed[0]?.id ?? null,
    },
    tracker: tracker ? { applicationId: tracker.applicationId, status: tracker.status } : null,
  };
  const statuses = stepStatuses(input);

  return {
    started: Boolean(prep),
    startedAt: prep?.started_at ?? null,
    cvOptions,
    cv,
    ats,
    tests,
    testsLocked,
    interviews,
    tracker,
    statuses,
    next: nextStep(statuses),
    percent: journeyPercent(statuses),
  };
}
