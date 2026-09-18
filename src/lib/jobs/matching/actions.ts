"use server";

import { requireUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { getCvEditorData } from "@/lib/cvs/queries";
import { buildCvPlainText } from "@/lib/cvs/ats-format-checks";
import { generateStructuredGated } from "@/lib/ai/gateway";
import { AIServiceError } from "@/lib/ai/errors";
import { EntitlementError } from "@/lib/entitlements/service";
import { toPromptCallOptions, jobMatchPrompt, jobMatchSchema } from "@/lib/ai/prompts";
import { getJobById } from "@/lib/jobs/queries";
import { deriveVerdict } from "@/lib/jobs/matching/verdict";
import { runJobMatchSchema } from "@/lib/jobs/matching/schemas";
import type { JobMatch } from "@/lib/jobs/types";

export type RunJobMatchResult = { error: string } | { match: JobMatch };

function safeErrorMessage(err: unknown): string {
  if (err instanceof AIServiceError || err instanceof EntitlementError) return err.message;
  console.error("Job match generation failed:", err);
  return "Couldn't run that match — try again.";
}

/**
 * Scores a user's CV against a specific job listing — the 0-100
 * `matchScore` plus four independently-scored, individually-summarized
 * components (coreSkills/techFunctionalSkills/domainFit/seniority,
 * src/lib/ai/prompts/job-match.ts v2.0.0) so a candidate can see *why*
 * the number is what it is, not just the number. `verdict` is derived
 * deterministically from `matchScore` (src/lib/jobs/matching/
 * verdict.ts) rather than asked of the AI, so the label can never
 * contradict the score.
 *
 * Gated purely on the `job_match` feature flag — no metered cap exists
 * for this operation today (src/lib/entitlements/types.ts has no
 * matching MeteredKey), so `generateStructuredGated`'s own guard is the
 * only entitlement check, same as runAtsScan's pattern
 * (src/lib/cvs/ats-actions.ts) of not duplicating a check the gateway
 * already performs.
 *
 * `cvText` comes from the CV's *saved* content (getCvEditorData ->
 * buildCvPlainText), unlike runAtsScan's live-editor-state text — a job
 * match is always run against a specific job listing from outside the
 * editor, so there's no "unsaved live preview" to score against here.
 */
export async function runJobMatch(input: { jobId: string; cvId: string }): Promise<RunJobMatchResult> {
  const user = await requireUser();

  const parsed = runJobMatchSchema.safeParse(input);
  if (!parsed.success) return { error: "Invalid request." };

  const [cv, job] = await Promise.all([getCvEditorData(user.id, parsed.data.cvId), getJobById(parsed.data.jobId)]);
  if (!cv) return { error: "That CV couldn't be found." };
  if (!job) return { error: "That job couldn't be found." };

  const cvText = buildCvPlainText(cv);

  let result;
  try {
    result = await generateStructuredGated(
      { userId: user.id, featureKey: "job_match" },
      {
        ...toPromptCallOptions(jobMatchPrompt, {
          cvText,
          jobTitle: job.title,
          jobDescription: job.description,
        }),
        schema: jobMatchSchema,
      },
    );
  } catch (err) {
    return { error: safeErrorMessage(err) };
  }

  const verdict = deriveVerdict(result.matchScore);

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("job_matches")
    .insert({
      user_id: user.id,
      job_id: job.id,
      cv_version_id: cv.versionId,
      match_score: result.matchScore,
      verdict,
      reasons: result.reasons,
      gaps: result.gaps,
      core_skills_score: result.coreSkills.score,
      core_skills_summary: result.coreSkills.summary,
      tech_functional_skills_score: result.techFunctionalSkills.score,
      tech_functional_skills_summary: result.techFunctionalSkills.summary,
      domain_fit_score: result.domainFit.score,
      domain_fit_summary: result.domainFit.summary,
      seniority_score: result.seniority.score,
      seniority_summary: result.seniority.summary,
      prompt_version: jobMatchPrompt.version,
    })
    .select(
      "id, job_id, cv_version_id, match_score, verdict, reasons, gaps, core_skills_score, core_skills_summary, tech_functional_skills_score, tech_functional_skills_summary, domain_fit_score, domain_fit_summary, seniority_score, seniority_summary, created_at",
    )
    .single();
  if (error || !data) return { error: "Your match was scored, but couldn't be saved — try again." };

  return {
    match: {
      id: data.id,
      jobId: data.job_id,
      cvVersionId: data.cv_version_id,
      matchScore: data.match_score,
      verdict: data.verdict,
      components: {
        coreSkills: { score: data.core_skills_score, summary: data.core_skills_summary },
        techFunctionalSkills: { score: data.tech_functional_skills_score, summary: data.tech_functional_skills_summary },
        domainFit: { score: data.domain_fit_score, summary: data.domain_fit_summary },
        seniority: { score: data.seniority_score, summary: data.seniority_summary },
      },
      reasons: data.reasons,
      gaps: data.gaps,
      createdAt: data.created_at,
    },
  };
}
