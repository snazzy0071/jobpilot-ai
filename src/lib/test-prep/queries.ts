import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { TestType, QuestionPack, Question, PracticeProgress } from "@/lib/test-prep/types";

// Every function here reads through the anon-respecting client
// (src/lib/supabase/server.ts) — this is a public-facing feature (any
// signed-in user practising, not an admin), so `questions` naturally
// comes back without `correct_answer`/`explanation` regardless of what
// gets selected (migration 0067's column-level grant enforces that at
// the database, not just by this file choosing not to ask for them).

const TEST_TYPE_FIELDS = "id, slug, name, description, is_active";
const QUESTION_PACK_FIELDS = "id, test_type_id, slug, name, description, sector_style, time_limit_seconds, is_active";
const QUESTION_FIELDS = "id, question_pack_id, question_type, prompt, options, difficulty, subtype, display_order, is_active";

type TestTypeRow = { id: string; slug: string; name: string; description: string | null; is_active: boolean };

function toTestType(row: TestTypeRow): TestType {
  return { id: row.id, slug: row.slug, name: row.name, description: row.description, isActive: row.is_active };
}

type QuestionPackRow = {
  id: string;
  test_type_id: string;
  slug: string;
  name: string;
  description: string | null;
  sector_style: string | null;
  time_limit_seconds: number | null;
  is_active: boolean;
};

function toQuestionPack(row: QuestionPackRow): QuestionPack {
  return {
    id: row.id,
    testTypeId: row.test_type_id,
    slug: row.slug,
    name: row.name,
    description: row.description,
    sectorStyle: row.sector_style,
    timeLimitSeconds: row.time_limit_seconds,
    isActive: row.is_active,
  };
}

type QuestionRow = {
  id: string;
  question_pack_id: string;
  question_type: Question["questionType"];
  prompt: string;
  options: string[];
  difficulty: Question["difficulty"];
  subtype: string | null;
  display_order: number;
  is_active: boolean;
};

function toQuestion(row: QuestionRow): Question {
  return {
    id: row.id,
    questionPackId: row.question_pack_id,
    questionType: row.question_type,
    prompt: row.prompt,
    options: row.options,
    difficulty: row.difficulty,
    subtype: row.subtype,
    displayOrder: row.display_order,
    isActive: row.is_active,
  };
}

export async function listActiveTestTypes(): Promise<TestType[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("test_types").select(TEST_TYPE_FIELDS).eq("is_active", true).order("name");
  if (error || !data) return [];
  return data.map(toTestType);
}

export async function getTestTypeBySlug(slug: string): Promise<TestType | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("test_types").select(TEST_TYPE_FIELDS).eq("slug", slug).eq("is_active", true).maybeSingle();
  if (error || !data) return null;
  return toTestType(data);
}

export async function listActivePacksForType(testTypeId: string): Promise<QuestionPack[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("question_packs")
    .select(QUESTION_PACK_FIELDS)
    .eq("test_type_id", testTypeId)
    .eq("is_active", true)
    .order("name");
  if (error || !data) return [];
  return data.map(toQuestionPack);
}

export async function getQuestionPackById(id: string): Promise<QuestionPack | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("question_packs").select(QUESTION_PACK_FIELDS).eq("id", id).eq("is_active", true).maybeSingle();
  if (error || !data) return null;
  return toQuestionPack(data);
}

/** Every active question in a pack, in display order — the practice engine's own data source. Never carries correct_answer/explanation (see this file's own header comment). */
export async function listActiveQuestions(questionPackId: string): Promise<Question[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("questions")
    .select(QUESTION_FIELDS)
    .eq("question_pack_id", questionPackId)
    .eq("is_active", true)
    .order("display_order");
  if (error || !data) return [];
  return data.map(toQuestion);
}

/** Every active question across every active pack, unordered — the daily-practice question pool (src/lib/test-prep/daily/actions.ts picks a random 5 from this). Same "never carries correct_answer/explanation" guarantee as listActiveQuestions. Two queries rather than an embedded-resource filter, matching this file's existing style. */
export async function listActiveQuestionsAcrossAllPacks(): Promise<Question[]> {
  const supabase = await createClient();
  const { data: packs, error: packsError } = await supabase.from("question_packs").select("id").eq("is_active", true);
  if (packsError || !packs || packs.length === 0) return [];

  const { data, error } = await supabase
    .from("questions")
    .select(QUESTION_FIELDS)
    .in(
      "question_pack_id",
      packs.map((pack) => pack.id),
    )
    .eq("is_active", true);
  if (error || !data) return [];
  return data.map(toQuestion);
}

/** A cheap existence check for whether the "Progress" link (src/app/(dashboard)/dashboard/test-prep/progress) has anything real to show — a plain count, not the full analytics computation getTestPrepInsights does. */
export async function hasCompletedTestPrepSession(userId: string): Promise<boolean> {
  const supabase = await createClient();
  const { count } = await supabase
    .from("test_sessions")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .not("completed_at", "is", null);
  return (count ?? 0) > 0;
}

/** This user's own progress across every test_type they've practised — RLS (`auth.uid() = user_id`) already scopes it. */
export async function listPracticeProgress(userId: string): Promise<PracticeProgress[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("practice_progress")
    .select("id, test_type_id, attempts_count, best_score, last_practiced_at")
    .eq("user_id", userId);
  if (error || !data) return [];
  return data.map((row) => ({
    id: row.id,
    testTypeId: row.test_type_id,
    attemptsCount: row.attempts_count,
    bestScore: row.best_score,
    lastPracticedAt: row.last_practiced_at,
  }));
}
