"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { getVersionOwner } from "@/lib/cvs/internal";
import { generateStructuredGated } from "@/lib/ai/gateway";
import { AIServiceError } from "@/lib/ai/errors";
import { EntitlementError } from "@/lib/entitlements/service";
import { toPromptCallOptions, atsScanPrompt, atsScanSchema } from "@/lib/ai/prompts";
import { runAtsScanSchema } from "@/lib/cvs/schemas";
import { countTermOccurrences } from "@/lib/cvs/ats-keyword-occurrences";
import { sendAtsReportEmail } from "@/lib/cvs/send-ats-report-email";
import type { CvAtsScan, CvAtsFormatIssue } from "@/lib/cvs/types";

export type RunAtsScanResult = { error: string } | { scan: CvAtsScan };

/**
 * The AI half of the ATS pre-flight check — the format-issue half
 * (src/lib/cvs/ats-format-checks.ts) is deterministic and needs no
 * server round trip at all. Scored against the *current* live content
 * the caller sends (built client-side from the same useCvPreview()-
 * merged data the live preview itself renders — see AtsPreflightPanel),
 * not a re-fetch of last-saved DB content, so "re-score after edits"
 * reflects what's actually on screen right now. The caller's own live
 * `formatIssues` snapshot is persisted alongside the AI result
 * (migration 0031's ats_issues) rather than recomputed server-side, so
 * the historical record matches exactly what the user saw at the moment
 * they clicked "Run ATS scan" — same invariant as `cvText`.
 *
 * The AI engine itself (src/lib/ai/prompts/ats-scan.ts, v2.1.0) returns
 * five independent 0-100 scores (overall/keyword/structure/format/
 * sections), an ordered, prioritized fix list, and matched/missing
 * keywords each rated `importance` and (for a gap) a suggested section —
 * all the model's own judgment. `occurrenceCount` is the one field on
 * each keyword that ISN'T: it's counted here, deterministically, from
 * the actual job description text (src/lib/cvs/ats-keyword-
 * occurrences.ts) — exact counting is a poor fit for an LLM to
 * self-report, and there's no need to ask it to when code can just count.
 *
 * Gated on `tailored_ats_scans_per_month` (migration 0016) — the metered
 * key that migration's own comment defines as exactly this: "scored
 * against a specific job description," as opposed to
 * `quick_ats_scans_per_month`'s no-JD-required scan used elsewhere.
 */
