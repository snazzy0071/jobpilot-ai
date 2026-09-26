"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { generateStructuredGated } from "@/lib/ai/gateway";
import { AIServiceError } from "@/lib/ai/errors";
import { EntitlementError } from "@/lib/entitlements/service";
import { toPromptCallOptions, linkedinOptimizerPrompt, linkedinOptimizerSchema } from "@/lib/ai/prompts";
import { saveLinkedinDraftVersion } from "@/lib/linkedin/internal";
import { createLinkedinDraftSchema, regenerateLinkedinDraftSchema, deleteLinkedinDraftSchema } from "@/lib/linkedin/schemas";

export type LinkedinDraftActionResult = { error: string } | { draftId: string };
export type LinkedinDraftMutationResult = { error: string } | { success: string } | void;

function safeErrorMessage(err: unknown): string {
  if (err instanceof AIServiceError || err instanceof EntitlementError) return err.message;
  console.error("LinkedIn Optimiser generation failed:", err);
  return "Couldn't generate that rewrite — try again.";
}

/**
 * Creates a new draft and generates its first rewrite in one step —
 * there's no separate "save the input, generate later" state, since a
 * draft with no output yet isn't useful to look at. Gated the same way
 * Cover Letter Generator is (`src/lib/cover-letters/actions.ts`):
 * `linkedin_optimiser` has no metered key of its own
 * (`src/lib/entitlements/types.ts`), so both the plan-level boolean gate
 * and the shared `ai_operations_per_month` AI-cost budget are checked
 * together.
 */
