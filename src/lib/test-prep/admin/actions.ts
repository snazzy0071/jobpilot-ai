"use server";

import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/admin/permissions";
import { logAdminAction } from "@/lib/admin/audit/log";
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
  setQuestionActiveSchema,
  duplicateQuestionSchema,
  importQuestionsSchema,
  parseImportedQuestions,
} from "@/lib/test-prep/admin/schemas";

export type TestPrepActionResult = { error: string } | { id: string };
export type TestPrepMutationResult = { error: string } | { success: string } | void;
export type ImportQuestionsResult = { error: string; details?: string[] } | { valid: number; imported: number; dryRun: boolean };

// Every action here needs the `manage_test_prep` permission — not merely "is an admin". The page layout checks it too,
// but a Server Action is reachable directly, so the check is repeated at the top of each one (a staff account with a
// different role must not be able to edit practice content by calling the action). The write itself goes through the
// service-role client: `questions.correct_answer` / `explanation` sit behind a column-level grant (migration 0067) the
// regular client can't read or usefully write back through, admin session or not. Each successful change is audit-logged.

// Matches QuestionForm's own NO_DIFFICULTY sentinel — its <Select> can't submit an empty string, so "not set" is this
// instead, translated back to undefined before it reaches the schema.
const NO_DIFFICULTY_SENTINEL = "__none__";

function normalizeDifficulty(value: FormDataEntryValue | null): string | undefined {
  if (!value || value === NO_DIFFICULTY_SENTINEL) return undefined;
  return value.toString();
}

async function actor() {
  const { user } = await requirePermission("manage_test_prep");
  return { id: user.id, email: user.email ?? null };
}

async function audit(who: { id: string; email: string | null }, action: string, entityId: string | null, metadata: Record<string, unknown> = {}) {
  await logAdminAction({ actorId: who.id, actorEmail: who.email, action, entityType: "test_prep", entityId, metadata });
}

function questionFieldsFromForm(formData: FormData) {
  return {
    questionPackId: formData.get("questionPackId"),
    questionType: formData.get("questionType"),
    stimulus: formData.get("stimulus") || undefined,
    prompt: formData.get("prompt"),
    options: formData.get("options") || undefined,
    correctAnswer: formData.get("correctAnswer") || undefined,
    explanation: formData.get("explanation") || undefined,
    difficulty: normalizeDifficulty(formData.get("difficulty")),
    subtype: formData.get("subtype") || undefined,
    exhibit: formData.get("exhibit") || undefined,
    optionFigures: formData.get("optionFigures") || undefined,
    displayOrder: formData.get("displayOrder") || undefined,
    isActive: formData.get("isActive") === "on",
  };
}

// ---- test types -----------------------------------------------------------------------------------------------------

export async function createTestType(formData: FormData): Promise<TestPrepActionResult> {
  const who = await actor();

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
    .insert({ slug: parsed.data.slug, name: parsed.data.name, description: parsed.data.description, is_active: parsed.data.isActive, created_by: who.id })
    .select("id")
    .single();

  if (error || !data) return { error: error?.code === "23505" ? "That slug is already in use." : "Couldn't save that test type — try again." };

  await audit(who, "test_prep.type_create", data.id, { slug: parsed.data.slug });
  revalidatePath("/admin/test-prep");
  return { id: data.id };
}

export async function updateTestType(_prevState: TestPrepMutationResult, formData: FormData): Promise<TestPrepMutationResult> {
  const who = await actor();

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

  await audit(who, "test_prep.type_update", parsed.data.id, { slug: parsed.data.slug, isActive: parsed.data.isActive });
  revalidatePath("/admin/test-prep");
  revalidatePath(`/admin/test-prep/test-types/${parsed.data.id}`);
  return { success: "Saved." };
}

export async function deleteTestType(_prevState: TestPrepMutationResult, formData: FormData): Promise<TestPrepMutationResult> {
  const who = await actor();

  const parsed = deleteTestTypeSchema.safeParse({ id: formData.get("id") });
  if (!parsed.success) return { error: "Invalid request." };

  const supabase = createAdminClient();
  const { error } = await supabase.from("test_types").delete().eq("id", parsed.data.id);
  if (error) return { error: "Couldn't delete that test type — try again." };

  await audit(who, "test_prep.type_delete", parsed.data.id);
  revalidatePath("/admin/test-prep");
  return { success: "Deleted." };
}

// ---- packs ----------------------------------------------------------------------------------------------------------

