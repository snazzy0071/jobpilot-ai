import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { exhibitSchema, optionFiguresSchema } from "@/lib/test-prep/exhibit";
import type { AdminTestType, AdminQuestionPack, AdminQuestion } from "@/lib/test-prep/admin/types";

// Every function here reads through the service-role client
// (src/lib/supabase/admin.ts), never the regular request-scoped one —
// not just because these are admin-only reads (requireAdmin() already
// gates every caller), but because `questions.correct_answer`/
// `explanation` are behind a real Postgres column-level grant
// (migration 0067) that the regular client's `authenticated` role
// genuinely cannot select, admin or not. The service-role client is
// the only thing that can read those two columns back at all, so it's
// used uniformly for test_types/question_packs too rather than mixing
// "RLS-gated regular client for two tables, admin client for one".

const TEST_TYPE_FIELDS = "id, slug, name, description, created_by, is_active, created_at, updated_at";
const QUESTION_PACK_FIELDS =
  "id, test_type_id, slug, name, description, sector_style, time_limit_seconds, created_by, is_active, created_at, updated_at";
const QUESTION_FIELDS =
  "id, question_pack_id, question_type, stimulus, prompt, options, exhibit, option_figures, correct_answer, explanation, difficulty, subtype, display_order, created_by, is_active, created_at, updated_at";

type TestTypeRow = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  created_by: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

function toAdminTestType(row: TestTypeRow): AdminTestType {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    description: row.description,
    createdBy: row.created_by,
    isActive: row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

type QuestionPackRow = {
  id: string;
  test_type_id: string;
  slug: string;
  name: string;
  description: string | null;
  sector_style: string | null;
  time_limit_seconds: number | null;
  created_by: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

function toAdminQuestionPack(row: QuestionPackRow): AdminQuestionPack {
  return {
    id: row.id,
    testTypeId: row.test_type_id,
    slug: row.slug,
    name: row.name,
    description: row.description,
    sectorStyle: row.sector_style,
    timeLimitSeconds: row.time_limit_seconds,
    createdBy: row.created_by,
    isActive: row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

type QuestionRow = {
  id: string;
  question_pack_id: string;
  question_type: AdminQuestion["questionType"];
  stimulus: string | null;
  prompt: string;
  options: string[];
  exhibit: unknown;
  option_figures: unknown;
  correct_answer: string | null;
  explanation: string | null;
  difficulty: AdminQuestion["difficulty"];
  subtype: string | null;
  display_order: number;
  created_by: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

function toAdminQuestion(row: QuestionRow): AdminQuestion {
  return {
    id: row.id,
    questionPackId: row.question_pack_id,
    questionType: row.question_type,
    stimulus: row.stimulus,
    prompt: row.prompt,
    options: row.options,
    exhibit: row.exhibit && exhibitSchema.safeParse(row.exhibit).success ? exhibitSchema.parse(row.exhibit) : null,
    optionFigures: row.option_figures && optionFiguresSchema.safeParse(row.option_figures).success ? optionFiguresSchema.parse(row.option_figures) : null,
    correctAnswer: row.correct_answer,
    explanation: row.explanation,
    difficulty: row.difficulty,
    subtype: row.subtype,
    displayOrder: row.display_order,
    createdBy: row.created_by,
    isActive: row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function listTestTypes(): Promise<AdminTestType[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase.from("test_types").select(TEST_TYPE_FIELDS).order("name");
  if (error || !data) return [];
  return data.map(toAdminTestType);
}

export async function getTestTypeById(id: string): Promise<AdminTestType | null> {
  const supabase = createAdminClient();
  const { data, error } = await supabase.from("test_types").select(TEST_TYPE_FIELDS).eq("id", id).maybeSingle();
  if (error || !data) return null;
  return toAdminTestType(data);
}

export async function listQuestionPacks(testTypeId: string): Promise<AdminQuestionPack[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("question_packs")
    .select(QUESTION_PACK_FIELDS)
    .eq("test_type_id", testTypeId)
    .order("name");
  if (error || !data) return [];
  return data.map(toAdminQuestionPack);
}

export async function getQuestionPackById(id: string): Promise<AdminQuestionPack | null> {
  const supabase = createAdminClient();
  const { data, error } = await supabase.from("question_packs").select(QUESTION_PACK_FIELDS).eq("id", id).maybeSingle();
  if (error || !data) return null;
  return toAdminQuestionPack(data);
}

export async function listQuestions(questionPackId: string): Promise<AdminQuestion[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("questions")
    .select(QUESTION_FIELDS)
    .eq("question_pack_id", questionPackId)
    .order("display_order");
  if (error || !data) return [];
  return data.map(toAdminQuestion);
}

export async function getQuestionById(id: string): Promise<AdminQuestion | null> {
  const supabase = createAdminClient();
  const { data, error } = await supabase.from("questions").select(QUESTION_FIELDS).eq("id", id).maybeSingle();
  if (error || !data) return null;
  return toAdminQuestion(data);
}

/** Every topic name already in use, for the question form's suggestions — reusing one keeps accuracy grouped. */
export async function listSubtypes(): Promise<string[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase.from("questions").select("subtype").not("subtype", "is", null).limit(1000);
  if (error || !data) return [];
  return [...new Set(data.map((row) => row.subtype as string))].sort();
}
