import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { InterviewMode, InterviewStatus, InterviewDifficulty, InterviewSpeaker, InterviewCompetency } from "@/lib/interviews/types";
import type { InterviewAnswerScoreOutput } from "@/lib/ai/prompts/interview-answer-score";
import type { InterviewSessionSummaryOutput } from "@/lib/ai/prompts/interview-session-summary";

// Shared by chat-actions.ts (the live turn-by-turn conversation) —
// small, focused DB helpers rather than inlining this logic into every
// action, same split as src/lib/cvs/internal.ts and
// src/lib/cover-letters/internal.ts.

export type ChatSessionContext = {
  role: string;
  company: string;
  jobDescription: string | null;
  difficulty: InterviewDifficulty;
  cvTextSnapshot: string;
  mode: InterviewMode;
  status: InterviewStatus;
  startedAt: string;
  /** Set when this session is a targeted re-practice of specific weak competencies (migration 0044) — empty for an ordinary session, in which case the AI prompts fall back to the full 10-competency spread. */
  focusCompetencies: InterviewCompetency[];
};

/** Ownership check + the grounding fields every chat-turn AI call needs, in one query. Returns null if the session doesn't exist or isn't owned by this user — RLS would already block a mismatched read, this just makes that explicit and gives a typed result instead of a raw row. */
export async function getSessionForChat(
  supabase: SupabaseClient,
  userId: string,
  sessionId: string,
): Promise<ChatSessionContext | null> {
  const { data, error } = await supabase
    .from("interview_sessions")
    .select("role, company, job_description, difficulty, cv_text_snapshot, mode, status, started_at, focus_competencies")
    .eq("id", sessionId)
    .eq("user_id", userId)
    .maybeSingle();
  if (error || !data) return null;

  return {
    role: data.role,
    company: data.company,
    jobDescription: data.job_description,
    difficulty: data.difficulty,
    cvTextSnapshot: data.cv_text_snapshot,
    mode: data.mode,
    status: data.status,
    startedAt: data.started_at,
    focusCompetencies: data.focus_competencies ?? [],
  };
}

