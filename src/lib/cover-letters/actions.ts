"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { getCvEditorData } from "@/lib/cvs/queries";
import { buildCvPlainText } from "@/lib/cvs/ats-format-checks";
import { generateTextGated } from "@/lib/ai/gateway";
import { AIServiceError } from "@/lib/ai/errors";
import { EntitlementError } from "@/lib/entitlements/service";
import { toPromptCallOptions, coverLetterPrompt } from "@/lib/ai/prompts";
import { assertOwnsCoverLetterVersion } from "@/lib/cover-letters/internal";
import {
  generateCoverLetterSchema,
  restoreCoverLetterVersionSchema,
  updateCoverLetterTemplateSchema,
} from "@/lib/cover-letters/schemas";

// Never actually resolves with a coverLetterId on success — see the redirect() at the end of
// generateCoverLetter below. The type stays `{ error: string }` only; a successful call never returns because
// redirect() throws its own control-flow signal that Next's Server Action runtime intercepts and turns into a real
// navigation, same as createCv (src/lib/cvs/actions.ts). This isn't just style: doing the redirect server-side,
// inside the same action call that just wrote the row, is what makes it race-free. The previous version returned
// { coverLetterId } for the client to `router.push` itself — a *second*, separate client-side navigation after the
// server action's response had already landed — and that gap was enough for Next's App Router to occasionally miss
// re-establishing CoverLetterPreviewProvider before CoverLetterPreview's first render on the new route, crashing
// the whole page with "useCoverLetterPreview must be used within a CoverLetterPreviewProvider" (a genuine bug,
// reliably reproducible, found while adding this feature's first e2e coverage — not present in CVs' own equivalent
// create flow because it already redirected server-side).
export type GenerateCoverLetterResult = { error: string };
export type CoverLetterActionResult = { error: string } | { success: string } | void;

/** The model writes blank-line-separated paragraphs (coverLetterPrompt's own "opening/body paragraphs/closing" structure instruction) — this is what turns that plain-text draft into the editor's individually-editable rows. */
function splitIntoParagraphs(content: string): string[] {
  return content
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.trim())
    .filter((paragraph) => paragraph.length > 0);
}

/**
 * The Cover Letter Generator's create flow: choose a CV, provide a job,
 * pick tone and length, generate. Unlike the original one-shot version
 * of this feature, the output is no longer an immutable blob — it seeds
 * a real, editable document: a `cover_letters` container, its first
 * `cover_letter_versions` row (tone/length/source-CV snapshot), and one
 * `cover_letter_paragraphs` row per paragraph the model wrote, ready for
 * the paragraph editor at /dashboard/cover-letters/[id] (autosave,
 * per-paragraph Regenerate/Accept/Reject, tone/length controls, version
 * history — see paragraph-actions.ts and rewrite-actions.ts).
 *
 * Grounded only in real content: `cvText` is built server-side from the
 * selected CV's last-saved current version (getCvEditorData +
 * buildCvPlainText — there's no live-editing context on this page),
 * and coverLetterPrompt's own ANTI_FABRICATION_INSTRUCTION is what stops
 * the model inventing anything beyond what that CV text and the job
 * description actually say.
 *
 * Gated on `{ featureKey: "cover_letter_generator", meteredKey:
 * "ai_operations_per_month" }` together — cover letters have no metered
 * key of their own (src/lib/entitlements/types.ts), so both the
 * plan-level boolean gate and the shared AI-cost budget are needed.
 */
