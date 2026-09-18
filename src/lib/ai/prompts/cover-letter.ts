import type { PromptDefinition } from "@/lib/ai/prompts/types";
import { ANTI_FABRICATION_INSTRUCTION, UK_CONVENTIONS_INSTRUCTION } from "@/lib/ai/prompts/shared";

export type CoverLetterInput = {
  cvText: string;
  jobDescription: string;
  companyName: string;
  jobTitle: string;
  tone?: "formal" | "conversational";
  length?: "concise" | "standard" | "detailed";
};

const LENGTH_GUIDANCE: Record<NonNullable<CoverLetterInput["length"]>, string> = {
  concise: "Keep it concise — roughly 150-200 words across two or three short paragraphs.",
  standard: "Aim for a standard length — roughly 250-350 words.",
  detailed: "Write a fuller letter — roughly 400-500 words, with room for two or three concrete examples.",
};

/**
 * Deliberately plain-prose output — no schema. A cover letter is body
 * text a person will read and likely edit further; forcing it through a
 * structured tool call buys nothing here and risks the model optimising
 * for the schema's shape (e.g. padding fields to satisfy a min length)
 * instead of writing a genuinely good letter, the way the structured
 * prompts below do usefully.
 */
export const coverLetterPrompt: PromptDefinition<CoverLetterInput, string> = {
  id: "cover_letter_draft",
  version: "1.1.0",
  operation: "cover_letter_draft",
  buildSystem: (input) =>
    [
      "You are a cover letter writing assistant. Draft a complete, ready-to-edit cover letter for one specific job " +
        "application, grounded only in the candidate's real CV content and the job description provided.",
      `Write in a ${input.tone ?? "formal"} tone.`,
      LENGTH_GUIDANCE[input.length ?? "standard"],
      "Structure: a brief opening naming the role and company, two or three body paragraphs connecting real CV " +
        "experience to the job's actual requirements, and a short closing. No placeholder brackets like [Company " +
        "Name] — use the real names given.",
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
      "Write the cover letter.",
    ].join("\n"),
};