export async function nextSequenceIndex(supabase: SupabaseClient, sessionId: string): Promise<number> {
  const { data } = await supabase
    .from("interview_transcripts")
    .select("sequence_index")
    .eq("session_id", sessionId)
    .order("sequence_index", { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data?.sequence_index ?? -1) + 1;
}

export type InsertedTranscriptTurn = { id: string; content: string; questionId: string | null; sequenceIndex: number };

export async function insertTranscriptTurn(
  supabase: SupabaseClient,
  params: { sessionId: string; userId: string; questionId: string | null; speaker: InterviewSpeaker; content: string; sequenceIndex: number },
): Promise<InsertedTranscriptTurn | null> {
  const { data, error } = await supabase
    .from("interview_transcripts")
    .insert({
      session_id: params.sessionId,
      user_id: params.userId,
      question_id: params.questionId,
      speaker: params.speaker,
      content: params.content,
      sequence_index: params.sequenceIndex,
    })
    .select("id, content, question_id, sequence_index")
    .single();
  if (error || !data) return null;

  return { id: data.id, content: data.content, questionId: data.question_id, sequenceIndex: data.sequence_index };
}

export async function countPrimaryQuestions(supabase: SupabaseClient, sessionId: string): Promise<number> {
  const { data } = await supabase.from("interview_questions").select("id").eq("session_id", sessionId);
  return data?.length ?? 0;
}

const MAX_FOLLOW_UPS_PER_QUESTION = 2;

/** How many follow-ups a question has already had (interviewer turns on it beyond the original ask), and whether another is still allowed. */
export async function getFollowUpState(
  supabase: SupabaseClient,
  questionId: string,
): Promise<{ followUpCount: number; mustAdvance: boolean }> {
  const { data } = await supabase
    .from("interview_transcripts")
    .select("id")
    .eq("question_id", questionId)
    .eq("speaker", "interviewer");
  const interviewerTurns = data?.length ?? 0;
  const followUpCount = Math.max(interviewerTurns - 1, 0);
  return { followUpCount, mustAdvance: followUpCount >= MAX_FOLLOW_UPS_PER_QUESTION };
}

/**
 * The "final" answer for a question is every candidate reply to it
 * (the original answer plus any follow-up replies) concatenated in
 * order — a follow-up usually adds detail rather than replacing what
 * was already said, so nothing is discarded. `unique(question_id)` on
 * interview_answers (migration 0040) is what makes this an upsert
 * rather than a plain insert.
 */
export async function appendAnswer(
  supabase: SupabaseClient,
  params: { questionId: string; userId: string; replyText: string; durationSeconds?: number },
): Promise<void> {
  const { data: existing } = await supabase
    .from("interview_answers")
    .select("answer_text, duration_seconds")
    .eq("question_id", params.questionId)
    .maybeSingle();

  const combined = existing?.answer_text ? `${existing.answer_text}\n\n${params.replyText}` : params.replyText;
  // Only accumulated when the caller actually measured a duration (voice
  // mode) — a chat-mode reply on the same question must not silently
  // reset an existing voice-mode duration to null.
  const totalDurationSeconds =
    params.durationSeconds === undefined ? (existing?.duration_seconds ?? null) : (existing?.duration_seconds ?? 0) + params.durationSeconds;

  await supabase.from("interview_answers").upsert(
    {
      question_id: params.questionId,
      user_id: params.userId,
      answer_text: combined.slice(0, 8000),
      duration_seconds: totalDurationSeconds,
    },
    { onConflict: "question_id" },
  );
}

/** Marks the session completed and records how long it actually took — real elapsed wall-clock time since started_at, not a client-reported figure. */
export async function completeSession(
  supabase: SupabaseClient,
  params: { sessionId: string; userId: string; startedAt: string },
): Promise<void> {
  const durationSeconds = Math.max(0, Math.round((Date.now() - new Date(params.startedAt).getTime()) / 1000));
  await supabase
    .from("interview_sessions")
    .update({ status: "completed", completed_at: new Date().toISOString(), duration_seconds: durationSeconds })
    .eq("id", params.sessionId)
    .eq("user_id", params.userId);
}

export async function getAnswer(supabase: SupabaseClient, questionId: string): Promise<{ id: string; answerText: string } | null> {
  const { data, error } = await supabase
    .from("interview_answers")
    .select("id, answer_text")
    .eq("question_id", questionId)
    .maybeSingle();
  if (error || !data) return null;
  return { id: data.id, answerText: data.answer_text };
}

/** Persists interviewAnswerScorePrompt's real output shape exactly onto the answer it scored — one row per answer (unique(answer_id), migration 0040). */
export async function persistAnswerScore(
  supabase: SupabaseClient,
  params: { answerId: string; userId: string; output: InterviewAnswerScoreOutput; promptVersion: string },
): Promise<void> {
  const { output } = params;
  const { error } = await supabase.from("interview_scores").insert({
    answer_id: params.answerId,
    user_id: params.userId,
    situation_score: output.situationScore,
    task_score: output.taskScore,
    action_score: output.actionScore,
    result_score: output.resultScore,
    relevance_score: output.relevanceScore,
    clarity_score: output.clarityScore,
    evidence_score: output.evidenceScore,
    overall_score: output.overallScore,
    strengths: output.strengths,
    improvements: output.improvements,
    suggested_rephrase: output.suggestedRephrase ?? null,
    prompt_version: params.promptVersion,
  });
  if (error) console.error("Couldn't persist interview_scores row:", error.message);
}

/** Persists interviewSessionSummaryPrompt's real output shape onto the session it summarizes — migration 0043. Best-effort, called once at conclude time: a failed summary must never undo the session already being marked completed. */
export async function persistSessionSummary(
  supabase: SupabaseClient,
  params: { sessionId: string; userId: string; output: InterviewSessionSummaryOutput; promptVersion: string },
): Promise<void> {
  const { error } = await supabase
    .from("interview_sessions")
    .update({
      overall_score: params.output.overallScore,
      strengths: params.output.strengths,
      weaknesses: params.output.weaknesses,
      recommended_practice: params.output.recommendedPractice,
      summary_prompt_version: params.promptVersion,
    })
    .eq("id", params.sessionId)
    .eq("user_id", params.userId);
  if (error) console.error("Couldn't persist interview session summary:", error.message);
}