export async function generateCoverLetter(formData: FormData): Promise<GenerateCoverLetterResult> {
  const user = await requireUser();

  const parsed = generateCoverLetterSchema.safeParse({
    cvId: formData.get("cvId"),
    companyName: formData.get("companyName"),
    jobTitle: formData.get("jobTitle"),
    jobDescription: formData.get("jobDescription"),
    tone: formData.get("tone"),
    length: formData.get("length"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const cv = await getCvEditorData(user.id, parsed.data.cvId);
  if (!cv) return { error: "That CV couldn't be found." };

  const cvText = buildCvPlainText(cv);
  if (!cvText.trim()) return { error: "That CV has no content yet — add some before generating a cover letter." };

  let content: string;
  try {
    content = await generateTextGated(
      { userId: user.id, featureKey: "cover_letter_generator", meteredKey: "ai_operations_per_month" },
      toPromptCallOptions(coverLetterPrompt, {
        cvText,
        jobDescription: parsed.data.jobDescription,
        companyName: parsed.data.companyName,
        jobTitle: parsed.data.jobTitle,
        tone: parsed.data.tone,
        length: parsed.data.length,
      }),
    );
  } catch (err) {
    if (err instanceof AIServiceError || err instanceof EntitlementError) return { error: err.message };
    console.error("Cover letter generation failed:", err);
    return { error: "Couldn't generate that cover letter — try again." };
  }

  const paragraphs = splitIntoParagraphs(content);
  if (paragraphs.length === 0) return { error: "That came back empty — try again." };

  const supabase = await createClient();

  const { data: letterRow, error: letterError } = await supabase
    .from("cover_letters")
    .insert({
      user_id: user.id,
      company_name: parsed.data.companyName,
      job_title: parsed.data.jobTitle,
      job_description: parsed.data.jobDescription,
    })
    .select("id")
    .single();
  if (letterError || !letterRow) return { error: "Your letter was generated, but couldn't be saved — try again." };

  const { data: versionRow, error: versionError } = await supabase
    .from("cover_letter_versions")
    .insert({
      cover_letter_id: letterRow.id,
      user_id: user.id,
      tone: parsed.data.tone,
      length: parsed.data.length,
      cv_version_id: cv.versionId,
      cv_text_snapshot: cvText,
      prompt_version: coverLetterPrompt.version,
    })
    .select("id")
    .single();
  if (versionError || !versionRow) {
    await supabase.from("cover_letters").delete().eq("id", letterRow.id);
    return { error: "Your letter was generated, but couldn't be saved — try again." };
  }

  const { error: paragraphsError } = await supabase.from("cover_letter_paragraphs").insert(
    paragraphs.map((paragraphContent, index) => ({
      version_id: versionRow.id,
      user_id: user.id,
      content: paragraphContent,
      display_order: index,
    })),
  );
  if (paragraphsError) {
    // Cascades: deleting the container takes the version and any
    // paragraphs that did make it in with it (both FKs are ON DELETE
    // CASCADE) — one cleanup call, not three.
    await supabase.from("cover_letters").delete().eq("id", letterRow.id);
    return { error: "Your letter was generated, but couldn't be saved — try again." };
  }

  revalidatePath("/dashboard/cover-letters");
  redirect(`/dashboard/cover-letters/${letterRow.id}`);
}

/**
 * Makes an earlier version current again — the "recover" half of
 * recoverable version history. Reuses the exact is_current + demotion-
 * trigger mechanism migration 0038 built for cover letters (mirroring
 * migration 0024's cv_versions one exactly): restoring isn't a special
 * case, it's just setting is_current on a version that happens to be
 * older. Passes through assertOwnsCoverLetterVersion (not the lighter
 * ownership-only check) so the version being switched *away* from gets
 * one last snapshot first, same as CVs.
 */
export async function restoreCoverLetterVersion(
  _prevState: CoverLetterActionResult,
  formData: FormData,
): Promise<CoverLetterActionResult> {
  const user = await requireUser();
  const parsed = restoreCoverLetterVersionSchema.safeParse({
    coverLetterId: formData.get("coverLetterId"),
    versionId: formData.get("versionId"),
  });
  if (!parsed.success) return { error: "Invalid request." };

  const supabase = await createClient();
  const owned = await assertOwnsCoverLetterVersion(supabase, user.id, parsed.data.versionId);
  if (!owned || owned.coverLetterId !== parsed.data.coverLetterId) return { error: "That version couldn't be found." };

  const { error } = await supabase
    .from("cover_letter_versions")
    .update({ is_current: true })
    .eq("id", parsed.data.versionId)
    .eq("user_id", user.id);
  if (error) return { error: "Couldn't restore that version — try again." };

  revalidatePath(`/dashboard/cover-letters/${parsed.data.coverLetterId}`);
  return { success: "Restored." };
}

/**
 * Switches which of the 4 templates renders this letter — a pure
 * display change, same as CVs' updateCvTemplate: `template` lives on
 * the container (`cover_letters`), not per-version, so this never
 * touches paragraph content and needs no history-snapshot protection.
 */
export async function updateCoverLetterTemplate(
  _prevState: CoverLetterActionResult,
  formData: FormData,
): Promise<CoverLetterActionResult> {
  const user = await requireUser();
  const parsed = updateCoverLetterTemplateSchema.safeParse({
    coverLetterId: formData.get("coverLetterId"),
    template: formData.get("template"),
  });
  if (!parsed.success) return { error: "Invalid request." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("cover_letters")
    .update({ template: parsed.data.template })
    .eq("id", parsed.data.coverLetterId)
    .eq("user_id", user.id);
  if (error) return { error: "Couldn't switch templates — try again." };

  revalidatePath(`/dashboard/cover-letters/${parsed.data.coverLetterId}`);
  revalidatePath("/dashboard/cover-letters");
  return { success: "Switched." };
}