export async function createQuestionPack(formData: FormData): Promise<TestPrepActionResult> {
  const who = await actor();

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
      created_by: who.id,
    })
    .select("id")
    .single();

  if (error || !data) return { error: error?.code === "23505" ? "That slug is already in use for this test type." : "Couldn't save that pack — try again." };

  await audit(who, "test_prep.pack_create", data.id, { slug: parsed.data.slug });
  revalidatePath(`/admin/test-prep/test-types/${parsed.data.testTypeId}`);
  return { id: data.id };
}

export async function updateQuestionPack(_prevState: TestPrepMutationResult, formData: FormData): Promise<TestPrepMutationResult> {
  const who = await actor();

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

  await audit(who, "test_prep.pack_update", parsed.data.id, { slug: parsed.data.slug, isActive: parsed.data.isActive, timeLimitSeconds: parsed.data.timeLimitSeconds });
  revalidatePath(`/admin/test-prep/test-types/${parsed.data.testTypeId}`);
  revalidatePath(`/admin/test-prep/packs/${parsed.data.id}`);
  return { success: "Saved." };
}

export async function deleteQuestionPack(_prevState: TestPrepMutationResult, formData: FormData): Promise<TestPrepMutationResult> {
  const who = await actor();

  const parsed = deleteQuestionPackSchema.safeParse({ id: formData.get("id") });
  if (!parsed.success) return { error: "Invalid request." };

  const supabase = createAdminClient();
  const { error } = await supabase.from("question_packs").delete().eq("id", parsed.data.id);
  if (error) return { error: "Couldn't delete that pack — try again." };

  await audit(who, "test_prep.pack_delete", parsed.data.id);
  revalidatePath("/admin/test-prep");
  return { success: "Deleted." };
}

// ---- questions ------------------------------------------------------------------------------------------------------

