import "server-only";
import { createClient } from "@/lib/supabase/server";
import { listActiveTestTypes } from "@/lib/test-prep/queries";
import type { QuestionDifficulty } from "@/lib/test-prep/types";

// Real numbers only, read across every one of this user's own
// completed test_sessions/test_answers — nothing here is AI-generated
// or fabricated (a "personalized study plan" from an LLM would need to
// go through src/lib/ai/gateway.ts and be entitlement-gated; this is
// plain arithmetic over the user's own history, so it isn't and
// doesn't need to be). Every query goes through the regular,
// RLS-scoped client — none of this needs correct_answer/explanation,
// only is_correct/subtype/difficulty, all of which are public columns
// or already user-owned.

const WEAK_ACCURACY_THRESHOLD = 70;
const MIN_SUBTYPE_SAMPLE = 3;
const MAX_WEAK_SUBTYPES = 5;
const MAX_UNTRIED_TYPES = 3;

export type AccuracyPoint = {
  sessionId: string;
  completedAt: string;
  /** correct ÷ totalQuestions (the session's own snapshot) — counts a skipped question against it, same definition used everywhere else in this app. */
  score: number;
  /** correct ÷ answered — distinct from score, same reasoning as the per-session summary. */
  accuracy: number;
  correctCount: number;
  answeredCount: number;
  totalQuestions: number;
  label: string;
  testTypeName: string | null;
  isDaily: boolean;
};

export type SubtypeHeatmapCell = {
  subtype: string;
  difficulty: QuestionDifficulty | "unspecified";
  total: number;
  correct: number;
  accuracy: number;
};

export type StudyRecommendation =
  | {
      kind: "weak_subtype";
      subtype: string;
      accuracy: number;
      sampleSize: number;
      testTypeName: string | null;
      packId: string | null;
      packName: string | null;
    }
  | { kind: "untried_type"; testTypeId: string; testTypeName: string };

export type TestPrepInsights = {
  hasHistory: boolean;
  accuracyHistory: AccuracyPoint[];
  subtypeHeatmap: SubtypeHeatmapCell[];
  recommendations: StudyRecommendation[];
};

const EMPTY_INSIGHTS: TestPrepInsights = { hasHistory: false, accuracyHistory: [], subtypeHeatmap: [], recommendations: [] };

type SessionRow = {
  id: string;
  question_pack_id: string | null;
  is_daily: boolean;
  total_questions: number;
  correct_count: number | null;
  score: number | null;
  completed_at: string | null;
};

type AnswerRow = { test_session_id: string; question_id: string | null; is_correct: boolean | null };
type QuestionRow = { id: string; question_pack_id: string; subtype: string | null; difficulty: QuestionDifficulty | null };
type PackRow = { id: string; name: string; test_type_id: string };
type TypeRow = { id: string; name: string };

