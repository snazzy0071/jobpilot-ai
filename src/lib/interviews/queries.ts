import "server-only";
import { createClient } from "@/lib/supabase/server";
import type {
  InterviewSessionListItem,
  InterviewSessionDetail,
  InterviewTranscriptTurn,
  InterviewAnswerScore,
  InterviewMode,
  InterviewStatus,
  InterviewDifficulty,
  InterviewCompetency,
  InterviewSpeaker,
  InterviewProgress,
  InterviewCompetencyProgress,
} from "@/lib/interviews/types";

type InterviewSessionListRow = {
  id: string;
  role: string;
  company: string | null;
  mode: InterviewMode;
  status: InterviewStatus;
  difficulty: InterviewDifficulty;
  created_at: string;
  // Full rows embedded (not a count() aggregate) — same proven pattern
  // src/lib/cvs/queries.ts's listCvs uses for cv_versions(id, ...),
  // rather than relying on PostgREST's separate count-embed syntax,
  // which nothing else in this codebase has exercised yet.
  interview_questions: { id: string }[];
};

/** Relies on RLS (the caller's own session client) to scope results to the signed-in user, same convention as src/lib/cvs/queries.ts and src/lib/cover-letters/queries.ts. */
export async function listInterviewSessions(userId: string): Promise<InterviewSessionListItem[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("interview_sessions")
    .select("id, role, company, mode, status, difficulty, created_at, interview_questions(id)")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error || !data) return [];

  return (data as unknown as InterviewSessionListRow[]).map((row) => ({
    id: row.id,
    role: row.role,
    company: row.company,
    mode: row.mode,
    status: row.status,
    difficulty: row.difficulty,
    questionCount: row.interview_questions?.length ?? 0,
    createdAt: row.created_at,
  }));
}

type InterviewQuestionRow = { id: string; competency: InterviewCompetency; question: string; display_order: number };
type InterviewTranscriptRow = { id: string; speaker: InterviewSpeaker; content: string; question_id: string | null; sequence_index: number };

/** Every turn for one session, in order — the shared fetch behind getInterviewSessionDetail (page load) and the chat actions (rebuilding the AI's context on every turn), same role as src/lib/cvs/queries.ts's getVersionSections. */
export async function getTranscriptTurns(userId: string, sessionId: string): Promise<InterviewTranscriptTurn[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("interview_transcripts")
    .select("id, speaker, content, question_id, sequence_index")
    .eq("session_id", sessionId)
    .eq("user_id", userId)
    .order("sequence_index", { ascending: true });

  if (error || !data) return [];
  return (data as InterviewTranscriptRow[]).map((row) => ({
    id: row.id,
    speaker: row.speaker,
    content: row.content,
    questionId: row.question_id,
    sequenceIndex: row.sequence_index,
  }));
}

type InterviewScoreRow = {
  situation_score: number;
  task_score: number;
  action_score: number;
  result_score: number;
  relevance_score: number;
  clarity_score: number;
  evidence_score: number;
  overall_score: number;
  strengths: string[];
  improvements: string[];
  suggested_rephrase: string | null;
  answer_id: string;
};

function mapScoreRow(row: InterviewScoreRow): InterviewAnswerScore {
  return {
    situationScore: row.situation_score,
    taskScore: row.task_score,
    actionScore: row.action_score,
    resultScore: row.result_score,
    relevanceScore: row.relevance_score,
    clarityScore: row.clarity_score,
    evidenceScore: row.evidence_score,
    overallScore: row.overall_score,
    strengths: row.strengths,
    improvements: row.improvements,
    suggestedRephrase: row.suggested_rephrase,
  };
}

/**
 * Every already-persisted score for this session's questions, keyed by
 * question id. Three plain filtered queries merged in JS (questions ->
 * their answers -> those answers' scores) rather than a nested
 * multi-level PostgREST embed — interview_answers has no session_id of
 * its own (only question_id, one hop from interview_questions, same
 * shape as cv_experience's single hop from cv_version_id), and this
 * codebase hasn't exercised a two-level embed anywhere yet, so plain
 * `.in()` filters are the safer, already-proven-pattern choice.
 */
export async function getSessionScores(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  questionIds: string[],
): Promise<Record<string, InterviewAnswerScore>> {
  if (questionIds.length === 0) return {};

  const { data: answers } = await supabase
    .from("interview_answers")
    .select("id, question_id")
    .eq("user_id", userId)
    .in("question_id", questionIds);
  if (!answers || answers.length === 0) return {};

  const answerIdToQuestionId = new Map(answers.map((row) => [row.id as string, row.question_id as string]));

  const { data: scores } = await supabase
    .from("interview_scores")
    .select(
      "answer_id, situation_score, task_score, action_score, result_score, relevance_score, clarity_score, evidence_score, overall_score, strengths, improvements, suggested_rephrase",
    )
    .eq("user_id", userId)
    .in("answer_id", Array.from(answerIdToQuestionId.keys()));
  if (!scores) return {};

  const result: Record<string, InterviewAnswerScore> = {};
  for (const row of scores as InterviewScoreRow[]) {
    const questionId = answerIdToQuestionId.get(row.answer_id);
    if (questionId) result[questionId] = mapScoreRow(row);
  }
  return result;
}

