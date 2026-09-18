"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  createTestTypeSchema,
  updateTestTypeSchema,
  deleteTestTypeSchema,
  createQuestionPackSchema,
  updateQuestionPackSchema,
  deleteQuestionPackSchema,
  createQuestionSchema,
  updateQuestionSchema,
  deleteQuestionSchema,
} from "@/lib/test-prep/admin/schemas";

export type TestPrepActionResult = { error: string } | { id: string };
export type TestPrepMutationResult = { error: string } | { success: string } | void;

// Matches QuestionForm's own NO_DIFFICULTY sentinel
// (src/components/admin/question-form.tsx) — its <Select> can't submit
// a real empty string as a value, so "not set" is this instead;
// translated back to undefined here, before the field ever reaches
// createQuestionSchema/updateQuestionSchema.
const NO_DIFFICULTY_SENTINEL = "__none__";

function normalizeDifficulty(value: FormDataEntryValue | null): string | undefined {
  if (!value || value === NO_DIFFICULTY_SENTINEL) return undefined;
  return value.toString();
}

// requireAdmin() is the real permission boundary here (same as every
// other admin action this session) — the actual DB write goes through
// the service-role client (src/lib/test-prep/admin/queries.ts's own
// header comment explains why: `questions.correct_answer`/
// `explanation` are behind a real column-level grant migration 0067
// set up, which the regular authenticated client can't read or usefully
// write back through, admin session or not). Migration 0067's RLS
// admin-write policies (`profiles.role = 'admin'`) still exist and
// still matter as defence in depth for any future code path that uses
// the regular client instead — this file just isn't that path.