export async function runAtsScan(input: {
  versionId: string;
  jobDescription: string;
  cvText: string;
  formatIssues: CvAtsFormatIssue[];
  reusedFromScanId?: string;
}): Promise<RunAtsScanResult> {
  const user = await requireUser();
  const parsed = runAtsScanSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const owner = await getVersionOwner(supabase, user.id, parsed.data.versionId);
  if (!owner) return { error: "That CV couldn't be found." };

  let result;
  try {
    result = await generateStructuredGated(
      { userId: user.id, meteredKey: "tailored_ats_scans_per_month" },
      {
        ...toPromptCallOptions(atsScanPrompt, {
          cvText: parsed.data.cvText,
          jobDescription: parsed.data.jobDescription,
        }),
        schema: atsScanSchema,
      },
    );
  } catch (err) {
    if (err instanceof AIServiceError || err instanceof EntitlementError) return { error: err.message };
    console.error("ATS scan failed:", err);
    return { error: "Couldn't run that scan — try again." };
  }

  const { data: scanRow, error: insertError } = await supabase
    .from("ats_scans")
    .insert({
      user_id: user.id,
      source: "cv_version",
      cv_version_id: parsed.data.versionId,
      cv_text_snapshot: parsed.data.cvText,
      job_description: parsed.data.jobDescription,
      reused_from_scan_id: parsed.data.reusedFromScanId ?? null,
      match_score: result.scores.overall,
      keyword_score: result.scores.keyword,
      structure_score: result.scores.structure,
      format_score: result.scores.format,
      sections_score: result.scores.sections,
      summary: result.summary,
      strengths: result.strengths,
      prompt_version: atsScanPrompt.version,
    })
    .select(
      "id, job_description, match_score, keyword_score, structure_score, format_score, sections_score, summary, strengths, created_at",
    )
    .single();

  if (insertError || !scanRow) return { error: "Scan completed, but couldn't be saved — try again." };

  // occurrence_count is deterministic — counted here from the actual job
  // description text (src/lib/cvs/ats-keyword-occurrences.ts), never
  // asked of the model, which the schema doesn't even give it a field
  // for. Computed once and reused for both the DB rows and the returned
  // scan below, rather than recounting per use site.
  const matchedKeywords = result.matchedKeywords.map((keyword) => ({
    term: keyword.term,
    importance: keyword.importance,
    occurrenceCount: countTermOccurrences(keyword.term, parsed.data.jobDescription),
  }));
  const missingKeywords = result.missingKeywords.map((keyword) => ({
    term: keyword.term,
    importance: keyword.importance,
    occurrenceCount: countTermOccurrences(keyword.term, parsed.data.jobDescription),
    suggestedSection: keyword.suggestedSection,
  }));

  const keywordRows = [
    ...matchedKeywords.map((keyword) => ({
      scan_id: scanRow.id,
      user_id: user.id,
      keyword: keyword.term,
      status: "matched" as const,
      importance: keyword.importance,
      occurrence_count: keyword.occurrenceCount,
      suggested_section: null,
    })),
    ...missingKeywords.map((keyword) => ({
      scan_id: scanRow.id,
      user_id: user.id,
      keyword: keyword.term,
      status: "missing" as const,
      importance: keyword.importance,
      occurrence_count: keyword.occurrenceCount,
      suggested_section: keyword.suggestedSection,
    })),
  ];
  const issueRows = [
    ...parsed.data.formatIssues.map((issue) => ({
      scan_id: scanRow.id,
      user_id: user.id,
      source: "format" as const,
      severity: issue.severity,
      priority: null,
      issue_key: issue.id,
      section_key: issue.sectionKey,
      message: issue.message,
    })),
    ...result.prioritizedFixes.map((fix) => ({
      scan_id: scanRow.id,
      user_id: user.id,
      source: "ai" as const,
      // Only two severities exist for the icon shown in the deterministic
      // issues list; "high" fixes reuse "warning", "medium"/"low" reuse
      // "info" — priority (below) is what actually carries the AI's
      // three-level ranking, this is just for a consistent icon.
      severity: fix.priority === "high" ? ("warning" as const) : ("info" as const),
      priority: fix.priority,
      issue_key: null,
      section_key: fix.section,
      message: fix.message,
    })),
  ];

  // Best-effort, same as the cv_versions.ats_score write below — the
  // scan's headline result is already in hand either way, so a failure
  // persisting the breakdown shouldn't hide it behind an error.
  if (keywordRows.length > 0) {
    const { error } = await supabase.from("ats_keywords").insert(keywordRows);
    if (error) console.error("Couldn't persist ats_keywords:", error.message);
  }
  if (issueRows.length > 0) {
    const { error } = await supabase.from("ats_issues").insert(issueRows);
    if (error) console.error("Couldn't persist ats_issues:", error.message);
  }

  await supabase
    .from("cv_versions")
    .update({ ats_score: result.scores.overall })
    .eq("id", parsed.data.versionId)
    .eq("user_id", user.id);

  revalidatePath(`/dashboard/cvs/${owner.cvId}`);
  revalidatePath("/dashboard/cvs");

  if (user.email) {
    await sendAtsReportEmail(
      user.email,
      result.scores.overall,
      missingKeywords.slice(0, 8).map((keyword) => keyword.term),
      owner.cvId,
    );
  }

  return {
    scan: {
      id: scanRow.id,
      jobDescription: scanRow.job_description,
      overallScore: scanRow.match_score,
      keywordScore: scanRow.keyword_score,
      structureScore: scanRow.structure_score,
      formatScore: scanRow.format_score,
      sectionsScore: scanRow.sections_score,
      matchedKeywords,
      missingKeywords,
      strengths: scanRow.strengths,
      prioritizedFixes: result.prioritizedFixes.map((fix) => ({
        priority: fix.priority,
        sectionKey: fix.section,
        message: fix.message,
      })),
      summary: scanRow.summary,
      createdAt: scanRow.created_at,
    },
  };
}