export async function getInterviewSessionDetail(userId: string, sessionId: string): Promise<InterviewSessionDetail | null> {
  const supabase = await createClient();

  const { data: session, error: sessionError } = await supabase
    .from("interview_sessions")
    .select(
      "id, role, company, mode, status, difficulty, job_description, created_at, overall_score, strengths, weaknesses, recommended_practice, focus_competencies, practiced_from_session_id",
    )
    .eq("id", sessionId)
    .eq("user_id", userId)
    .maybeSingle();
  if (sessionError || !session) return null;

  const { data: questions, error: questionsError } = await supabase
    .from("interview_questions")
    .select("id, competency, question, display_order")
    .eq("session_id", sessionId)
    .eq("user_id", userId)
    .order("display_order", { ascending: true });
  if (questionsError) return null;

  const [transcript, scores] = await Promise.all([
    getTranscriptTurns(userId, sessionId),
    getSessionScores(supabase, userId, (questions ?? []).map((row) => row.id as string)),
  ]);

  return {
    id: session.id,
    role: session.role,
    company: session.company,
    mode: session.mode,
    status: session.status,
    difficulty: session.difficulty,
    jobDescription: session.job_description,
    createdAt: session.created_at,
    questions: (questions as InterviewQuestionRow[]).map((row) => ({
      id: row.id,
      competency: row.competency,
      question: row.question,
      displayOrder: row.display_order,
    })),
    transcript,
    scores,
    summary:
      session.overall_score === null
        ? null
        : {
            overallScore: session.overall_score,
            strengths: session.strengths,
            weaknesses: session.weaknesses,
            recommendedPractice: session.recommended_practice,
          },
    focusCompetencies: session.focus_competencies ?? [],
    practicedFromSessionId: session.practiced_from_session_id,
  };
}

type ProgressSessionRow = { id: string; role: string; company: string | null; overall_score: number | null; completed_at: string };
type ProgressQuestionRow = { id: string; competency: InterviewCompetency; session_id: string };

/**
 * Every completed session's overall score, oldest first, plus each
 * competency's score history across all of them — "track improvement
 * over time". Same plain-queries-merged-in-JS approach as
 * getSessionScores (competencies -> their answers -> those answers'
 * scores, filtered by a fetched id list rather than a multi-level
 * embed), just across every completed session instead of one.
 */
export async function getInterviewProgress(userId: string): Promise<InterviewProgress> {
  const supabase = await createClient();

  const { data: sessionRows } = await supabase
    .from("interview_sessions")
    .select("id, role, company, overall_score, completed_at")
    .eq("user_id", userId)
    .eq("status", "completed")
    .order("completed_at", { ascending: true });

  const sessions = (sessionRows ?? []) as ProgressSessionRow[];
  const progressSessions = sessions.map((row) => ({
    id: row.id,
    role: row.role,
    company: row.company,
    overallScore: row.overall_score,
    completedAt: row.completed_at,
  }));
  if (sessions.length === 0) return { sessions: progressSessions, competencies: [] };

  const { data: questionRows } = await supabase
    .from("interview_questions")
    .select("id, competency, session_id")
    .eq("user_id", userId)
    .in(
      "session_id",
      sessions.map((row) => row.id),
    );
  const questions = (questionRows ?? []) as ProgressQuestionRow[];
  if (questions.length === 0) return { sessions: progressSessions, competencies: [] };

  const scores = await getSessionScores(
    supabase,
    userId,
    questions.map((row) => row.id),
  );

  const sessionById = new Map(sessions.map((row) => [row.id, row]));
  const historiesByCompetency = new Map<InterviewCompetency, { score: number; completedAt: string; sessionId: string }[]>();

  for (const question of questions) {
    const score = scores[question.id];
    const session = sessionById.get(question.session_id);
    if (!score || !session) continue;

    const history = historiesByCompetency.get(question.competency) ?? [];
    history.push({ score: score.overallScore, completedAt: session.completed_at, sessionId: session.id });
    historiesByCompetency.set(question.competency, history);
  }

  const competencies: InterviewCompetencyProgress[] = Array.from(historiesByCompetency.entries()).map(
    ([competency, history]) => {
      const sorted = [...history].sort((a, b) => new Date(a.completedAt).getTime() - new Date(b.completedAt).getTime());
      return {
        competency,
        history: sorted,
        firstScore: sorted[0].score,
        latestScore: sorted[sorted.length - 1].score,
        delta: sorted[sorted.length - 1].score - sorted[0].score,
      };
    },
  );

  return { sessions: progressSessions, competencies };
}