/** Every completed session's score/accuracy over time, an aggregate weak-subtype×difficulty breakdown, and study-plan recommendations derived from both — all computed from this one user's own real history, never a single session in isolation. */
export async function getTestPrepInsights(userId: string): Promise<TestPrepInsights> {
  const supabase = await createClient();

  const { data: sessionRows } = await supabase
    .from("test_sessions")
    .select("id, question_pack_id, is_daily, total_questions, correct_count, score, completed_at")
    .eq("user_id", userId)
    .not("completed_at", "is", null)
    .order("completed_at", { ascending: true });
  const sessions = (sessionRows ?? []) as SessionRow[];
  if (sessions.length === 0) return EMPTY_INSIGHTS;

  const sessionIds = sessions.map((session) => session.id);
  const { data: answerRows } = await supabase
    .from("test_answers")
    .select("test_session_id, question_id, is_correct")
    .in("test_session_id", sessionIds);
  const answers = (answerRows ?? []) as AnswerRow[];

  const questionIds = [...new Set(answers.map((answer) => answer.question_id).filter((id): id is string => !!id))];
  const { data: questionRows } = questionIds.length
    ? await supabase.from("questions").select("id, question_pack_id, subtype, difficulty").in("id", questionIds)
    : { data: [] as QuestionRow[] };
  const questions = (questionRows ?? []) as QuestionRow[];
  const questionById = new Map(questions.map((question) => [question.id, question]));

  const packIds = [
    ...new Set([...sessions.map((session) => session.question_pack_id), ...questions.map((question) => question.question_pack_id)].filter(
      (id): id is string => !!id,
    )),
  ];
  const { data: packRows } = packIds.length
    ? await supabase.from("question_packs").select("id, name, test_type_id").in("id", packIds)
    : { data: [] as PackRow[] };
  const packs = (packRows ?? []) as PackRow[];
  const packById = new Map(packs.map((pack) => [pack.id, pack]));

  const typeIds = [...new Set(packs.map((pack) => pack.test_type_id))];
  const { data: typeRows } = typeIds.length
    ? await supabase.from("test_types").select("id, name").in("id", typeIds)
    : { data: [] as TypeRow[] };
  const typeById = new Map(((typeRows ?? []) as TypeRow[]).map((type) => [type.id, type]));

  // ---- accuracy history (score vs. accuracy, one point per session) ----
  const answersBySession = new Map<string, { correct: number; answered: number }>();
  for (const answer of answers) {
    const bucket = answersBySession.get(answer.test_session_id) ?? { correct: 0, answered: 0 };
    bucket.answered += 1;
    if (answer.is_correct) bucket.correct += 1;
    answersBySession.set(answer.test_session_id, bucket);
  }

  const accuracyHistory: AccuracyPoint[] = sessions
    .filter((session): session is SessionRow & { completed_at: string; score: number; correct_count: number } => session.completed_at !== null && session.score !== null && session.correct_count !== null)
    .map((session) => {
      const bucket = answersBySession.get(session.id) ?? { correct: 0, answered: 0 };
      const pack = session.question_pack_id ? packById.get(session.question_pack_id) : undefined;
      const type = pack ? typeById.get(pack.test_type_id) : undefined;
      return {
        sessionId: session.id,
        completedAt: session.completed_at,
        score: session.score,
        accuracy: bucket.answered > 0 ? Math.round((bucket.correct / bucket.answered) * 100) : 0,
        correctCount: session.correct_count,
        answeredCount: bucket.answered,
        totalQuestions: session.total_questions,
        label: session.is_daily ? "Daily practice" : (pack?.name ?? "Practice session"),
        testTypeName: type?.name ?? null,
        isDaily: session.is_daily,
      };
    });

  // ---- weak-subtype × difficulty heatmap, across every answer ever ----
  const heatmapCells = new Map<string, SubtypeHeatmapCell>();
  // subtype-only aggregate (ignores difficulty) — what recommendations key off
  const bySubtype = new Map<string, { total: number; correct: number; packVotes: Map<string, number> }>();

  for (const answer of answers) {
    const question = answer.question_id ? questionById.get(answer.question_id) : undefined;
    if (!question) continue; // a deleted question carries no subtype info left to attribute
    const subtype = question.subtype ?? "General";
    const difficulty = question.difficulty ?? "unspecified";

    const cellKey = `${subtype}::${difficulty}`;
    const cell = heatmapCells.get(cellKey) ?? { subtype, difficulty, total: 0, correct: 0, accuracy: 0 };
    cell.total += 1;
    if (answer.is_correct) cell.correct += 1;
    heatmapCells.set(cellKey, cell);

    const subtypeBucket = bySubtype.get(subtype) ?? { total: 0, correct: 0, packVotes: new Map<string, number>() };
    subtypeBucket.total += 1;
    if (answer.is_correct) subtypeBucket.correct += 1;
    subtypeBucket.packVotes.set(question.question_pack_id, (subtypeBucket.packVotes.get(question.question_pack_id) ?? 0) + 1);
    bySubtype.set(subtype, subtypeBucket);
  }

  const subtypeHeatmap = Array.from(heatmapCells.values())
    .map((cell) => ({ ...cell, accuracy: cell.total > 0 ? Math.round((cell.correct / cell.total) * 100) : 0 }))
    .sort((a, b) => a.subtype.localeCompare(b.subtype));

  // ---- recommendations: weakest real subtypes, then never-tried types ----
  const weakSubtypes: StudyRecommendation[] = Array.from(bySubtype.entries())
    .map(([subtype, bucket]) => {
      const accuracy = bucket.total > 0 ? Math.round((bucket.correct / bucket.total) * 100) : 0;
      const topPackId = Array.from(bucket.packVotes.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
      const pack = topPackId ? packById.get(topPackId) : undefined;
      const type = pack ? typeById.get(pack.test_type_id) : undefined;
      return {
        kind: "weak_subtype" as const,
        subtype,
        accuracy,
        sampleSize: bucket.total,
        testTypeName: type?.name ?? null,
        packId: pack?.id ?? null,
        packName: pack?.name ?? null,
      };
    })
    .filter((entry) => entry.sampleSize >= MIN_SUBTYPE_SAMPLE && entry.accuracy < WEAK_ACCURACY_THRESHOLD)
    .sort((a, b) => a.accuracy - b.accuracy)
    .slice(0, MAX_WEAK_SUBTYPES);

  const attemptedTypeIds = new Set(packs.map((pack) => pack.test_type_id));
  const activeTypes = await listActiveTestTypes();
  const untriedTypes: StudyRecommendation[] = activeTypes
    .filter((type) => !attemptedTypeIds.has(type.id))
    .slice(0, MAX_UNTRIED_TYPES)
    .map((type) => ({ kind: "untried_type" as const, testTypeId: type.id, testTypeName: type.name }));

  return {
    hasHistory: true,
    accuracyHistory,
    subtypeHeatmap,
    recommendations: [...weakSubtypes, ...untriedTypes],
  };
}
