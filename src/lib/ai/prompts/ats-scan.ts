import { z } from "zod";
import type { PromptDefinition } from "@/lib/ai/prompts/types";
import { ANTI_FABRICATION_INSTRUCTION, UK_CONVENTIONS_INSTRUCTION } from "@/lib/ai/prompts/shared";
import { SECTION_KEYS } from "@/lib/cvs/types";

export type AtsScanInput = {
  cvText: string;
  jobDescription: string;
};

export const atsScanScoresSchema = z.object({
  overall: z.number().int().min(0).max(100).describe("Overall likelihood this CV clears an ATS screen and reads well to a recruiter for this specific job — the headline number."),
  keyword: z.number().int().min(0).max(100).describe("How well the CV's own language covers the job description's key terms, skills, and requirements — not just presence, but relevance and how naturally they're used."),
  structure: z.number().int().min(0).max(100).describe("How logically organised and easy to follow the CV reads — ordering, internal consistency (e.g. date formats), clarity of what belongs where."),
  format: z.number().int().min(0).max(100).describe("How reliably an ATS parser would extract this content correctly — clear role/section headings, unambiguous dates, no content that reads as though it depends on visual layout to make sense."),
  sections: z.number().int().min(0).max(100).describe("How complete and well-developed the CV's standard sections are for this job — summary, experience, education, skills each pulling their weight, not just present."),
});

export type AtsScanScores = z.infer<typeof atsScanScoresSchema>;

export const atsPrioritizedFixSchema = z.object({
  priority: z.enum(["high", "medium", "low"]).describe("high = would meaningfully hurt this specific application; low = a nice-to-have polish."),
  section: z
    .enum(SECTION_KEYS)
    .nullable()
    .describe("The one CV section this fix most applies to, or null if it's a general/cross-cutting fix."),
  message: z.string().min(1).max(240),
});

export type AtsPrioritizedFix = z.infer<typeof atsPrioritizedFixSchema>;

const atsKeywordImportanceSchema = z
  .enum(["high", "medium", "low"])
  .describe("high = a core requirement or repeated theme in the job description; low = mentioned once, in passing.");

export const atsMatchedKeywordSchema = z.object({
  term: z.string().min(1).max(60),
  importance: atsKeywordImportanceSchema,
});

export type AtsMatchedKeyword = z.infer<typeof atsMatchedKeywordSchema>;

export const atsMissingKeywordSchema = z.object({
  term: z.string().min(1).max(60),
  importance: atsKeywordImportanceSchema,
  suggestedSection: z
    .enum(SECTION_KEYS)
    .nullable()
    .describe("The one CV section where this term would most naturally belong if added — null only if genuinely unclear which."),
});

export type AtsMissingKeyword = z.infer<typeof atsMissingKeywordSchema>;

export const atsScanSchema = z.object({
  scores: atsScanScoresSchema,
  matchedKeywords: z.array(atsMatchedKeywordSchema).max(30),
  missingKeywords: z.array(atsMissingKeywordSchema).max(30),
  strengths: z.array(z.string().min(1).max(240)).min(1).max(5),
  prioritizedFixes: z.array(atsPrioritizedFixSchema).min(1).max(8).describe("Ordered strongest-priority first."),
  summary: z.string().min(1).max(600),
});

export type AtsScanOutput = z.infer<typeof atsScanSchema>;

export const atsScanPrompt: PromptDefinition<AtsScanInput, AtsScanOutput> = {
  id: "ats_scan",
  version: "2.1.0",
  operation: "ats_scan",
  schema: atsScanSchema,
  buildSystem: () =>
    [
      "You are an ATS (applicant tracking system) match analyst. Compare a CV against a job description the way an " +
        "automated screening tool and a recruiter both would.",
      "Score five things independently, each 0-100, and don't let a high score on one prop up another: `overall` is " +
        "the headline read on this CV's chances for this specific job — genuine alignment, not how well-written the " +
        "CV is in isolation (a beautifully written CV for an unrelated role should score low on `overall` even if " +
        "`structure` and `format` score well). `keyword` covers relevant terms from the job description actually " +
        "appearing in the CV's own language. `structure` covers organisation and internal consistency. `format` " +
        "covers how reliably an ATS parser would extract this content correctly. `sections` covers how complete and " +
        "developed the standard sections are for this job.",
      "matchedKeywords and missingKeywords must be terms that actually appear (or are actually absent) in the texts " +
        "given, not general assumptions about the role. Rate each one's `importance` by how central it is to the job " +
        "description — a term repeated across several requirements is high importance; one mentioned once in " +
        "passing is low. For each missing term, name the one CV section it would most naturally be added to " +
        "(`suggestedSection`) — this becomes a direct link to that section, so give your best real answer rather " +
        "than defaulting to null.",
      "prioritizedFixes is ordered strongest-priority first, each naming a `section` when the fix clearly belongs to " +
        "one (null for a general fix) — this becomes a clickable link straight to that section in the CV editor, so " +
        "get it right rather than defaulting to null.",
      UK_CONVENTIONS_INSTRUCTION,
      ANTI_FABRICATION_INSTRUCTION,
    ].join(" "),
  buildPrompt: (input) =>
    [
      "CV:",
      input.cvText,
      "",
      "Job description:",
      input.jobDescription,
      "",
      "Score this CV against this job across all five dimensions, identify keyword overlap, strengths, and " +
        "prioritized fixes.",
    ].join("\n"),
};
