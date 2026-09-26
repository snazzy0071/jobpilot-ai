import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { AccuracyRow } from "@/lib/test-prep/accuracy";
import type { QuestionHistory } from "@/lib/test-prep/selection";

type UserClient = Awaited<ReturnType<typeof createClient>>;

/** The signed-in user's accuracy per (test type, subtype, difficulty), from the test_prep_accuracy() SQL function (completed sessions only). Throws on a database error: "no history" must never be what an outage looks like. */
export async function loadAccuracyRows(client?: UserClient): Promise<AccuracyRow[]> {
  const supabase = client ?? (await createClient());
  const { data, error } = await supabase.rpc("test_prep_accuracy", { p_recent_days: 14 });
  if (error) {
    console.error("loadAccuracyRows failed:", error.message);
    throw new Error("Couldn't load your practice history.");
  }
  return ((data ?? []) as Record<string, unknown>[]).map((row) => ({
    testTypeId: (row.test_type_id as string | null) ?? null,
    subtype: row.subtype as string,
    difficulty: (row.difficulty as AccuracyRow["difficulty"]) ?? null,
    total: Number(row.total),
    correct: Number(row.correct),
    recentTotal: Number(row.recent_total),
    recentCorrect: Number(row.recent_correct),
    lastAnsweredAt: (row.last_answered_at as string | null) ?? null,
  }));
}

/** Per question: how the user last did on it and when — what session selection ranks by (migration 0108). */
export async function loadQuestionHistory(client?: UserClient): Promise<Map<string, QuestionHistory>> {
  const supabase = client ?? (await createClient());
  const { data, error } = await supabase.rpc("test_prep_question_history");
  if (error) {
    console.error("loadQuestionHistory failed:", error.message);
    throw new Error("Couldn't load your practice history.");
  }
  const map = new Map<string, QuestionHistory>();
  for (const row of (data ?? []) as { question_id: string; last_correct: boolean; last_answered_at: string }[]) {
    map.set(row.question_id, { lastCorrect: row.last_correct, lastAnsweredAt: row.last_answered_at });
  }
  return map;
}
