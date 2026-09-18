import { z } from "zod";
import type { PromptDefinition } from "@/lib/ai/prompts/types";
import { ANTI_FABRICATION_INSTRUCTION, UK_CONVENTIONS_INSTRUCTION } from "@/lib/ai/prompts/shared";

export type CoverLetterParagraphRewriteInput = {
  paragraphContent: string;
  paragraphIndex: number;
  totalParagraphs: number;
  surroundingContext: string;
  cvText: string;
  jobDescription: string;
  companyName: string;
  jobTitle: string;
  tone: "formal" | "conversational";
};

export const coverLetterParagraphRewriteSchema = z.object({
  paragraph: z
    .string()
    .min(1)
    .max(1200)
    .describe("The rewritten paragraph only, as plain text — not the whole letter, and not wrapped in quotes."),
  explanation: z
    .string()
    .min(1)
    .max(300)
    .describe("One or two plain-English sentences explaining what changed and why it's stronger."),
});

export type CoverLetterParagraphRewriteOutput = z.infer<typeof coverLetterParagraphRewriteSchema>;

/**
 * Regenerates exactly one paragraph of an existing cover letter draft —
 * the per-paragraph "Regenerate" action in the letter editor. Given the
 * *rest* of the letter as context (so the rewritten paragraph still
 * reads as part of the same letter, not a disconnected fragment) but
 * only ever asked to return that one paragraph back, same narrow-scope
 * shape as cvRewriteBulletsPrompt/cvRewriteSummaryPrompt regenerating
 * one CV field at a time.
 */
export const coverLetterParagraphRewritePrompt: PromptDefinition<
  CoverLetterParagraphRewriteInput,
  CoverLetterParagraphRewriteOutput
> = {
  id: "cover_letter_paragraph_rewrite",
  version: "1.0.0",
  operation: "cover_letter_paragraph_rewrite",
  schema: coverLetterParagraphRewriteSchema,
  buildSystem: (input) =>
    [
      "You are a cover letter writing assistant. Rewrite exactly one paragraph of an existing cover letter draft, " +
        "grounded only in the candidate's real CV content and the job description provided.",
      `Write in a ${input.tone} tone, matching the voice of the rest of the letter.`,
      `This is paragraph ${input.paragraphIndex} of ${input.totalParagraphs} — keep it roughly the same length as ` +
        "the original, and make sure it still flows naturally with the paragraphs before and after it rather than " +
        "repeating what they already say.",
      "Return only the rewritten paragraph itself, not the whole letter and not a list of options.",
      UK_CONVENTIONS_INSTRUCTION,
      ANTI_FABRICATION_INSTRUCTION,
    ].join(" "),
  buildPrompt: (input) =>
    [
      `Company: ${input.companyName}`,
      `Role: ${input.jobTitle}`,
      "",
      "Candidate's CV:",
      input.cvText,
      "",
      "Job description:",
      input.jobDescription,
      "",
      "The rest of the letter, for context (do not rewrite these, only reference them):",
      input.surroundingContext || "(this is the only paragraph in the letter)",
      "",
      `The paragraph to rewrite (paragraph ${input.paragraphIndex} of ${input.totalParagraphs}):`,
      input.paragraphContent,
      "",
      "Rewrite this paragraph, and briefly explain what you changed and why.",
    ].join("\n"),
};
