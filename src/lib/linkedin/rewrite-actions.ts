"use server";

import { requireUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { generateStructuredGated } from "@/lib/ai/gateway";
import { AIServiceError } from "@/lib/ai/errors";
import { EntitlementError } from "@/lib/entitlements/service";
import {
  toPromptCallOptions,
  linkedinAboutRewritePrompt,
  linkedinAboutRewriteSchema,
  linkedinExperienceBulletRewritePrompt,
  linkedinExperienceBulletRewriteSchema,
} from "@/lib/ai/prompts";
import { getLinkedinDraftOwner, getLinkedinBulletOwner, persistLinkedinAboutRewrite, persistLinkedinExperienceBulletRewrite } from "@/lib/linkedin/internal";
import {
  regenerateLinkedinAboutSchema,
  resolveLinkedinAboutRewriteSchema,
  regenerateLinkedinExperienceBulletSchema,
  resolveLinkedinExperienceBulletRewriteSchema,
} from "@/lib/linkedin/schemas";

// Same shape as src/lib/cvs/ai-actions.ts's AiRewriteResult — kept as an
// independent type rather than imported, since this feature's rewrite
// history lives in its own tables, but identical structurally so
// AiRewritePanel (src/components/cvs/editor/ai-rewrite-panel.tsx) can be
// reused here unmodified, same as src/lib/cover-letters/rewrite-actions.ts.
export type LinkedinRewriteResult =
  | { error: string }
  | { suggestion: string; explanation: string; rewriteId: string | null };

function safeErrorMessage(err: unknown): string {
  if (err instanceof AIServiceError || err instanceof EntitlementError) return err.message;
  console.error("LinkedIn rewrite failed:", err);
  return "Couldn't generate a suggestion — try again.";
}

/**
 * Regenerates just the About section — the per-section "Regenerate"
 * action AiRewritePanel's "Try again" button calls. Target role/seniority
 * are re-read from the draft here, never trusted from the client; only
 * the About text's own current (possibly just-accepted) value comes from
 * the caller.
 */
export async function regenerateLinkedinAbout(input: { draftId: string; currentAbout: string }): Promise<LinkedinRewriteResult> {
  const user = await requireUser();
  const parsed = regenerateLinkedinAboutSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const draft = await getLinkedinDraftOwner(supabase, user.id, parsed.data.draftId);
  if (!draft) return { error: "That draft couldn't be found." };

  try {
    const result = await generateStructuredGated(
      { userId: user.id, featureKey: "linkedin_optimiser", meteredKey: "ai_operations_per_month" },
      {
        ...toPromptCallOptions(linkedinAboutRewritePrompt, {
          currentAbout: parsed.data.currentAbout,
          targetRole: draft.targetRole,
          targetSeniority: draft.targetSeniority,
        }),
        schema: linkedinAboutRewriteSchema,
      },
    );

    const rewriteId = await persistLinkedinAboutRewrite(supabase, {
      userId: user.id,
      draftId: parsed.data.draftId,
      originalText: parsed.data.currentAbout,
      suggestedText: result.about,
      explanation: result.explanation,
      promptVersion: linkedinAboutRewritePrompt.version,
    });

    return { suggestion: result.about, explanation: result.explanation, rewriteId };
  } catch (err) {
    return { error: safeErrorMessage(err) };
  }
}

/**
 * Marks a previously-suggested About rewrite accepted or rejected, and —
 * only when accepted — applies it: writes the suggestion's own already-
 * persisted `suggested_text` into `linkedin_profile_drafts.optimized_about`.
 * Unlike resolveCoverLetterParagraphRewrite (which only ever flips a
 * status, because the cover letter editor has its own separate autosaved
 * textarea that already applied the text before this is even called),
 * there's no separate editable field here for About to apply through —
 * this resolve call is the only place accepting a suggestion ever takes
 * effect, so it does both in one round trip.
 */
export async function resolveLinkedinAboutRewrite(input: { rewriteId: string; status: "accepted" | "rejected" }): Promise<void> {
  const user = await requireUser();
  const parsed = resolveLinkedinAboutRewriteSchema.safeParse(input);
  if (!parsed.success) return;

  const supabase = await createClient();
  const { data: rewrite } = await supabase
    .from("linkedin_about_rewrites")
    .select("draft_id, suggested_text")
    .eq("id", parsed.data.rewriteId)
    .eq("user_id", user.id)
    .eq("status", "suggested")
    .maybeSingle();
  if (!rewrite) return;

  await supabase
    .from("linkedin_about_rewrites")
    .update({ status: parsed.data.status, resolved_at: new Date().toISOString() })
    .eq("id", parsed.data.rewriteId)
    .eq("user_id", user.id);

  if (parsed.data.status === "accepted") {
    await supabase
      .from("linkedin_profile_drafts")
      .update({ optimized_about: rewrite.suggested_text })
      .eq("id", rewrite.draft_id as string)
      .eq("user_id", user.id);
  }
}

/** Same as regenerateLinkedinAbout, for one Experience bullet — given the draft's other current bullets as context so the rewrite doesn't just repeat them. */
export async function regenerateLinkedinExperienceBullet(input: {
  bulletId: string;
  currentContent: string;
  otherBullets: string;
}): Promise<LinkedinRewriteResult> {
  const user = await requireUser();
  const parsed = regenerateLinkedinExperienceBulletSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const bullet = await getLinkedinBulletOwner(supabase, user.id, parsed.data.bulletId);
  if (!bullet) return { error: "That bullet couldn't be found." };

  try {
    const result = await generateStructuredGated(
      { userId: user.id, featureKey: "linkedin_optimiser", meteredKey: "ai_operations_per_month" },
      {
        ...toPromptCallOptions(linkedinExperienceBulletRewritePrompt, {
          bulletContent: parsed.data.currentContent,
          otherBullets: parsed.data.otherBullets,
          targetRole: bullet.targetRole,
          targetSeniority: bullet.targetSeniority,
        }),
        schema: linkedinExperienceBulletRewriteSchema,
      },
    );

    const rewriteId = await persistLinkedinExperienceBulletRewrite(supabase, {
      userId: user.id,
      bulletId: parsed.data.bulletId,
      originalText: parsed.data.currentContent,
      suggestedText: result.bullet,
      explanation: result.explanation,
      promptVersion: linkedinExperienceBulletRewritePrompt.version,
    });

    return { suggestion: result.bullet, explanation: result.explanation, rewriteId };
  } catch (err) {
    return { error: safeErrorMessage(err) };
  }
}

/** Same accept-applies-directly reasoning as resolveLinkedinAboutRewrite, applying an accepted suggestion to the bullet's own `content` column. */
export async function resolveLinkedinExperienceBulletRewrite(input: {
  rewriteId: string;
  status: "accepted" | "rejected";
}): Promise<void> {
  const user = await requireUser();
  const parsed = resolveLinkedinExperienceBulletRewriteSchema.safeParse(input);
  if (!parsed.success) return;

  const supabase = await createClient();
  const { data: rewrite } = await supabase
    .from("linkedin_experience_bullet_rewrites")
    .select("bullet_id, suggested_text")
    .eq("id", parsed.data.rewriteId)
    .eq("user_id", user.id)
    .eq("status", "suggested")
    .maybeSingle();
  if (!rewrite) return;

  await supabase
    .from("linkedin_experience_bullet_rewrites")
    .update({ status: parsed.data.status, resolved_at: new Date().toISOString() })
    .eq("id", parsed.data.rewriteId)
    .eq("user_id", user.id);

  if (parsed.data.status === "accepted") {
    await supabase
      .from("linkedin_experience_bullets")
      .update({ content: rewrite.suggested_text })
      .eq("id", rewrite.bullet_id as string)
      .eq("user_id", user.id);
  }
}
