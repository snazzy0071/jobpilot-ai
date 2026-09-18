"use server";

import { revalidatePath } from "next/cache";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { generateStructuredGated } from "@/lib/ai/gateway";
import { AIServiceError } from "@/lib/ai/errors";
import { EntitlementError } from "@/lib/entitlements/service";
import {
  toPromptCallOptions,
  interviewOpeningTurnPrompt,
  interviewOpeningTurnSchema,
  interviewChatTurnPrompt,
  interviewChatTurnSchema,
  interviewAnswerScorePrompt,
  interviewAnswerScoreSchema,
  interviewSessionSummaryPrompt,
  interviewSessionSummarySchema,
} from "@/lib/ai/prompts";
import {
  getSessionForChat,
  nextSequenceIndex,
  insertTranscriptTurn,
  countPrimaryQuestions,
  getFollowUpState,
  appendAnswer,
  completeSession,
  getAnswer,
  persistAnswerScore,
  persistSessionSummary,
} from "@/lib/interviews/internal";
import { getTranscriptTurns, getSessionScores } from "@/lib/interviews/queries";
import { formatTranscriptForPrompt } from "@/lib/interviews/transcript";
import { startInterviewSchema, submitInterviewAnswerSchema } from "@/lib/interviews/schemas";
import type { InterviewTranscriptTurn, InterviewStatus, InterviewAnswerScore } from "@/lib/interviews/types";
import type { MeteredKey } from "@/lib/entitlements/types";

export type InterviewTurnResult =
  | { error: string; quotaExceeded?: boolean }
  | {
      turns: InterviewTranscriptTurn[];
      status: InterviewStatus;
      questionsAskedSoFar: number;
      /** The just-finished question's score, if the interviewer moved on or concluded this turn — null while still mid-question (a follow-up) or if scoring failed. */
      finishedQuestionScore: InterviewAnswerScore | null;
    };

function safeErrorMessage(err: unknown): string {
  if (err instanceof AIServiceError || err instanceof EntitlementError) return err.message;
  console.error("Interview chat turn failed:", err);
  return "Couldn't continue the interview — try again.";
}

function toTurn(inserted: { id: string; content: string; questionId: string | null; sequenceIndex: number }, speaker: "interviewer" | "candidate"): InterviewTranscriptTurn {
  return { id: inserted.id, speaker, content: inserted.content, questionId: inserted.questionId, sequenceIndex: inserted.sequenceIndex };
}

const MIN_QUESTIONS = 5;
const MAX_QUESTIONS = 8;

/**
 * Scores the answer to a question that's just been left behind (the
 * interviewer moved to a fresh question or concluded) — never mid-
 * follow-up, so it always scores the complete, final answer. Best-
 * effort: a scoring failure must never break the conversation turn
 * itself, it just means that answer's score isn't available.
 */
async function scoreFinishedQuestion(
  supabase: SupabaseClient,
  params: { userId: string; role: string; questionId: string; questionText: string },
): Promise<InterviewAnswerScore | null> {
  const answer = await getAnswer(supabase, params.questionId);
  if (!answer) return null;

  try {
    const result = await generateStructuredGated(
      { userId: params.userId },
      {
        ...toPromptCallOptions(interviewAnswerScorePrompt, {
          role: params.role,
          question: params.questionText,
          answerTranscript: answer.answerText,
        }),
        schema: interviewAnswerScoreSchema,
      },
    );
    await persistAnswerScore(supabase, {
      answerId: answer.id,
      userId: params.userId,
      output: result,
      promptVersion: interviewAnswerScorePrompt.version,
    });
    return { ...result, suggestedRephrase: result.suggestedRephrase ?? null };
  } catch (err) {
    console.error("Interview answer scoring failed:", err);
    return null;
  }
}

/**
 * Synthesizes the whole session into results (interviewSessionSummaryPrompt)
 * — fired once, right when the session concludes, from the real
 * per-answer scores/feedback already persisted (not a fresh read of the
 * raw transcript). Best-effort: a failed summary must never undo the
 * session already being marked completed, it just leaves the results
 * page's summary section empty.
 */
