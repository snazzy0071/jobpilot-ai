import "server-only";
import type { createAdminClient } from "@/lib/supabase/admin";
import { QUESTION_FIELDS, toQuestion, type QuestionRow } from "@/lib/test-prep/queries";
import type { Question } from "@/lib/test-prep/types";
import type { AnsweredState } from "@/lib/test-prep/practice/types";

type AdminClient = ReturnType<typeof createAdminClient>;

/**
 * Records exactly which questions a session serves, in order (test_session_questions, migration 0106). Users can read
 * this table but not write it: what a session contains is decided here, by the server, when the session starts.
 */
export async function pinSessionQuestions(admin: AdminClient, sessionId: string, userId: string, questionIds: string[]): Promise<boolean> {
  const rows = questionIds.map((questionId, position) => ({ test_session_id: sessionId, user_id: userId, question_id: questionId, position }));
  const { error } = await admin.from("test_session_questions").insert(rows);
  if (error) {
    console.error("pinSessionQuestions failed:", error.message);
    return false;
  }
  return true;
}

/** The questions a session serves, in order — public fields only (never the answer key). */
export async function getPinnedQuestions(admin: AdminClient, sessionId: string): Promise<Question[]> {
  const { data: pins, error } = await admin.from("test_session_questions").select("question_id, position").eq("test_session_id", sessionId).order("position");
  if (error || !pins) throw new Error("Couldn't load this session's questions.");
  const ids = pins.map((pin) => pin.question_id).filter((id): id is string => id !== null);
  if (ids.length === 0) return [];
  const { data, error: questionsError } = await admin.from("questions").select(QUESTION_FIELDS).in("id", ids);
  if (questionsError || !data) throw new Error("Couldn't load this session's questions.");
  const byId = new Map((data as QuestionRow[]).map((row) => [row.id, toQuestion(row)]));
  return ids.map((id) => byId.get(id)).filter((question): question is Question => !!question);
}

/** Whether a question is one this session was set (the check every answer goes through). */
export async function isPinned(admin: AdminClient, sessionId: string, questionId: string): Promise<boolean> {
  const { data } = await admin.from("test_session_questions").select("id").eq("test_session_id", sessionId).eq("question_id", questionId).maybeSingle();
  return !!data;
}

/**
 * Every answer in a session with its answer key and explanation. Only ever called for a FINISHED session (or, in practice
 * mode, for answers the person has already been shown) — for a session still in progress the key must stay on the server.
 */
export async function getGradedAnswers(admin: AdminClient, sessionId: string, questionIds: string[]): Promise<AnsweredState[]> {
  if (questionIds.length === 0) return [];
  const { data: answers } = await admin.from("test_answers").select("question_id, selected_answer, is_correct").eq("test_session_id", sessionId);
  const { data: keys } = await admin.from("questions").select("id, correct_answer, explanation").in("id", questionIds);
  const keyById = new Map((keys ?? []).map((row) => [row.id, row]));
  return (answers ?? [])
    .filter((answer) => answer.question_id !== null)
    .map((answer) => ({
      questionId: answer.question_id as string,
      selectedAnswer: answer.selected_answer,
      isCorrect: answer.is_correct,
      correctAnswer: keyById.get(answer.question_id as string)?.correct_answer ?? null,
      explanation: keyById.get(answer.question_id as string)?.explanation ?? null,
    }));
}