export async function createTestType(formData: FormData): Promise<TestPrepActionResult> {
  const { user } = await requireAdmin();

  const parsed = createTestTypeSchema.safeParse({
    slug: formData.get("slug"),
    name: formData.get("name"),
    description: formData.get("description") || undefined,
    isActive: formData.get("isActive") === "on",
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("test_types")
    .insert({
      slug: parsed.data.slug,
      name: parsed.data.name,
      description: parsed.data.description,
      is_active: parsed.data.isActive,
      created_by: user.id,
    })
    .select("id")
    .single();

  if (error || !data) return { error: error?.code === "23505" ? "That slug is already in use." : "Couldn't save that test type — try again." };

  revalidatePath("/admin/test-prep");
  return { id: data.id };
}

export async function updateTestType(_prevState: TestPrepMutationResult, formData: FormData): Promise<TestPrepMutationResult> {
  await requireAdmin();

  const parsed = updateTestTypeSchema.safeParse({
    id: formData.get("id"),
    slug: formData.get("slug"),
    name: formData.get("name"),
    description: formData.get("description") || undefined,
    isActive: formData.get("isActive") === "on",
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = createAdminClient();
  const { error } = await supabase
    .from("test_types")
    .update({ slug: parsed.data.slug, name: parsed.data.name, description: parsed.data.description, is_active: parsed.data.isActive })
    .eq("id", parsed.data.id);

  if (error) return { error: error.code === "23505" ? "That slug is already in use." : "Couldn't save that test type — try again." };

  revalidatePath("/admin/test-prep");
  revalidatePath(`/admin/test-prep/test-types/${parsed.data.id}`);
  return { success: "Saved." };
}

export async function deleteTestType(_prevState: TestPrepMutationResult, formData: FormData): Promise<TestPrepMutationResult> {
  await requireAdmin();

  const parsed = deleteTestTypeSchema.safeParse({ id: formData.get("id") });
  if (!parsed.success) return { error: "Invalid request." };

  const supabase = createAdminClient();
  const { error } = await supabase.from("test_types").delete().eq("id", parsed.data.id);
  if (error) return { error: "Couldn't delete that test type — try again." };

  revalidatePath("/admin/test-prep");
  return { success: "Deleted." };
}

export async function createQuestionPack(formData: FormData): Promise<TestPrepActionResult> {
  const { user } = await requireAdmin();

  const parsed = createQuestionPackSchema.safeParse({
    testTypeId: formData.get("testTypeId"),
    slug: formData.get("slug"),
    name: formData.get("name"),
    description: formData.get("description") || undefined,
    sectorStyle: formData.get("sectorStyle") || undefined,
    timeLimitSeconds: formData.get("timeLimitSeconds") || undefined,
    isActive: formData.get("isActive") === "on",
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("question_packs")
    .insert({
      test_type_id: parsed.data.testTypeId,
      slug: parsed.data.slug,
      name: parsed.data.name,
      description: parsed.data.description,
      sector_style: parsed.data.sectorStyle,
      time_limit_seconds: parsed.data.timeLimitSeconds,
      is_active: parsed.data.isActive,
      created_by: user.id,
    })
    .select("id")
    .single();

  if (error || !data) return { error: error?.code === "23505" ? "That slug is already in use for this test type." : "Couldn't save that pack — try again." };

  revalidatePath(`/admin/test-prep/test-types/${parsed.data.testTypeId}`);
  return { id: data.id };
}

export async function updateQuestionPack(_prevState: TestPrepMutationResult, formData: FormData): Promise<TestPrepMutationResult> {
  await requireAdmin();

  const parsed = updateQuestionPackSchema.safeParse({
    id: formData.get("id"),
    testTypeId: formData.get("testTypeId"),
    slug: formData.get("slug"),
    name: formData.get("name"),
    description: formData.get("description") || undefined,
    sectorStyle: formData.get("sectorStyle") || undefined,
    timeLimitSeconds: formData.get("timeLimitSeconds") || undefined,
    isActive: formData.get("isActive") === "on",
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = createAdminClient();
  const { error } = await supabase
    .from("question_packs")
    .update({
      test_type_id: parsed.data.testTypeId,
      slug: parsed.data.slug,
      name: parsed.data.name,
      description: parsed.data.description,
      sector_style: parsed.data.sectorStyle,
      time_limit_seconds: parsed.data.timeLimitSeconds,
      is_active: parsed.data.isActive,
    })
    .eq("id", parsed.data.id);

  if (error) return { error: error.code === "23505" ? "That slug is already in use for this test type." : "Couldn't save that pack — try again." };

  revalidatePath(`/admin/test-prep/test-types/${parsed.data.testTypeId}`);
  revalidatePath(`/admin/test-prep/packs/${parsed.data.id}`);
  return { success: "Saved." };
}

export async function deleteQuestionPack(_prevState: TestPrepMutationResult, formData: FormData): Promise<TestPrepMutationResult> {
  await requireAdmin();

  const parsed = deleteQuestionPackSchema.safeParse({ id: formData.get("id") });
  if (!parsed.success) return { error: "Invalid request." };

  const supabase = createAdminClient();
  const { error } = await supabase.from("question_packs").delete().eq("id", parsed.data.id);
  if (error) return { error: "Couldn't delete that pack — try again." };

  revalidatePath("/admin/test-prep");
  return { success: "Deleted." };
}

export async function createQuestion(formData: FormData): Promise<TestPrepActionResult> {
  const { user } = await requireAdmin();

  const parsed = createQuestionSchema.safeParse({
    questionPackId: formData.get("questionPackId"),
    questionType: formData.get("questionType"),
    prompt: formData.get("prompt"),
    options: formData.get("options") || undefined,
    correctAnswer: formData.get("correctAnswer") || undefined,
    explanation: formData.get("explanation") || undefined,
    difficulty: normalizeDifficulty(formData.get("difficulty")),
    subtype: formData.get("subtype") || undefined,
    displayOrder: formData.get("displayOrder") || undefined,
    isActive: formData.get("isActive") === "on",
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("questions")
    .insert({
      question_pack_id: parsed.data.questionPackId,
      question_type: parsed.data.questionType,
      prompt: parsed.data.prompt,
      options: parsed.data.options,
      correct_answer: parsed.data.correctAnswer,
      explanation: parsed.data.explanation,
      difficulty: parsed.data.difficulty,
      subtype: parsed.data.subtype,
      display_order: parsed.data.displayOrder,
      is_active: parsed.data.isActive,
      created_by: user.id,
    })
    .select("id")
    .single();

  if (error || !data) return { error: "Couldn't save that question — try again." };

  revalidatePath(`/admin/test-prep/packs/${parsed.data.questionPackId}`);
  return { id: data.id };
}

export async function updateQuestion(_prevState: TestPrepMutationResult, formData: FormData): Promise<TestPrepMutationResult> {
  await requireAdmin();

  const parsed = updateQuestionSchema.safeParse({
    id: formData.get("id"),
    questionPackId: formData.get("questionPackId"),
    questionType: formData.get("questionType"),
    prompt: formData.get("prompt"),
    options: formData.get("options") || undefined,
    correctAnswer: formData.get("correctAnswer") || undefined,
    explanation: formData.get("explanation") || undefined,
    difficulty: normalizeDifficulty(formData.get("difficulty")),
    subtype: formData.get("subtype") || undefined,
    displayOrder: formData.get("displayOrder") || undefined,
    isActive: formData.get("isActive") === "on",
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = createAdminClient();
  const { error } = await supabase
    .from("questions")
    .update({
      question_pack_id: parsed.data.questionPackId,
      question_type: parsed.data.questionType,
      prompt: parsed.data.prompt,
      options: parsed.data.options,
      correct_answer: parsed.data.correctAnswer,
      explanation: parsed.data.explanation,
      difficulty: parsed.data.difficulty,
      subtype: parsed.data.subtype,
      display_order: parsed.data.displayOrder,
      is_active: parsed.data.isActive,
    })
    .eq("id", parsed.data.id);

  if (error) return { error: "Couldn't save that question — try again." };

  revalidatePath(`/admin/test-prep/packs/${parsed.data.questionPackId}`);
  revalidatePath(`/admin/test-prep/questions/${parsed.data.id}`);
  return { success: "Saved." };
}

export async function deleteQuestion(_prevState: TestPrepMutationResult, formData: FormData): Promise<TestPrepMutationResult> {
  await requireAdmin();

  const parsed = deleteQuestionSchema.safeParse({ id: formData.get("id") });
  if (!parsed.success) return { error: "Invalid request." };

  const supabase = createAdminClient();
  const { error } = await supabase.from("questions").delete().eq("id", parsed.data.id);
  if (error) return { error: "Couldn't delete that question — try again." };

  revalidatePath("/admin/test-prep");
  return { success: "Deleted." };
}
