"use server";

import { requireUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { getVersionOwner, persistRewrite } from "@/lib/cvs/internal";
import { generateStructuredGated } from "@/lib/ai/gateway";
import { AIServiceError } from "@/lib/ai/errors";
import { EntitlementError } from "@/lib/entitlements/service";
import { toPromptCallOptions, cvKeywordRewritePrompt, cvKeywordRewriteSchema } from "@/lib/ai/prompts";
import { rewriteSummaryForKeywordSchema, rewriteExperienceForKeywordSchema } from "@/lib/cvs/schemas";

export type KeywordRewriteResult =
  | { error: string }
  // `applied` is the model's own honest signal — false means it looked
  // and couldn't work the term in without inventing something, and
  // `suggestion` is then the (lightly polished, or unchanged) input, not
  // a suggestion actually worth accepting. `rewriteId` is null only if
  // persisting the suggestion itself failed (see persistRewrite,
  // src/lib/cvs/internal.ts) — the suggestion is still shown either way.
  | { applied: boolean; suggestion: string; explanation: string; rewriteId: string | null };

/** Both AIServiceError and EntitlementError carry messages that are always safe to show a user — anything else isn't. */
function safeErrorMessage(err: unknown): string {
  if (err instanceof AIServiceError || err instanceof EntitlementError) return err.message;
  console.error("CV keyword rewrite failed:", err);
  return "Couldn't generate a suggestion — try again.";
}

/**
 * The generation half of "generate fact-safe suggested CV rewrites for
 * missing/weak keywords" — the accept half (write the result back to the
 * CV, then re-run the ATS scan) happens client-side in
 * AtsPreflightPanel, composing the *existing* saveSummary/
 * saveExperience/saveSkill and runAtsScan actions rather than a new
 * combined one, same reasoning as every other multi-step flow in this
 * editor. Metered the same as the general-purpose AI rewrites
 * (ai_operations_per_month) — this is still one AI rewrite call, just
 * aimed at a specific term instead of "make this better" in general.
 */
export async function rewriteSummaryForKeyword(input: {
  versionId: string;
  keyword: string;
  currentSummary: string;
}): Promise<KeywordRewriteResult> {
  const user = await requireUser();
  const parsed = rewriteSummaryForKeywordSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createClient();
  if (!(await getVersionOwner(supabase, user.id, parsed.data.versionId))) {
    return { error: "That CV couldn't be found." };
  }

  try {
    const result = await generateStructuredGated(
      { userId: user.id, meteredKey: "ai_operations_per_month" },
      {
        ...toPromptCallOptions(cvKeywordRewritePrompt, {
          currentText: parsed.data.currentSummary,
          keyword: parsed.data.keyword,
          contentLabel: "professional summary",
        }),
        schema: cvKeywordRewriteSchema,
      },
    );
    const rewriteId = await persistRewrite(supabase, {
      userId: user.id,
      versionId: parsed.data.versionId,
      sectionKey: "summary",
      originalText: parsed.data.currentSummary,
      suggestedText: result.rewrittenText,
      explanation: result.explanation,
      promptVersion: cvKeywordRewritePrompt.version,
    });
    return { applied: result.applied, suggestion: result.rewrittenText, explanation: result.explanation, rewriteId };
  } catch (err) {
    return { error: safeErrorMessage(err) };
  }
}

export async function rewriteExperienceForKeyword(input: {
  versionId: string;
  keyword: string;
  experienceId: string;
  jobTitle: string;
  currentDescription: string;
}): Promise<KeywordRewriteResult> {
  const user = await requireUser();
  const parsed = rewriteExperienceForKeywordSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createClient();
  if (!(await getVersionOwner(supabase, user.id, parsed.data.versionId))) {
    return { error: "That CV couldn't be found." };
  }

  try {
    const result = await generateStructuredGated(
      { userId: user.id, meteredKey: "ai_operations_per_month" },
      {
        ...toPromptCallOptions(cvKeywordRewritePrompt, {
          currentText: parsed.data.currentDescription,
          keyword: parsed.data.keyword,
          contentLabel: `bullet points for the role of ${parsed.data.jobTitle}`,
        }),
        schema: cvKeywordRewriteSchema,
      },
    );
    const rewriteId = await persistRewrite(supabase, {
      userId: user.id,
      versionId: parsed.data.versionId,
      sectionKey: "experience",
      originalText: parsed.data.currentDescription,
      suggestedText: result.rewrittenText,
      explanation: result.explanation,
      promptVersion: cvKeywordRewritePrompt.version,
    });
    return { applied: result.applied, suggestion: result.rewrittenText, explanation: result.explanation, rewriteId };
  } catch (err) {
    return { error: safeErrorMessage(err) };
  }
}
