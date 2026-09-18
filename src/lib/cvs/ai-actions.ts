"use server";

import { requireUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { getVersionOwner, persistRewrite } from "@/lib/cvs/internal";
import { generateStructuredGated } from "@/lib/ai/gateway";
import { AIServiceError } from "@/lib/ai/errors";
import { EntitlementError } from "@/lib/entitlements/service";
import { toPromptCallOptions, cvRewriteSummaryPrompt, cvRewriteSummarySchema, cvRewriteBulletsPrompt, cvRewriteBulletsSchema } from "@/lib/ai/prompts";
import { aiRewriteSummarySchema, aiRewriteExperienceSchema, resolveAiRewriteSchema } from "@/lib/cvs/schemas";

export type AiRewriteResult =
  | { error: string }
  // `rewriteId` is null only if the persistence insert itself failed —
  // the suggestion is still shown either way (see persistRewrite,
  // src/lib/cvs/internal.ts), it just can't later be marked accepted/
  // rejected.
  | { suggestion: string; explanation: string; rewriteId: string | null };

/** Both AIServiceError and EntitlementError carry messages that are always safe to show a user — anything else isn't. */
function safeErrorMessage(err: unknown): string {
  if (err instanceof AIServiceError || err instanceof EntitlementError) return err.message;
  console.error("CV AI rewrite failed:", err);
  return "Couldn't generate a suggestion — try again.";
}

export async function rewriteSummaryWithAi(input: {
  versionId: string;
  currentSummary: string;
  headline?: string | null;
}): Promise<AiRewriteResult> {
  const user = await requireUser();
  const parsed = aiRewriteSummarySchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createClient();
  if (!(await getVersionOwner(supabase, user.id, parsed.data.versionId))) {
    return { error: "That CV couldn't be found." };
  }

  try {
    const result = await generateStructuredGated(
      { userId: user.id, meteredKey: "ai_operations_per_month" },
      {
        ...toPromptCallOptions(cvRewriteSummaryPrompt, {
          currentSummary: parsed.data.currentSummary,
          headline: parsed.data.headline ?? undefined,
        }),
        schema: cvRewriteSummarySchema,
      },
    );
    const rewriteId = await persistRewrite(supabase, {
      userId: user.id,
      versionId: parsed.data.versionId,
      sectionKey: "summary",
      originalText: parsed.data.currentSummary,
      suggestedText: result.summary,
      explanation: result.explanation,
      promptVersion: cvRewriteSummaryPrompt.version,
    });
    return { suggestion: result.summary, explanation: result.explanation, rewriteId };
  } catch (err) {
    return { error: safeErrorMessage(err) };
  }
}

export async function rewriteExperienceWithAi(input: {
  versionId: string;
  jobTitle: string;
  currentDescription: string;
}): Promise<AiRewriteResult> {
  const user = await requireUser();
  const parsed = aiRewriteExperienceSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createClient();
  if (!(await getVersionOwner(supabase, user.id, parsed.data.versionId))) {
    return { error: "That CV couldn't be found." };
  }

  try {
    const result = await generateStructuredGated(
      { userId: user.id, meteredKey: "ai_operations_per_month" },
      {
        ...toPromptCallOptions(cvRewriteBulletsPrompt, {
          roleTitle: parsed.data.jobTitle,
          rawDescription: parsed.data.currentDescription,
        }),
        schema: cvRewriteBulletsSchema,
      },
    );
    const suggestion = result.bullets.map((bullet) => `- ${bullet}`).join("\n");
    const rewriteId = await persistRewrite(supabase, {
      userId: user.id,
      versionId: parsed.data.versionId,
      sectionKey: "experience",
      originalText: parsed.data.currentDescription,
      suggestedText: suggestion,
      explanation: result.explanation,
      promptVersion: cvRewriteBulletsPrompt.version,
    });
    return { suggestion, explanation: result.explanation, rewriteId };
  } catch (err) {
    return { error: safeErrorMessage(err) };
  }
}

/** Marks a previously-suggested rewrite accepted or rejected — best-effort, called from AiRewritePanel on Accept/Reject. */
export async function resolveAtsRewrite(input: { rewriteId: string; status: "accepted" | "rejected" }): Promise<void> {
  const user = await requireUser();
  const parsed = resolveAiRewriteSchema.safeParse(input);
  if (!parsed.success) return;

  const supabase = await createClient();
  await supabase
    .from("ats_rewrites")
    .update({ status: parsed.data.status, resolved_at: new Date().toISOString() })
    .eq("id", parsed.data.rewriteId)
    .eq("user_id", user.id)
    .eq("status", "suggested");
}
