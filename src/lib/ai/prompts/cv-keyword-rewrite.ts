import { z } from "zod";
import type { PromptDefinition } from "@/lib/ai/prompts/types";
import { ANTI_FABRICATION_INSTRUCTION, UK_CONVENTIONS_INSTRUCTION } from "@/lib/ai/prompts/shared";

export type CvKeywordRewriteInput = {
  currentText: string;
  keyword: string;
  contentLabel: string;
};

export const cvKeywordRewriteSchema = z.object({
  applied: z
    .boolean()
    .describe(
      "True only if the term was worked in using something truthfully already stated or clearly implied by the input. False if that isn't possible without inventing a new fact.",
    ),
  rewrittenText: z.string().min(1).max(4000),
  explanation: z.string().min(1).max(300),
});

export type CvKeywordRewriteOutput = z.infer<typeof cvKeywordRewriteSchema>;

/**
 * Distinct from cv-rewrite.ts's general-purpose "make this stronger"
 * prompts — every call here has one specific, narrow goal: work a named
 * term (an ATS keyword gap) into existing CV text without inventing
 * anything to do it. `applied` is the honest signal the caller needs:
 * true means the term now genuinely, truthfully appears; false means
 * the model looked and couldn't do it without fabricating a tool,
 * skill, or achievement that isn't already there — the caller should
 * show that as "couldn't add this truthfully", not silently succeed
 * with padded, dishonest text.
 */
export const cvKeywordRewritePrompt: PromptDefinition<CvKeywordRewriteInput, CvKeywordRewriteOutput> = {
  id: "cv_keyword_rewrite",
  version: "1.0.0",
  operation: "cv_keyword_rewrite",
  schema: cvKeywordRewriteSchema,
  buildSystem: () =>
    [
      "You are a CV-writing assistant. You are given one specific term a job description emphasizes that is " +
        "missing from part of someone's CV, and asked to try to work it in.",
      "Only set `applied` to true if the term describes something truthfully already stated or clearly implied by " +
        "the input text — rewording \"analysed website traffic trends\" to name a specific analytics tool that " +
        "phrase clearly implies is reasonable; claiming a tool, certification, methodology, or years of experience " +
        "that isn't already there is not, no matter how plausible it sounds for the role.",
      "If you cannot work the term in truthfully, set `applied` to false and return the input essentially " +
        "unchanged — fix only obvious errors, don't rewrite for its own sake, and never force the term in " +
        "dishonestly just to report success.",
      UK_CONVENTIONS_INSTRUCTION,
      ANTI_FABRICATION_INSTRUCTION,
    ].join(" "),
  buildPrompt: (input) =>
    [
      `Content: ${input.contentLabel}`,
      "Current text:",
      input.currentText,
      "",
      `Term to try to work in: "${input.keyword}"`,
      "",
      "Rewrite this to naturally include that term if — and only if — you can do so truthfully.",
    ].join("\n"),
};
