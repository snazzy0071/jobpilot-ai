import { z } from "zod";
import type { PromptDefinition } from "@/lib/ai/prompts/types";
import { ANTI_FABRICATION_INSTRUCTION, UK_CONVENTIONS_INSTRUCTION } from "@/lib/ai/prompts/shared";
import { LINKEDIN_TARGET_SENIORITY_LABELS, type LinkedinTargetSeniority } from "@/lib/linkedin/types";

export type LinkedinExperienceBulletRewriteInput = {
  bulletContent: string;
  otherBullets: string;
  targetRole: string;
  targetSeniority: LinkedinTargetSeniority;
};

export const linkedinExperienceBulletRewriteSchema = z.object({
  bullet: z
    .string()
    .min(1)
    .max(300)
    .describe("The rewritten bullet only, as plain text — not the whole Experience section, and not wrapped in quotes."),
  explanation: z.string().min(1).max(300).describe("One or two plain-English sentences explaining what changed and why it's stronger."),
});

export type LinkedinExperienceBulletRewriteOutput = z.infer<typeof linkedinExperienceBulletRewriteSchema>;

/**
 * Regenerates exactly one Experience bullet of an existing LinkedIn
 * draft — the per-bullet "Regenerate" action in that section's
 * Accept/Reject review flow (src/lib/linkedin/rewrite-actions.ts), same
 * narrow "one item at a time, with the rest as context" shape as
 * coverLetterParagraphRewritePrompt.
 */
export const linkedinExperienceBulletRewritePrompt: PromptDefinition<
  LinkedinExperienceBulletRewriteInput,
  LinkedinExperienceBulletRewriteOutput
> = {
  id: "linkedin_experience_bullet_rewrite",
  version: "1.0.0",
  operation: "linkedin_experience_bullet_rewrite",
  schema: linkedinExperienceBulletRewriteSchema,
  buildSystem: () =>
    [
      "You are a LinkedIn profile optimisation assistant. Rewrite exactly one Experience bullet of an existing " +
        "draft, grounded only in that bullet's own content — do not invent a role, employer, or achievement not " +
        "already present in it — in a natural first-person voice (LinkedIn Experience bullets are first person, " +
        "unlike CV bullets).",
      "Given the other bullets already on this profile as context, make sure the rewrite doesn't just repeat what " +
        "they already say.",
      "Write a genuinely different rewrite from the one being replaced, not a trivial rephrasing.",
      UK_CONVENTIONS_INSTRUCTION,
      ANTI_FABRICATION_INSTRUCTION,
    ].join(" "),
  buildPrompt: (input) =>
    [
      `Target role: ${input.targetRole}`,
      `Target seniority: ${LINKEDIN_TARGET_SENIORITY_LABELS[input.targetSeniority]}`,
      "",
      "The other bullets already on this profile, for context (do not rewrite these, only reference them):",
      input.otherBullets || "(this is the only bullet)",
      "",
      "The bullet to rewrite:",
      input.bulletContent,
      "",
      "Rewrite this bullet, and briefly explain what you changed and why.",
    ].join("\n"),
};
