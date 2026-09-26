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

// ---------------------------------------------------------------------
// Recoverable history (migration 0093) — same model as
// src/lib/cover-letters/internal.ts's ensureCoverLetterHistorySnapshot:
// a snapshot is taken before anything overwrites the draft (always for a
// regenerate/restore, throttled to one per 30 minutes for autosaved edits
// and accepted rewrites), so there's always a way back.
// ---------------------------------------------------------------------

export type LinkedinDraftSnapshot = {
  title: string;
  targetRole: string;
  targetSeniority: LinkedinTargetSeniority;
  currentHeadline: string;
  currentAbout: string;
  currentExperience: string;
  headlineConcise: string | null;
  headlineNarrative: string | null;
  headlineKeywordDense: string | null;
  selectedHeadline: string | null;
  about: string | null;
  bullets: string[];
  suggestedSkills: unknown;
  notes: unknown;
  keywordTerms: unknown;
  promptVersion: string | null;
  generatedAt: string | null;
};

/** Reads the draft's whole current state into a snapshot, or null if it doesn't exist / isn't this user's. */
export async function buildLinkedinDraftSnapshot(
  supabase: SupabaseClient,
  userId: string,
  draftId: string,
): Promise<LinkedinDraftSnapshot | null> {
  const { data: draft, error } = await supabase
    .from("linkedin_profile_drafts")
    .select(
      "title, target_role, target_seniority, current_headline, current_about, current_experience, optimized_headline_concise, optimized_headline_narrative, optimized_headline_keyword_dense, selected_headline, optimized_about, suggested_skills, notes, keyword_coverage_terms, prompt_version, generated_at",
    )
    .eq("id", draftId)
    .eq("user_id", userId)
    .maybeSingle();
  if (error || !draft) return null;

  const { data: bullets } = await supabase
    .from("linkedin_experience_bullets")
    .select("content, display_order")
    .eq("draft_id", draftId)
    .eq("user_id", userId)
    .order("display_order", { ascending: true });

  return {
    title: draft.title,
    targetRole: draft.target_role,
    targetSeniority: draft.target_seniority,
    currentHeadline: draft.current_headline,
    currentAbout: draft.current_about,
    currentExperience: draft.current_experience,
    headlineConcise: draft.optimized_headline_concise,
    headlineNarrative: draft.optimized_headline_narrative,
    headlineKeywordDense: draft.optimized_headline_keyword_dense,
    selectedHeadline: draft.selected_headline,
    about: draft.optimized_about,
    bullets: (bullets ?? []).map((bullet) => bullet.content as string),
    suggestedSkills: draft.suggested_skills,
    notes: draft.notes,
    keywordTerms: draft.keyword_coverage_terms,
    promptVersion: draft.prompt_version,
    generatedAt: draft.generated_at,
  };
}

/** Stores a snapshot as a history entry. Returns false if it couldn't be saved — callers that are about to destroy data must not proceed on false. */
export async function saveLinkedinDraftVersion(
  supabase: SupabaseClient,
  userId: string,
  draftId: string,
  label: string,
  snapshot?: LinkedinDraftSnapshot,
): Promise<boolean> {
  const state = snapshot ?? (await buildLinkedinDraftSnapshot(supabase, userId, draftId));
  if (!state) return false;

  const { error } = await supabase
    .from("linkedin_draft_versions")
    .insert({ draft_id: draftId, user_id: userId, label, snapshot: state });
  if (error) {
    console.error("Couldn't save a linkedin_draft_versions row:", error.message);
    return false;
  }
  await supabase
    .from("linkedin_profile_drafts")
    .update({ last_snapshotted_at: new Date().toISOString() })
    .eq("id", draftId)
    .eq("user_id", userId);
  return true;
}

const LINKEDIN_SNAPSHOT_THROTTLE_MS = 30 * 60 * 1000;

/** Checkpoint before an autosaved edit / accepted rewrite — at most one per 30 minutes, best-effort: a failed snapshot is logged, never blocks the user's own edit. */
export async function ensureLinkedinHistorySnapshot(supabase: SupabaseClient, userId: string, draftId: string): Promise<void> {
  const { data, error } = await supabase
    .from("linkedin_profile_drafts")
    .select("last_snapshotted_at")
    .eq("id", draftId)
    .eq("user_id", userId)
    .maybeSingle();
  if (error || !data) return;

  const last = data.last_snapshotted_at ? new Date(data.last_snapshotted_at as string).getTime() : 0;
  if (Date.now() - last < LINKEDIN_SNAPSHOT_THROTTLE_MS) return;

  const label = `Autosaved ${new Date().toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })}`;
  await saveLinkedinDraftVersion(supabase, userId, draftId, label);
}

/** Replaces the draft's whole state (row + bullets) with a snapshot's. Callers snapshot the current state first. */
export async function applyLinkedinDraftSnapshot(
  supabase: SupabaseClient,
  userId: string,
  draftId: string,
  snapshot: LinkedinDraftSnapshot,
): Promise<boolean> {
  const { error } = await supabase
    .from("linkedin_profile_drafts")
    .update({
      title: snapshot.title,
      target_role: snapshot.targetRole,
      target_seniority: snapshot.targetSeniority,
      current_headline: snapshot.currentHeadline,
      current_about: snapshot.currentAbout,
      current_experience: snapshot.currentExperience,
      optimized_headline_concise: snapshot.headlineConcise,
      optimized_headline_narrative: snapshot.headlineNarrative,
      optimized_headline_keyword_dense: snapshot.headlineKeywordDense,
      selected_headline: snapshot.selectedHeadline,
      optimized_about: snapshot.about,
      suggested_skills: snapshot.suggestedSkills,
      notes: snapshot.notes,
      keyword_coverage_terms: snapshot.keywordTerms,
      prompt_version: snapshot.promptVersion,
      generated_at: snapshot.generatedAt,
    })
    .eq("id", draftId)
    .eq("user_id", userId);
  if (error) return false;

  await supabase.from("linkedin_experience_bullets").delete().eq("draft_id", draftId).eq("user_id", userId);
  if (snapshot.bullets.length === 0) return true;
  const { error: bulletsError } = await supabase.from("linkedin_experience_bullets").insert(
    snapshot.bullets.map((content, index) => ({ draft_id: draftId, user_id: userId, content, display_order: index })),
  );
  return !bulletsError;
}

/** Ownership check for a bullet, returning its draft id — for the autosave path, which (unlike regenerate) needs no target role. */
export async function getLinkedinBulletDraftId(supabase: SupabaseClient, userId: string, bulletId: string): Promise<string | null> {
  const { data } = await supabase
    .from("linkedin_experience_bullets")
    .select("draft_id")
    .eq("id", bulletId)
    .eq("user_id", userId)
    .maybeSingle();
  return (data?.draft_id as string | undefined) ?? null;
}