export async function createQuestion(formData: FormData): Promise<TestPrepActionResult> {
  const who = await actor();

  const parsed = createQuestionSchema.safeParse(questionFieldsFromForm(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("questions")
    .insert({
      question_pack_id: parsed.data.questionPackId,
      question_type: parsed.data.questionType,
      stimulus: parsed.data.stimulus,
      prompt: parsed.data.prompt,
      options: parsed.data.options,
      exhibit: parsed.data.exhibit,
      option_figures: parsed.data.optionFigures,
      correct_answer: parsed.data.correctAnswer,
      explanation: parsed.data.explanation,
      difficulty: parsed.data.difficulty,
      subtype: parsed.data.subtype,
      display_order: parsed.data.displayOrder,
      is_active: parsed.data.isActive,
      created_by: who.id,
    })
    .select("id")
    .single();

  if (error || !data) return { error: "Couldn't save that question — try again." };

  await audit(who, "test_prep.question_create", data.id, { packId: parsed.data.questionPackId });
  revalidatePath(`/admin/test-prep/packs/${parsed.data.questionPackId}`);
  return { id: data.id };
}

export async function updateQuestion(_prevState: TestPrepMutationResult, formData: FormData): Promise<TestPrepMutationResult> {
  const who = await actor();

  const parsed = updateQuestionSchema.safeParse({ id: formData.get("id"), ...questionFieldsFromForm(formData) });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = createAdminClient();
  const { error } = await supabase
    .from("questions")
    .update({
      question_pack_id: parsed.data.questionPackId,
      question_type: parsed.data.questionType,
      stimulus: parsed.data.stimulus,
      prompt: parsed.data.prompt,
      options: parsed.data.options,
      exhibit: parsed.data.exhibit,
      option_figures: parsed.data.optionFigures,
      correct_answer: parsed.data.correctAnswer,
      explanation: parsed.data.explanation,
      difficulty: parsed.data.difficulty,
      subtype: parsed.data.subtype,
      display_order: parsed.data.displayOrder,
      is_active: parsed.data.isActive,
    })
    .eq("id", parsed.data.id);

  if (error) return { error: "Couldn't save that question — try again." };

  await audit(who, "test_prep.question_update", parsed.data.id, { packId: parsed.data.questionPackId, isActive: parsed.data.isActive });
  revalidatePath(`/admin/test-prep/packs/${parsed.data.questionPackId}`);
  revalidatePath(`/admin/test-prep/questions/${parsed.data.id}`);
  return { success: "Saved." };
}

export async function deleteQuestion(_prevState: TestPrepMutationResult, formData: FormData): Promise<TestPrepMutationResult> {
  const who = await actor();

  const parsed = deleteQuestionSchema.safeParse({ id: formData.get("id") });
  if (!parsed.success) return { error: "Invalid request." };

  const supabase = createAdminClient();
  const { error } = await supabase.from("questions").delete().eq("id", parsed.data.id);
  if (error) return { error: "Couldn't delete that question — try again." };

  await audit(who, "test_prep.question_delete", parsed.data.id);
  revalidatePath("/admin/test-prep");
  return { success: "Deleted." };
}

/** Turn a question on or off without deleting it (inactive questions are never served; past sessions keep their history either way). */
export async function setQuestionActive(input: { id: string; isActive: boolean }): Promise<TestPrepMutationResult> {
  const who = await actor();

  const parsed = setQuestionActiveSchema.safeParse(input);
  if (!parsed.success) return { error: "Invalid request." };

  const supabase = createAdminClient();
  const { data, error } = await supabase.from("questions").update({ is_active: parsed.data.isActive }).eq("id", parsed.data.id).select("question_pack_id").maybeSingle();
  if (error || !data) return { error: "Couldn't update that question — try again." };

  await audit(who, parsed.data.isActive ? "test_prep.question_activate" : "test_prep.question_deactivate", parsed.data.id);
  revalidatePath(`/admin/test-prep/packs/${data.question_pack_id}`);
  return { success: parsed.data.isActive ? "Activated." : "Deactivated." };
}

/** A copy of a question in the same pack (inactive, at the end), for writing a variant without retyping the exhibit. */
export async function duplicateQuestion(input: { id: string }): Promise<TestPrepActionResult> {
  const who = await actor();

  const parsed = duplicateQuestionSchema.safeParse(input);
  if (!parsed.success) return { error: "Invalid request." };

  const supabase = createAdminClient();
  const { data: source } = await supabase.from("questions").select("*").eq("id", parsed.data.id).maybeSingle();
  if (!source) return { error: "That question couldn't be found." };
  const { data: last } = await supabase.from("questions").select("display_order").eq("question_pack_id", source.question_pack_id).order("display_order", { ascending: false }).limit(1).maybeSingle();

  const { data, error } = await supabase
    .from("questions")
    .insert({
      question_pack_id: source.question_pack_id,
      question_type: source.question_type,
      stimulus: source.stimulus,
      prompt: source.prompt,
      options: source.options,
      exhibit: source.exhibit,
      option_figures: source.option_figures,
      correct_answer: source.correct_answer,
      explanation: source.explanation,
      difficulty: source.difficulty,
      subtype: source.subtype,
      display_order: (last?.display_order ?? 0) + 1,
      is_active: false,
      created_by: who.id,
    })
    .select("id")
    .single();
  if (error || !data) return { error: "Couldn't duplicate that question — try again." };

  await audit(who, "test_prep.question_duplicate", data.id, { from: parsed.data.id });
  revalidatePath(`/admin/test-prep/packs/${source.question_pack_id}`);
  return { id: data.id };
}

/**
 * Bulk-adds questions to a pack from a pasted JSON array. Every question is validated exactly like the single-question
 * form (correct answer among the options, exhibit/figure JSON against the schema, no duplicates); a dry run reports what
 * would be imported and any problems per question, and a real import is all-or-nothing — one bad row imports nothing.
 * New questions go on the end of the pack.
 */
export async function importQuestions(input: { questionPackId: string; json: string; dryRun: boolean }): Promise<ImportQuestionsResult> {
  const who = await actor();

  const parsed = importQuestionsSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const result = parseImportedQuestions(parsed.data.json);
  if (!result.ok) return { error: `${result.errors.length} problem${result.errors.length === 1 ? "" : "s"} found — nothing was imported.`, details: result.errors };

  if (parsed.data.dryRun) return { valid: result.questions.length, imported: 0, dryRun: true };

  const supabase = createAdminClient();
  const { data: pack } = await supabase.from("question_packs").select("id").eq("id", parsed.data.questionPackId).maybeSingle();
  if (!pack) return { error: "That pack couldn't be found." };
  const { data: last } = await supabase.from("questions").select("display_order").eq("question_pack_id", pack.id).order("display_order", { ascending: false }).limit(1).maybeSingle();
  const start = (last?.display_order ?? 0) + 1;

  const { error } = await supabase.from("questions").insert(
    result.questions.map((question, index) => ({
      question_pack_id: pack.id,
      question_type: question.questionType,
      stimulus: question.stimulus,
      prompt: question.prompt,
      options: question.options,
      exhibit: question.exhibit,
      option_figures: question.optionFigures,
      correct_answer: question.correctAnswer,
      explanation: question.explanation,
      difficulty: question.difficulty,
      subtype: question.subtype,
      display_order: start + index,
      is_active: question.isActive,
      created_by: who.id,
    })),
  );
  if (error) return { error: "Couldn't import those questions — nothing was saved. Try again." };

  await audit(who, "test_prep.questions_import", pack.id, { count: result.questions.length });
  revalidatePath(`/admin/test-prep/packs/${pack.id}`);
  return { valid: result.questions.length, imported: result.questions.length, dryRun: false };
}
