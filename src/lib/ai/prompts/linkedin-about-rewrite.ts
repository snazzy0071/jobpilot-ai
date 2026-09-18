import { z } from "zod";
import type { PromptDefinition } from "@/lib/ai/prompts/types";
import { ANTI_FABRICATION_INSTRUCTION, UK_CONVENTIONS_INSTRUCTION } from "@/lib/ai/prompts/shared";
import { LINKEDIN_TARGET_SENIORITY_LABELS, type LinkedinTargetSeniority } from "@/lib/linkedin/types";

export type LinkedinAboutRewriteInput = {
  currentAbout: string;
  targetRole: string;
  targetSeniority: LinkedinTargetSeniority;
};

export const linkedinAboutRewriteSchema = z.object({
  about: z.string().min(1).max(2600).describe("The rewritten About section only, as plain text — LinkedIn's own limit is 2,600 characters."),
  explanation: z.string().min(1).max(300).describe("One or two plain-English sentences explaining what changed and why it's stronger."),
});

export type LinkedinAboutRewriteOutput = z.infer<typeof linkedinAboutRewriteSchema>;

/**
 * Regenerates just the About section of an existing LinkedIn draft — the
 * "Regenerate" half of that section's Accept/Reject review flow
 * (src/lib/linkedin/rewrite-actions.ts), narrower in scope than
 * linkedinOptimizerPrompt's whole-draft generation, same "one field at a
 * time" shape as coverLetterParagraphRewritePrompt.
 */
export const linkedinAboutRewritePrompt: PromptDefinition<LinkedinAboutRewriteInput, LinkedinAboutRewriteOutput> = {
  id: "linkedin_about_rewrite",
  version: "1.0.0",
  operation: "linkedin_about_rewrite",
  schema: linkedinAboutRewriteSchema,
  buildSystem: () =>
    [
      "You are a LinkedIn profile optimisation assistant. Rewrite only the About section of an existing draft — " +
        "not the headline, not the Experience section — grounded only in the About text given, in a natural " +
        "first-person voice (LinkedIn About sections are first person, unlike CV bullets).",
      "Respect LinkedIn's real character limit: About is 2,600 characters.",
      "Write a genuinely different rewrite from the one being replaced, not a trivial rephrasing.",
      UK_CONVENTIONS_INSTRUCTION,
      ANTI_FABRICATION_INSTRUCTION,
    ].join(" "),
  buildPrompt: (input) =>
    [
      `Target role: ${input.targetRole}`,
      `Target seniority: ${LINKEDIN_TARGET_SENIORITY_LABELS[input.targetSeniority]}`,
      "",
      "The About section to rewrite:",
      input.currentAbout,
      "",
      "Rewrite this About section, and briefly explain what you changed and why.",
    ].join("\n"),
};
