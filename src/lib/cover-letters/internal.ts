import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getVersionParagraphs } from "@/lib/cover-letters/queries";
import type { CoverLetterParagraph } from "@/lib/cover-letters/types";

// Shared by paragraph-actions.ts (row-level CRUD) and actions.ts
// (letter/version-level: generate, restore, history snapshots) — same
// split, and same reasoning, as src/lib/cvs/internal.ts.

/**
 * RLS on cover_letter_* tables only checks `auth.uid() = user_id` on the
 * row being written — it has no way to know whether the `versionId` a
 * request supplies actually belongs to a version *this* user owns,
 * since that's a different table. Every write path in
 * src/lib/cover-letters/ calls this first — which is also why it's the
 * one place `ensureCoverLetterHistorySnapshot` is invoked from: every
 * paragraph edit already passes through here, so history protection
 * applies everywhere for free.
 */
export async function assertOwnsCoverLetterVersion(
  supabase: SupabaseClient,
  userId: string,
  versionId: string,
): Promise<{ coverLetterId: string } | null> {
  const owner = await getCoverLetterVersionOwner(supabase, userId, versionId);
  if (!owner) return null;

  await ensureCoverLetterHistorySnapshot(supabase, userId, versionId, owner.coverLetterId);

  return owner;
}

/** The same ownership check as assertOwnsCoverLetterVersion, without the history snapshot — for paths that need to confirm ownership before doing real work (an AI regenerate) but don't themselves write paragraph content. */
export async function getCoverLetterVersionOwner(
  supabase: SupabaseClient,
  userId: string,
  versionId: string,
): Promise<{ coverLetterId: string } | null> {
  const { data, error } = await supabase
    .from("cover_letter_versions")
    .select("cover_letter_id")
    .eq("id", versionId)
    .eq("user_id", userId)
    .maybeSingle();
  if (error || !data) return null;

  return { coverLetterId: data.cover_letter_id as string };
}

export async function nextParagraphOrder(supabase: SupabaseClient, versionId: string): Promise<number> {
  const { data } = await supabase
    .from("cover_letter_paragraphs")
    .select("display_order")
    .eq("version_id", versionId)
    .order("display_order", { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data?.display_order ?? -1) + 1;
}

/** Persists a paragraph rewrite suggestion into cover_letter_paragraph_rewrites — a record of what was suggested and, once resolved via resolveCoverLetterParagraphRewrite, whether it was accepted or rejected. Best-effort, same as src/lib/cvs/internal.ts's persistRewrite: a failed insert doesn't fail the rewrite itself. */
export async function persistParagraphRewrite(
  supabase: SupabaseClient,
  params: {
    userId: string;
    paragraphId: string;
    originalText: string;
    suggestedText: string;
    explanation: string;
    promptVersion: string;
  },
): Promise<string | null> {
  const { data, error } = await supabase
    .from("cover_letter_paragraph_rewrites")
    .insert({
      user_id: params.userId,
      paragraph_id: params.paragraphId,
      original_text: params.originalText,
      suggested_text: params.suggestedText,
      explanation: params.explanation,
      prompt_version: params.promptVersion,
    })
    .select("id")
    .single();

  if (error || !data) {
    console.error("Couldn't persist cover_letter_paragraph_rewrites row:", error?.message);
    return null;
  }
  return data.id as string;
}

/** Copies every paragraph row from an already-fetched list into `targetVersionId` — used by ensureCoverLetterHistorySnapshot below. Returns false if the insert failed. */
export async function copyParagraphsToVersion(
  supabase: SupabaseClient,
  userId: string,
  targetVersionId: string,
  paragraphs: CoverLetterParagraph[],
): Promise<boolean> {
  if (paragraphs.length === 0) return true;

  const { error } = await supabase.from("cover_letter_paragraphs").insert(
    paragraphs.map((paragraph) => ({
      version_id: targetVersionId,
      user_id: userId,
      content: paragraph.content,
      display_order: paragraph.displayOrder,
    })),
  );
  return !error;
}

const SNAPSHOT_THROTTLE_MS = 30 * 60 * 1000;

/**
 * Recoverable version history without a snapshot on every keystroke —
 * identical throttled-checkpoint behavior to src/lib/cvs/internal.ts's
 * ensureHistorySnapshot: before an autosaved edit is applied, if this
 * version hasn't been snapshotted in the last 30 minutes, copy its
 * *current* tone/length/source-CV and all its paragraphs into a new,
 * non-current version first, then let the real edit proceed on this
 * version as normal.
 *
 * Best-effort: a failed snapshot is logged, never thrown — the user's
 * actual edit must never be blocked by history bookkeeping failing.
 */
export async function ensureCoverLetterHistorySnapshot(
  supabase: SupabaseClient,
  userId: string,
  versionId: string,
  coverLetterId: string,
): Promise<void> {
  const { data: version, error } = await supabase
    .from("cover_letter_versions")
    .select("last_snapshotted_at, tone, length, cv_version_id, cv_text_snapshot, prompt_version")
    .eq("id", versionId)
    .maybeSingle();
  if (error || !version) return;

  const lastSnapshotAt = version.last_snapshotted_at ? new Date(version.last_snapshotted_at).getTime() : 0;
  if (Date.now() - lastSnapshotAt < SNAPSHOT_THROTTLE_MS) return;

  try {
    const paragraphs = await getVersionParagraphs(versionId);

    const { data: snapshotVersion, error: snapshotError } = await supabase
      .from("cover_letter_versions")
      .insert({
        cover_letter_id: coverLetterId,
        user_id: userId,
        is_current: false,
        label: `Autosaved ${new Date().toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })}`,
        tone: version.tone,
        length: version.length,
        cv_version_id: version.cv_version_id,
        cv_text_snapshot: version.cv_text_snapshot,
        prompt_version: version.prompt_version,
      })
      .select("id")
      .single();
    if (snapshotError || !snapshotVersion) {
      console.error("ensureCoverLetterHistorySnapshot: failed to create snapshot version:", snapshotError?.message);
      return;
    }

    const copied = await copyParagraphsToVersion(supabase, userId, snapshotVersion.id, paragraphs);
    if (!copied) {
      console.error("ensureCoverLetterHistorySnapshot: failed to copy paragraphs into snapshot version");
      await supabase.from("cover_letter_versions").delete().eq("id", snapshotVersion.id);
      return;
    }

    await supabase
      .from("cover_letter_versions")
      .update({ last_snapshotted_at: new Date().toISOString() })
      .eq("id", versionId);
  } catch (err) {
    console.error("ensureCoverLetterHistorySnapshot failed:", err);
  }
}
