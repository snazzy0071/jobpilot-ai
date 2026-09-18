import { z } from "zod";
import type { PromptDefinition } from "@/lib/ai/prompts/types";
import { ANTI_FABRICATION_INSTRUCTION, UK_CONVENTIONS_INSTRUCTION } from "@/lib/ai/prompts/shared";

export type CvRewriteInput = {
  roleTitle: string;
  rawDescription: string;
  targetJobTitle?: string;
};

export const cvRewriteBulletsSchema = z.object({
  bullets: z
    .array(z.string().min(1).max(220))
    .min(2)
    .max(5)
    .describe("Rewritten CV bullet points for this role, strongest first."),
  explanation: z
    .string()
    .min(1)
    .max(300)
    .describe("One or two plain-English sentences explaining what changed and why it's stronger."),
});

export type CvRewriteBulletsOutput = z.infer<typeof cvRewriteBulletsSchema>;

export const cvRewriteBulletsPrompt: PromptDefinition<CvRewriteInput, CvRewriteBulletsOutput> = {
  id: "cv_rewrite_bullets",
  version: "1.1.0",
  operation: "cv_rewrite",
  schema: cvRewriteBulletsSchema,
  buildSystem: () =>
    [
      "You are a CV-writing assistant helping someone strengthen the bullet points under one role on their CV.",
      "Each bullet should lead with a strong action verb, describe what was actually done, and where the input " +
        "supports it, the outcome or impact.",
      UK_CONVENTIONS_INSTRUCTION,
      ANTI_FABRICATION_INSTRUCTION,
      "Do not write in the first person (no \"I\") — CV bullets are implied first person without the pronoun.",
    ].join(" "),
  buildPrompt: (input) =>
    [
      `Role: ${input.roleTitle}`,
      input.targetJobTitle ? `They are applying for: ${input.targetJobTitle}` : null,
      "",
      "What they told us about this role, in their own words:",
      input.rawDescription,
      "",
      "Rewrite this into strong CV bullet points, and briefly explain what you changed and why.",
    ]
      .filter((line): line is string => line !== null)
      .join("\n"),
};

export type CvRewriteSummaryInput = {
  currentSummary: string;
  headline?: string;
  targetJobTitle?: string;
};

export const cvRewriteSummarySchema = z.object({
  summary: z
    .string()
    .min(1)
    .max(600)
    .describe("Rewritten professional summary — one short paragraph, 2-4 sentences."),
  explanation: z
    .string()
    .min(1)
    .max(300)
    .describe("One or two plain-English sentences explaining what changed and why it's stronger."),
});

export type CvRewriteSummaryOutput = z.infer<typeof cvRewriteSummarySchema>;

export const cvRewriteSummaryPrompt: PromptDefinition<CvRewriteSummaryInput, CvRewriteSummaryOutput> = {
  id: "cv_rewrite_summary",
  version: "1.0.0",
  operation: "cv_rewrite_summary",
  schema: cvRewriteSummarySchema,
  buildSystem: () =>
    [
      "You are a CV-writing assistant helping someone strengthen the professional summary at the top of their CV.",
      "Keep it to one short paragraph of 2-4 sentences, written without \"I\" — CV summaries are implied first " +
        "person without the pronoun.",
      UK_CONVENTIONS_INSTRUCTION,
      ANTI_FABRICATION_INSTRUCTION,
    ].join(" "),
  buildPrompt: (input) =>
    [
      input.headline ? `Their current headline/job title: ${input.headline}` : null,
      input.targetJobTitle ? `They are applying for: ${input.targetJobTitle}` : null,
      "",
      "Their current summary:",
      input.currentSummary.trim().length > 0 ? input.currentSummary : "(nothing written yet)",
      "",
      "Rewrite this into a stronger professional summary, and briefly explain what you changed and why.",
    ]
      .filter((line): line is string => line !== null)
      .join("\n"),
};
