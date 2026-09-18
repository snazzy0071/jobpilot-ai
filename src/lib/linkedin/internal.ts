import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { LinkedinTargetSeniority } from "@/lib/linkedin/types";

// Shared by actions.ts (draft-level: create/regenerate/delete) and
// rewrite-actions.ts (About/Experience-bullet regenerate + resolve) —
// same split, and same reasoning, as src/lib/cover-letters/internal.ts.

/**
 * RLS on linkedin_experience_bullets/linkedin_about_rewrites only checks
 * `auth.uid() = user_id` on the row being written — it has no way to
 * know whether a request's `draftId` actually belongs to a draft *this*
 * user owns, since that's a different table. Every rewrite path here
 * calls this first, the same discipline assertOwnsCoverLetterVersion
 * exists for.
 */
export async function getLinkedinDraftOwner(
  supabase: SupabaseClient,
  userId: string,
  draftId: string,
): Promise<{ targetRole: string; targetSeniority: LinkedinTargetSeniority } | null> {
  const { data, error } = await supabase
    .from("linkedin_profile_drafts")
    .select("target_role, target_seniority")
    .eq("id", draftId)
    .eq("user_id", userId)
    .maybeSingle();
  if (error || !data) return null;

  return { targetRole: data.target_role as string, targetSeniority: data.target_seniority as LinkedinTargetSeniority };
}

/** The same ownership resolution as getLinkedinDraftOwner, starting from a bullet id instead of a draft id — for the per-bullet regenerate action, which only ever receives a bulletId from the client. */
export async function getLinkedinBulletOwner(
  supabase: SupabaseClient,
  userId: string,
  bulletId: string,
): Promise<{ draftId: string; targetRole: string; targetSeniority: LinkedinTargetSeniority } | null> {
  const { data, error } = await supabase
    .from("linkedin_experience_bullets")
    .select("draft_id")
    .eq("id", bulletId)
    .eq("user_id", userId)
    .maybeSingle();
  if (error || !data) return null;

  const draft = await getLinkedinDraftOwner(supabase, userId, data.draft_id as string);
  if (!draft) return null;

  return { draftId: data.draft_id as string, ...draft };
}

/** Persists an About rewrite suggestion — a record of what was suggested and, once resolved via resolveLinkedinAboutRewrite, whether it was accepted or rejected. Best-effort: a failed insert doesn't fail the rewrite itself, it just can't later be marked accepted/rejected. */
export async function persistLinkedinAboutRewrite(
  supabase: SupabaseClient,
  params: { userId: string; draftId: string; originalText: string; suggestedText: string; explanation: string; promptVersion: string },
): Promise<string | null> {
  const { data, error } = await supabase
    .from("linkedin_about_rewrites")
    .insert({
      user_id: params.userId,
      draft_id: params.draftId,
      original_text: params.originalText,
      suggested_text: params.suggestedText,
      explanation: params.explanation,
      prompt_version: params.promptVersion,
    })
    .select("id")
    .single();

  if (error || !data) {
    console.error("Couldn't persist linkedin_about_rewrites row:", error?.message);
    return null;
  }
  return data.id as string;
}

/** Same as persistLinkedinAboutRewrite, for one Experience bullet's rewrite suggestion. */
export async function persistLinkedinExperienceBulletRewrite(
  supabase: SupabaseClient,
  params: { userId: string; bulletId: string; originalText: string; suggestedText: string; explanation: string; promptVersion: string },
): Promise<string | null> {
  const { data, error } = await supabase
    .from("linkedin_experience_bullet_rewrites")
    .insert({
      user_id: params.userId,
      bullet_id: params.bulletId,
      original_text: params.originalText,
      suggested_text: params.suggestedText,
      explanation: params.explanation,
      prompt_version: params.promptVersion,
    })
    .select("id")
    .single();

  if (error || !data) {
    console.error("Couldn't persist linkedin_experience_bullet_rewrites row:", error?.message);
    return null;
  }
  return data.id as string;
}