async function generateSessionSummary(
  supabase: SupabaseClient,
  params: { userId: string; sessionId: string; role: string; company: string },
): Promise<void> {
  const { data: questions } = await supabase
    .from("interview_questions")
    .select("id, competency, question")
    .eq("session_id", params.sessionId)
    .eq("user_id", params.userId)
    .order("display_order", { ascending: true });
  if (!questions || questions.length === 0) return;

  const scores = await getSessionScores(
    supabase,
    params.userId,
    questions.map((question) => question.id as string),
  );

  const answers = questions
    .filter((question) => scores[question.id as string])
    .map((question) => {
      const score = scores[question.id as string];
      return {
        question: question.question as string,
        competency: question.competency,
        overallScore: score.overallScore,
        strengths: score.strengths,
        improvements: score.improvements,
      };
    });
  if (answers.length === 0) return;

  try {
    const result = await generateStructuredGated(
      { userId: params.userId },
      {
        ...toPromptCallOptions(interviewSessionSummaryPrompt, { role: params.role, company: params.company, answers }),
        schema: interviewSessionSummarySchema,
      },
    );
    await persistSessionSummary(supabase, {
      sessionId: params.sessionId,
      userId: params.userId,
      output: result,
      promptVersion: interviewSessionSummaryPrompt.version,
    });
  } catch (err) {
    console.error("Interview session summary failed:", err);
  }
}

/**
 * Starts the conversation — the one point a
 * chat_interviews_per_month/voice_interviews_per_month credit is spent
 * for this session (see src/lib/interviews/actions.ts's
 * createInterviewSession doc comment for why it isn't spent at setup).
 */
export async function startInterview(sessionId: string): Promise<InterviewTurnResult> {
  const user = await requireUser();
  const parsed = startInterviewSchema.safeParse({ sessionId });
  if (!parsed.success) return { error: "Invalid request." };

  const supabase = await createClient();
  const session = await getSessionForChat(supabase, user.id, sessionId);
  if (!session) return { error: "That interview couldn't be found." };
  if (session.status !== "in_progress") return { error: "This interview has already ended." };

  const existing = await getTranscriptTurns(user.id, sessionId);
  if (existing.length > 0) return { error: "This interview has already started." };

  const meteredKey: MeteredKey = session.mode === "voice" ? "voice_interviews_per_month" : "chat_interviews_per_month";

  let result;
  try {
    result = await generateStructuredGated(
      { userId: user.id, meteredKey },
      {
        ...toPromptCallOptions(interviewOpeningTurnPrompt, {
          role: session.role,
          company: session.company,
          jobDescription: session.jobDescription ?? undefined,
          difficulty: session.difficulty,
          cvText: session.cvTextSnapshot,
          focusCompetencies: session.focusCompetencies,
        }),
        schema: interviewOpeningTurnSchema,
      },
    );
  } catch (err) {
    // Only startInterview ever spends the voice_interviews_per_month
    // credit (see this function's own doc comment) — an EntitlementError
    // here specifically means "out of voice interviews this month", so
    // the UI can offer a top-up purchase instead of a plain dead end.
    // submitInterviewAnswer's own generateStructuredGated call below has
    // no meteredKey, so it can never throw this for the same reason.
    const quotaExceeded = session.mode === "voice" && err instanceof EntitlementError;
    return { error: safeErrorMessage(err), quotaExceeded };
  }

  const { data: questionRow, error: questionError } = await supabase
    .from("interview_questions")
    .insert({
      session_id: sessionId,
      user_id: user.id,
      competency: result.competency,
      question: result.message,
      display_order: 0,
      prompt_version: interviewOpeningTurnPrompt.version,
    })
    .select("id")
    .single();
  if (questionError || !questionRow) return { error: "Couldn't start that interview — try again." };

  const turn = await insertTranscriptTurn(supabase, {
    sessionId,
    userId: user.id,
    questionId: questionRow.id,
    speaker: "interviewer",
    content: result.message,
    sequenceIndex: 0,
  });
  if (!turn) return { error: "Couldn't start that interview — try again." };

  revalidatePath(`/dashboard/interview/${sessionId}`);
  return { turns: [toTurn(turn, "interviewer")], status: "in_progress", questionsAskedSoFar: 1, finishedQuestionScore: null };
}

