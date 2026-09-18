"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { assertOwnsCoverLetterVersion, nextParagraphOrder } from "@/lib/cover-letters/internal";
import {
  paragraphSchema,
  paragraphRowIdSchema,
  reorderParagraphsSchema,
  saveVersionSettingsSchema,
} from "@/lib/cover-letters/schemas";

// `id` is populated on a successful save — the autosave hook needs it
// to know, the moment a brand-new paragraph is first created, which
// real id to attach every subsequent keystroke's save to instead of
// inserting a duplicate row per autosave tick. Same shape as
// src/lib/cvs/section-actions.ts's SectionActionResult, deliberately —
// it's what lets this module reuse useAutosave, DeleteRowButton, and
// CvFormMessage unmodified.
export type ParagraphActionResult = { error: string } | { success: string; id?: string } | void;

function editorPath(coverLetterId: string) {
  return `/dashboard/cover-letters/${coverLetterId}`;
}

export async function saveParagraph(_prevState: ParagraphActionResult, formData: FormData): Promise<ParagraphActionResult> {
  const user = await requireUser();
  const parsed = paragraphSchema.safeParse({
    id: formData.get("id") || undefined,
    versionId: formData.get("versionId"),
    content: formData.get("content"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const owned = await assertOwnsCoverLetterVersion(supabase, user.id, parsed.data.versionId);
  if (!owned) return { error: "That cover letter couldn't be found." };

  let savedId = parsed.data.id ?? null;
  let error;
  if (parsed.data.id) {
    ({ error } = await supabase
      .from("cover_letter_paragraphs")
      .update({ content: parsed.data.content })
      .eq("id", parsed.data.id)
      .eq("user_id", user.id));
  } else {
    const displayOrder = await nextParagraphOrder(supabase, parsed.data.versionId);
    const result = await supabase
      .from("cover_letter_paragraphs")
      .insert({ version_id: parsed.data.versionId, user_id: user.id, content: parsed.data.content, display_order: displayOrder })
      .select("id")
      .single();
    error = result.error;
    savedId = result.data?.id ?? null;
  }
  if (error) return { error: "Couldn't save that paragraph — try again." };

  revalidatePath(editorPath(owned.coverLetterId));
  return { success: "Saved.", id: savedId ?? undefined };
}

export async function deleteParagraph(_prevState: ParagraphActionResult, formData: FormData): Promise<ParagraphActionResult> {
  const user = await requireUser();
  const parsed = paragraphRowIdSchema.safeParse({ id: formData.get("id"), versionId: formData.get("versionId") });
  if (!parsed.success) return { error: "Invalid request." };

  const supabase = await createClient();
  const owned = await assertOwnsCoverLetterVersion(supabase, user.id, parsed.data.versionId);
  if (!owned) return { error: "That cover letter couldn't be found." };

  const { error } = await supabase.from("cover_letter_paragraphs").delete().eq("id", parsed.data.id).eq("user_id", user.id);
  if (error) return { error: "Couldn't delete that paragraph — try again." };

  revalidatePath(editorPath(owned.coverLetterId));
  return { success: "Deleted." };
}

export async function reorderParagraphs(_prevState: ParagraphActionResult, formData: FormData): Promise<ParagraphActionResult> {
  const user = await requireUser();
  const parsed = reorderParagraphsSchema.safeParse({
    versionId: formData.get("versionId"),
    orderedIds: formData.get("orderedIds"),
  });
  if (!parsed.success) return { error: "Invalid request." };

  const supabase = await createClient();
  const owned = await assertOwnsCoverLetterVersion(supabase, user.id, parsed.data.versionId);
  if (!owned) return { error: "That cover letter couldn't be found." };

  const updates = parsed.data.orderedIds.map((id, index) =>
    supabase
      .from("cover_letter_paragraphs")
      .update({ display_order: index })
      .eq("id", id)
      .eq("user_id", user.id)
      .eq("version_id", parsed.data.versionId),
  );
  const results = await Promise.all(updates);
  if (results.some((result) => result.error)) return { error: "Couldn't reorder — try again." };

  revalidatePath(editorPath(owned.coverLetterId));
  return { success: "Reordered." };
}

/** The editor's tone/length controls — autosaved like a paragraph edit, and (via assertOwnsCoverLetterVersion) subject to the same history-snapshot protection, since changing them changes what future Regenerate calls produce. */
export async function saveVersionSettings(_prevState: ParagraphActionResult, formData: FormData): Promise<ParagraphActionResult> {
  const user = await requireUser();
  const parsed = saveVersionSettingsSchema.safeParse({
    versionId: formData.get("versionId"),
    tone: formData.get("tone"),
    length: formData.get("length"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const owned = await assertOwnsCoverLetterVersion(supabase, user.id, parsed.data.versionId);
  if (!owned) return { error: "That cover letter couldn't be found." };

  const { error } = await supabase
    .from("cover_letter_versions")
    .update({ tone: parsed.data.tone, length: parsed.data.length })
    .eq("id", parsed.data.versionId)
    .eq("user_id", user.id);
  if (error) return { error: "Couldn't save — try again." };

  revalidatePath(editorPath(owned.coverLetterId));
  return { success: "Saved." };
}
