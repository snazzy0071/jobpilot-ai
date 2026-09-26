import "server-only";
import { createClient } from "@/lib/supabase/server";
import { aggregateTopics, accuracyByType, findWeakAreas, type TopicAccuracy } from "@/lib/test-prep/accuracy";
import { loadAccuracyRows } from "@/lib/test-prep/history-data";
import { listActiveTestTypes } from "@/lib/test-prep/queries";

// Real numbers only, computed from this user's own completed sessions and answers: nothing here is AI-generated or
// invented, so it isn't (and needn't be) routed through the AI gateway. Accuracy by topic comes from one SQL aggregate
// (test_prep_accuracy, migration 0106) instead of fetching every answer and joining in application code, which silently
// truncated at PostgREST's row cap for anyone who practises regularly.

const HISTORY_LIMIT = 100;
const MAX_WEAK_RECOMMENDATIONS = 4;
const MAX_UNTRIED_RECOMMENDATIONS = 3;
/** Enough answers, and a good enough accuracy, in a format to suggest sitting it as a timed exam. */
const TIMED_READY_MIN_ANSWERS = 15;
const TIMED_READY_ACCURACY = 75;

export type AccuracyPoint = {
  sessionId: string;
  completedAt: string;
  /** correct ÷ the session's fixed question count — a skipped question counts against it, same definition everywhere. */
  score: number;
  /** correct ÷ answered — separate from score. */
  accuracy: number;
  correctCount: number;
  answeredCount: number;
  totalQuestions: number;
  label: string;
  testTypeName: string | null;
  isDaily: boolean;
  mode: "practice" | "timed";
};

export type TypeSummary = {
  testTypeId: string;
  name: string;
  slug: string;
  answers: number;
  accuracy: number | null;
  attempts: number;
  bestScore: number | null;
  lastPracticedAt: string | null;
};

export type StudyRecommendation =
  | { kind: "weak_subtype"; subtype: string; accuracy: number; sampleSize: number; testTypeId: string; testTypeName: string | null; trend: TopicAccuracy["trend"] }
  | { kind: "untried_type"; testTypeId: string; testTypeName: string }
  | { kind: "try_timed"; testTypeId: string; testTypeName: string; accuracy: number };

export type TestPrepInsights = {
  hasHistory: boolean;
  accuracyHistory: AccuracyPoint[];
  topics: (TopicAccuracy & { testTypeName: string | null })[];
  byType: TypeSummary[];
  weakAreas: (TopicAccuracy & { testTypeName: string | null })[];
  recommendations: StudyRecommendation[];
  totals: { sessions: number; answers: number; accuracy: number | null };
};

export const EMPTY_TEST_PREP_INSIGHTS: TestPrepInsights = {
  hasHistory: false,
  accuracyHistory: [],
  topics: [],
  byType: [],
  weakAreas: [],
  recommendations: [],
  totals: { sessions: 0, answers: 0, accuracy: null },
};

type SessionRow = {
  id: string;
  is_daily: boolean;
  mode: "practice" | "timed";
  focus_subtype: string | null;
  total_questions: number;
  correct_count: number | null;
  score: number | null;
  completed_at: string | null;
  question_packs: { name: string; test_types: { name: string } | { name: string }[] | null } | { name: string; test_types: unknown }[] | null;
  test_answers: { count: number }[] | null;
};

function labelFor(row: SessionRow): { label: string; testTypeName: string | null } {
  const pack = (Array.isArray(row.question_packs) ? row.question_packs[0] : row.question_packs) as { name: string; test_types: { name: string } | { name: string }[] | null } | null;
  const type = pack ? (Array.isArray(pack.test_types) ? pack.test_types[0] : pack.test_types) : null;
  if (row.is_daily) return { label: "Daily five", testTypeName: null };
  if (row.focus_subtype) return { label: `Focus: ${row.focus_subtype}`, testTypeName: null };
  return { label: pack?.name ?? "Practice session", testTypeName: type?.name ?? null };
}

