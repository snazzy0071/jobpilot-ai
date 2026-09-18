"use server";

import { requireUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { getCoverLetterVersionOwner, persistParagraphRewrite } from "@/lib/cover-letters/internal";
import { generateStructuredGated } from "@/lib/ai/gateway";
import { AIServiceError } from "@/lib/ai/errors";
import { EntitlementError } from "@/lib/entitlements/service";
import { toPromptCallOptions, coverLetterParagraphRewritePrompt, coverLetterParagraphRewriteSchema } from "@/lib/ai/prompts";
import { regenerateParagraphSchema, resolveParagraphRewriteSchema } from "@/lib/cover-letters/schemas";

// Same shape as src/lib/cvs/ai-actions.ts's AiRewriteResult — kept as an
// independent type rather than imported, since this feature's rewrite
// history lives in a different table, but identical structurally so
// AiRewritePanel (src/components/cvs/editor/ai-rewrite-panel.tsx) can
// be reused here unmodified.
export type RegenerateParagraphResult =
  | { error: string }
  | { suggestion: string; explanation: string; rewriteId: string | null };

function safeErrorMessage(err: unknown): string {
  if (err instanceof AIServiceError || err instanceof EntitlementError) return err.message;
  console.error("Cover letter paragraph regenerate failed:", err);
  return "Couldn't generate a suggestion — try again.";
}

/**
 * Regenerates one paragraph — the per-paragraph "Regenerate" action.
 * Tone, the source CV's text, and the job/company details are all
 * re-read from the database here, never trusted from the client: only
 * the paragraph's own current (possibly unsaved) text comes from the
 * caller, everything else that grounds the rewrite is the real,
 * currently-saved state of this version and its parent letter.
 */
export async function regenerateParagraph(input: {
  versionId: string;
  paragraphId: string;
  paragraphContent: string;
  paragraphIndex: number;
  totalParagraphs: number;
  otherParagraphs: string;
}): Promise<RegenerateParagraphResult> {
  const user = await requireUser();
  const parsed = regenerateParagraphSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const owned = await getCoverLetterVersionOwner(supabase, user.id, parsed.data.versionId);
  if (!owned) return { error: "That cover letter couldn't be found." };

  const { data: version, error: versionError } = await supabase
    .from("cover_letter_versions")
    .select("tone, cv_text_snapshot")
    .eq("id", parsed.data.versionId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (versionError || !version) return { error: "That cover letter couldn't be found." };

  const { data: letter, error: letterError } = await supabase
    .from("cover_letters")
    .select("company_name, job_title, job_description")
    .eq("id", owned.coverLetterId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (letterError || !letter) return { error: "That cover letter couldn't be found." };

  try {
    const result = await generateStructuredGated(
      { userId: user.id, featureKey: "cover_letter_generator", meteredKey: "ai_operations_per_month" },
      {
        ...toPromptCallOptions(coverLetterParagraphRewritePrompt, {
          paragraphContent: parsed.data.paragraphContent,
          paragraphIndex: parsed.data.paragraphIndex,
          totalParagraphs: parsed.data.totalParagraphs,
          surroundingContext: parsed.data.otherParagraphs,
          cvText: version.cv_text_snapshot,
          jobDescription: letter.job_description,
          companyName: letter.company_name,
          jobTitle: letter.job_title,
          tone: version.tone,
        }),
        schema: coverLetterParagraphRewriteSchema,
      },
    );

    const rewriteId = await persistParagraphRewrite(supabase, {
      userId: user.id,
      paragraphId: parsed.data.paragraphId,
      originalText: parsed.data.paragraphContent,
      suggestedText: result.paragraph,
      explanation: result.explanation,
      promptVersion: coverLetterParagraphRewritePrompt.version,
    });

    return { suggestion: result.paragraph, explanation: result.explanation, rewriteId };
  } catch (err) {
    return { error: safeErrorMessage(err) };
  }
}

/** Marks a previously-suggested paragraph rewrite accepted or rejected — best-effort, called from AiRewritePanel on Accept/Reject. */
export async function resolveCoverLetterParagraphRewrite(input: {
  rewriteId: string;
  status: "accepted" | "rejected";
}): Promise<void> {
  const user = await requireUser();
  const parsed = resolveParagraphRewriteSchema.safeParse(input);
  if (!parsed.success) return;

  const supabase = await createClient();
  await supabase
    .from("cover_letter_paragraph_rewrites")
    .update({ status: parsed.data.status, resolved_at: new Date().toISOString() })
    .eq("id", parsed.data.rewriteId)
    .eq("user_id", user.id)
    .eq("status", "suggested");
}