/**
 * Submits the candidate's reply — to the opening question, a follow-up,
 * or any question in between — and drives the interviewer's next move:
 * a contextual follow-up, a fresh competency question, or concluding
 * the interview (5-8 questions total, enforced server-side regardless
 * of what the model itself decides). When a question is left behind,
 * its now-final answer is scored (interviewAnswerScorePrompt) before
 * this returns.
 */
export async function submitInterviewAnswer(
  sessionId: string,
  answerText: string,
  durationSeconds?: number,
): Promise<InterviewTurnResult> {
  const user = await requireUser();
  const parsed = submitInterviewAnswerSchema.safeParse({ sessionId, answerText, durationSeconds });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const session = await getSessionForChat(supabase, user.id, sessionId);
  if (!session) return { error: "That interview couldn't be found." };
  if (session.status !== "in_progress") return { error: "This interview has already ended." };

  const transcriptSoFar = await getTranscriptTurns(user.id, sessionId);
  if (transcriptSoFar.length === 0) return { error: "Start the interview first." };

  const lastInterviewerTurn = [...transcriptSoFar].reverse().find((turn) => turn.speaker === "interviewer");
  if (!lastInterviewerTurn || !lastInterviewerTurn.questionId) {
    return { error: "There's no question to answer right now." };
  }
  const currentQuestionId = lastInterviewerTurn.questionId;

  let nextIndex = await nextSequenceIndex(supabase, sessionId);
  const candidateTurn = await insertTranscriptTurn(supabase, {
    sessionId,
    userId: user.id,
    questionId: currentQuestionId,
    speaker: "candidate",
    content: parsed.data.answerText,
    sequenceIndex: nextIndex,
  });
  if (!candidateTurn) return { error: "Couldn't save that answer — try again." };
  await appendAnswer(supabase, {
    questionId: currentQuestionId,
    userId: user.id,
    replyText: parsed.data.answerText,
    durationSeconds: parsed.data.durationSeconds,
  });
  nextIndex += 1;

  const newTurns: InterviewTranscriptTurn[] = [toTurn(candidateTurn, "candidate")];
  const primaryQuestionCount = await countPrimaryQuestions(supabase, sessionId);

  const { data: currentQuestionRow } = await supabase
    .from("interview_questions")
    .select("question")
    .eq("id", currentQuestionId)
    .maybeSingle();
  const currentQuestionText = currentQuestionRow?.question ?? "";

  // Hard ceiling — force conclude with no AI call once the max is reached.
  if (primaryQuestionCount >= MAX_QUESTIONS) {
    const closing = "That's a great place to stop — thank you for your thoughtful answers, that concludes this mock interview.";
    const closingTurn = await insertTranscriptTurn(supabase, {
      sessionId,
      userId: user.id,
      questionId: null,
      speaker: "interviewer",
      content: closing,
      sequenceIndex: nextIndex,
    });
    if (closingTurn) newTurns.push(toTurn(closingTurn, "interviewer"));

    const finishedQuestionScore = await scoreFinishedQuestion(supabase, {
      userId: user.id,
      role: session.role,
      questionId: currentQuestionId,
      questionText: currentQuestionText,
    });
    await completeSession(supabase, { sessionId, userId: user.id, startedAt: session.startedAt });
    await generateSessionSummary(supabase, { userId: user.id, sessionId, role: session.role, company: session.company });

    revalidatePath(`/dashboard/interview/${sessionId}`);
    return { turns: newTurns, status: "completed", questionsAskedSoFar: primaryQuestionCount, finishedQuestionScore };
  }

  const { mustAdvance } = await getFollowUpState(supabase, currentQuestionId);
  const canConclude = primaryQuestionCount >= MIN_QUESTIONS;

  let result;
  try {
    result = await generateStructuredGated(
      { userId: user.id },
      {
        ...toPromptCallOptions(interviewChatTurnPrompt, {
          role: session.role,
          company: session.company,
          jobDescription: session.jobDescription ?? undefined,
          difficulty: session.difficulty,
          cvText: session.cvTextSnapshot,
          focusCompetencies: session.focusCompetencies,
          transcript: formatTranscriptForPrompt([...transcriptSoFar, toTurn(candidateTurn, "candidate")]),
          questionsAskedSoFar: primaryQuestionCount,
          canConclude,
          mustAdvance,
        }),
        schema: interviewChatTurnSchema,
      },
    );
  } catch (err) {
    return { error: safeErrorMessage(err) };
  }

  // Defense in depth — never fully trust the model for hard limits it was only asked, not forced, to respect.
  let action = result.action;
  if (action === "conclude" && !canConclude) action = "next_question";
  if (action === "follow_up" && mustAdvance) action = "next_question";

  if (action === "conclude") {
    const closingTurn = await insertTranscriptTurn(supabase, {
      sessionId,
      userId: user.id,
      questionId: null,
      speaker: "interviewer",
      content: result.message,
      sequenceIndex: nextIndex,
    });
    if (closingTurn) newTurns.push(toTurn(closingTurn, "interviewer"));

    const finishedQuestionScore = await scoreFinishedQuestion(supabase, {
      userId: user.id,
      role: session.role,
      questionId: currentQuestionId,
      questionText: currentQuestionText,
    });
    await completeSession(supabase, { sessionId, userId: user.id, startedAt: session.startedAt });
    await generateSessionSummary(supabase, { userId: user.id, sessionId, role: session.role, company: session.company });

    revalidatePath(`/dashboard/interview/${sessionId}`);
    return { turns: newTurns, status: "completed", questionsAskedSoFar: primaryQuestionCount, finishedQuestionScore };
  }

  if (action === "next_question") {
    const { data: questionRow, error: questionError } = await supabase
      .from("interview_questions")
      .insert({
        session_id: sessionId,
        user_id: user.id,
        competency: result.competency ?? "communication",
        question: result.message,
        display_order: primaryQuestionCount,
        prompt_version: interviewChatTurnPrompt.version,
      })
      .select("id")
      .single();
    if (questionError || !questionRow) return { error: "Couldn't continue the interview — try again." };

    const turn = await insertTranscriptTurn(supabase, {
      sessionId,
      userId: user.id,
      questionId: questionRow.id,
      speaker: "interviewer",
      content: result.message,
      sequenceIndex: nextIndex,
    });
    if (turn) newTurns.push(toTurn(turn, "interviewer"));

    const finishedQuestionScore = await scoreFinishedQuestion(supabase, {
      userId: user.id,
      role: session.role,
      questionId: currentQuestionId,
      questionText: currentQuestionText,
    });

    revalidatePath(`/dashboard/interview/${sessionId}`);
    return { turns: newTurns, status: "in_progress", questionsAskedSoFar: primaryQuestionCount + 1, finishedQuestionScore };
  }

  // follow_up — same question, not yet final, so nothing is scored.
  const turn = await insertTranscriptTurn(supabase, {
    sessionId,
    userId: user.id,
    questionId: currentQuestionId,
    speaker: "interviewer",
    content: result.message,
    sequenceIndex: nextIndex,
  });
  if (turn) newTurns.push(toTurn(turn, "interviewer"));

  revalidatePath(`/dashboard/interview/${sessionId}`);
  return { turns: newTurns, status: "in_progress", questionsAskedSoFar: primaryQuestionCount, finishedQuestionScore: null };
}