export async function createLinkedinDraft(formData: FormData): Promise<LinkedinDraftActionResult> {
  const user = await requireUser();

  const parsed = createLinkedinDraftSchema.safeParse({
    title: formData.get("title"),
    targetRole: formData.get("targetRole"),
    targetSeniority: formData.get("targetSeniority"),
    currentHeadline: formData.get("currentHeadline") || undefined,
    currentAbout: formData.get("currentAbout") || undefined,
    currentExperience: formData.get("currentExperience"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  let result;
  try {
    result = await generateStructuredGated(
      { userId: user.id, featureKey: "linkedin_optimiser", meteredKey: "ai_operations_per_month" },
      {
        ...toPromptCallOptions(linkedinOptimizerPrompt, {
          currentHeadline: parsed.data.currentHeadline,
          currentAbout: parsed.data.currentAbout,
          currentExperience: parsed.data.currentExperience,
          targetRole: parsed.data.targetRole,
          targetSeniority: parsed.data.targetSeniority,
        }),
        schema: linkedinOptimizerSchema,
      },
    );
  } catch (err) {
    return { error: safeErrorMessage(err) };
  }

  const supabase = await createClient();
  const { data: draftRow, error: draftError } = await supabase
    .from("linkedin_profile_drafts")
    .insert({
      user_id: user.id,
      title: parsed.data.title,
      target_role: parsed.data.targetRole,
      target_seniority: parsed.data.targetSeniority,
      current_headline: parsed.data.currentHeadline,
      current_about: parsed.data.currentAbout,
      current_experience: parsed.data.currentExperience,
      optimized_headline_concise: result.headlineVariants.concise,
      optimized_headline_narrative: result.headlineVariants.narrative,
      optimized_headline_keyword_dense: result.headlineVariants.keywordDense,
      optimized_about: result.about,
      suggested_skills: result.suggestedSkills,
      notes: result.notes,
      keyword_coverage_terms: result.keywordCoverageTerms,
      prompt_version: linkedinOptimizerPrompt.version,
      generated_at: new Date().toISOString(),
    })
    .select("id")
    .single();
  if (draftError || !draftRow) return { error: "Your rewrite was generated, but couldn't be saved — try again." };

  const { error: bulletsError } = await supabase.from("linkedin_experience_bullets").insert(
    result.experienceBullets.map((content, index) => ({
      draft_id: draftRow.id,
      user_id: user.id,
      content,
      display_order: index,
    })),
  );
  if (bulletsError) {
    // Cascades: the draft's own FK is ON DELETE CASCADE, so this also
    // takes any bullets that did make it in with it.
    await supabase.from("linkedin_profile_drafts").delete().eq("id", draftRow.id);
    return { error: "Your rewrite was generated, but couldn't be saved — try again." };
  }

  revalidatePath("/dashboard/linkedin");
  return { draftId: draftRow.id };
}

/**
 * Edits a draft's input (title/target role/seniority/pasted text) and
 * regenerates its whole output in one step, overwriting the previous
 * rewrite entirely — this is a *draft* someone keeps revising for one
 * target role, not a version history (see migration 0046's own doc
 * comment), so there's deliberately no separate "just save the edited
 * input" action. Coarser than the per-field Regenerate/Accept/Reject
 * flows in rewrite-actions.ts (which touch only About or one Experience
 * bullet) — this is for when the input itself changed, not just a
 * dislike of one generated sentence.
 *
 * Experience bullets are deleted and reinserted rather than diffed —
 * same "regenerating replaces everything" semantics migration 0046 established
 * for the draft as a whole; their own rewrite history cascades away with
 * them (linkedin_experience_bullet_rewrites' FK), same as deleting the
 * draft itself would.
 */
export async function regenerateLinkedinDraft(
  _prevState: LinkedinDraftMutationResult,
  formData: FormData,
): Promise<LinkedinDraftMutationResult> {
  const user = await requireUser();

  const parsed = regenerateLinkedinDraftSchema.safeParse({
    draftId: formData.get("draftId"),
    title: formData.get("title"),
    targetRole: formData.get("targetRole"),
    targetSeniority: formData.get("targetSeniority"),
    currentHeadline: formData.get("currentHeadline") || undefined,
    currentAbout: formData.get("currentAbout") || undefined,
    currentExperience: formData.get("currentExperience"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const { data: existing } = await supabase
    .from("linkedin_profile_drafts")
    .select("id")
    .eq("id", parsed.data.draftId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!existing) return { error: "That draft couldn't be found." };

  let result;
  try {
    result = await generateStructuredGated(
      { userId: user.id, featureKey: "linkedin_optimiser", meteredKey: "ai_operations_per_month" },
      {
        ...toPromptCallOptions(linkedinOptimizerPrompt, {
          currentHeadline: parsed.data.currentHeadline,
          currentAbout: parsed.data.currentAbout,
          currentExperience: parsed.data.currentExperience,
          targetRole: parsed.data.targetRole,
          targetSeniority: parsed.data.targetSeniority,
        }),
        schema: linkedinOptimizerSchema,
      },
    );
  } catch (err) {
    return { error: safeErrorMessage(err) };
  }

  // Regenerating replaces everything, so keep the previous state first — and don't go on if it can't be kept.
  const backedUp = await saveLinkedinDraftVersion(
    supabase,
    user.id,
    parsed.data.draftId,
    `Before regenerating — ${new Date().toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })}`,
  );
  if (!backedUp) return { error: "Couldn't back up your current draft first, so nothing was changed — try again." };

  const { error } = await supabase
    .from("linkedin_profile_drafts")
    .update({
      selected_headline: null, // the old choice belonged to the old variants (it stays in the backup)
      title: parsed.data.title,
      target_role: parsed.data.targetRole,
      target_seniority: parsed.data.targetSeniority,
      current_headline: parsed.data.currentHeadline,
      current_about: parsed.data.currentAbout,
      current_experience: parsed.data.currentExperience,
      optimized_headline_concise: result.headlineVariants.concise,
      optimized_headline_narrative: result.headlineVariants.narrative,
      optimized_headline_keyword_dense: result.headlineVariants.keywordDense,
      optimized_about: result.about,
      suggested_skills: result.suggestedSkills,
      notes: result.notes,
      keyword_coverage_terms: result.keywordCoverageTerms,
      prompt_version: linkedinOptimizerPrompt.version,
      generated_at: new Date().toISOString(),
    })
    .eq("id", parsed.data.draftId)
    .eq("user_id", user.id);
  if (error) return { error: "Your rewrite was generated, but couldn't be saved — try again." };

  await supabase.from("linkedin_experience_bullets").delete().eq("draft_id", parsed.data.draftId).eq("user_id", user.id);
  const { error: bulletsError } = await supabase.from("linkedin_experience_bullets").insert(
    result.experienceBullets.map((content, index) => ({
      draft_id: parsed.data.draftId,
      user_id: user.id,
      content,
      display_order: index,
    })),
  );
  if (bulletsError) return { error: "Your rewrite was generated, but the Experience bullets couldn't be saved — try again." };

  revalidatePath(`/dashboard/linkedin/${parsed.data.draftId}`);
  revalidatePath("/dashboard/linkedin");
  return { success: "Regenerated." };
}

export async function deleteLinkedinDraft(
  _prevState: LinkedinDraftMutationResult,
  formData: FormData,
): Promise<LinkedinDraftMutationResult> {
  const user = await requireUser();
  const parsed = deleteLinkedinDraftSchema.safeParse({ draftId: formData.get("draftId") });
  if (!parsed.success) return { error: "Invalid request." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("linkedin_profile_drafts")
    .delete()
    .eq("id", parsed.data.draftId)
    .eq("user_id", user.id);
  if (error) return { error: "Couldn't delete that draft — try again." };

  revalidatePath("/dashboard/linkedin");
  return { success: "Deleted." };
}