/** Every completed session's score/accuracy over time, accuracy by test type and by topic, weak areas with their trend, and recommendations derived from them — for one user. Throws on a database error (an outage must never read as "no history"). */
export async function getTestPrepInsights(userId: string): Promise<TestPrepInsights> {
  const supabase = await createClient();

  const [{ data: sessionRows, error: sessionsError }, accuracyRows, testTypes, { data: progressRows }] = await Promise.all([
    supabase
      .from("test_sessions")
      .select(
        "id, is_daily, mode, focus_subtype, total_questions, correct_count, score, completed_at, question_packs(name, test_types(name)), test_answers(count)",
      )
      .eq("user_id", userId)
      .not("completed_at", "is", null)
      .order("completed_at", { ascending: false })
      .limit(HISTORY_LIMIT),
    loadAccuracyRows(supabase),
    listActiveTestTypes(),
    supabase.from("practice_progress").select("test_type_id, attempts_count, best_score, last_practiced_at").eq("user_id", userId),
  ]);
  if (sessionsError) {
    console.error("getTestPrepInsights failed:", sessionsError.message);
    throw new Error("Couldn't load your practice history.");
  }

  const sessions = (sessionRows ?? []) as unknown as SessionRow[];
  if (sessions.length === 0) return EMPTY_TEST_PREP_INSIGHTS;

  const typeName = new Map(testTypes.map((type) => [type.id, type.name]));

  const accuracyHistory: AccuracyPoint[] = sessions
    .filter((row): row is SessionRow & { completed_at: string; score: number; correct_count: number } => row.completed_at !== null && row.score !== null && row.correct_count !== null)
    .map((row) => {
      const answered = row.test_answers?.[0]?.count ?? 0;
      const { label, testTypeName } = labelFor(row);
      return {
        sessionId: row.id,
        completedAt: row.completed_at,
        score: row.score,
        accuracy: answered > 0 ? Math.round((row.correct_count / answered) * 100) : 0,
        correctCount: row.correct_count,
        answeredCount: answered,
        totalQuestions: row.total_questions,
        label,
        testTypeName,
        isDaily: row.is_daily,
        mode: row.mode,
      };
    })
    .reverse(); // oldest first, for the trend chart

  const topics = aggregateTopics(accuracyRows).map((topic) => ({ ...topic, testTypeName: topic.testTypeId ? (typeName.get(topic.testTypeId) ?? null) : null }));
  const weakAreas = findWeakAreas(topics).map((topic) => ({ ...topic, testTypeName: topic.testTypeId ? (typeName.get(topic.testTypeId) ?? null) : null }));

  const typeAccuracy = accuracyByType(accuracyRows);
  const progressByType = new Map((progressRows ?? []).map((row) => [row.test_type_id, row]));
  const byType: TypeSummary[] = testTypes.map((type) => {
    const stats = typeAccuracy.get(type.id);
    const progress = progressByType.get(type.id);
    return {
      testTypeId: type.id,
      name: type.name,
      slug: type.slug,
      answers: stats?.total ?? 0,
      accuracy: stats ? stats.accuracy : null,
      attempts: progress?.attempts_count ?? 0,
      bestScore: progress?.best_score ?? null,
      lastPracticedAt: progress?.last_practiced_at ?? null,
    };
  });

  // ---- recommendations: weakest topics first (with a way to drill them), formats never tried, then a format that's ready for the clock
  const recommendations: StudyRecommendation[] = [];
  for (const topic of weakAreas.slice(0, MAX_WEAK_RECOMMENDATIONS)) {
    if (!topic.testTypeId) continue;
    recommendations.push({ kind: "weak_subtype", subtype: topic.subtype, accuracy: topic.accuracy, sampleSize: topic.total, testTypeId: topic.testTypeId, testTypeName: topic.testTypeName, trend: topic.trend });
  }
  for (const type of byType.filter((entry) => entry.answers === 0).slice(0, MAX_UNTRIED_RECOMMENDATIONS)) {
    recommendations.push({ kind: "untried_type", testTypeId: type.testTypeId, testTypeName: type.name });
  }
  const ready = byType.filter((entry) => entry.accuracy !== null && entry.answers >= TIMED_READY_MIN_ANSWERS && entry.accuracy >= TIMED_READY_ACCURACY).sort((a, b) => (b.accuracy ?? 0) - (a.accuracy ?? 0))[0];
  if (ready && !accuracyHistory.some((point) => point.mode === "timed" && point.testTypeName === ready.name)) {
    recommendations.push({ kind: "try_timed", testTypeId: ready.testTypeId, testTypeName: ready.name, accuracy: ready.accuracy ?? 0 });
  }

  const totalAnswers = byType.reduce((sum, type) => sum + type.answers, 0);
  const totalCorrect = accuracyRows.reduce((sum, row) => sum + row.correct, 0);
  return {
    hasHistory: true,
    accuracyHistory,
    topics,
    byType,
    weakAreas,
    recommendations,
    totals: { sessions: sessions.length, answers: totalAnswers, accuracy: totalAnswers > 0 ? Math.round((totalCorrect / totalAnswers) * 100) : null },
  };
}
