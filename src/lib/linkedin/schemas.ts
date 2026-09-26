import { z } from "zod";
import { LINKEDIN_TARGET_SENIORITIES } from "@/lib/linkedin/types";

// Length limits mirror migration 0046's check constraints exactly —
// validated here too so a bad request is rejected with a clear message
// before ever reaching the database (and before spending an AI call).
const draftInputFields = {
  title: z.string().trim().min(1, "Give this draft a name.").max(200),
  targetRole: z.string().trim().min(1, "Enter a target role.").max(200),
  targetSeniority: z.enum(LINKEDIN_TARGET_SENIORITIES, "Choose a target seniority."),
  currentHeadline: z
    .string()
    .trim()
    .max(220, "LinkedIn headlines are at most 220 characters.")
    .optional()
    .transform((value) => value ?? ""),
  currentAbout: z
    .string()
    .trim()
    .max(2600, "LinkedIn About sections are at most 2,600 characters.")
    .optional()
    .transform((value) => value ?? ""),
  currentExperience: z
    .string()
    .trim()
    .min(1, "Paste your current Experience section first.")
    .max(8000, "That's too long — trim it to 8,000 characters or fewer."),
};

export const createLinkedinDraftSchema = z.object(draftInputFields);

export const regenerateLinkedinDraftSchema = z.object({
  draftId: z.string().uuid(),
  ...draftInputFields,
});

export const deleteLinkedinDraftSchema = z.object({
  draftId: z.string().uuid(),
});

// AI rewrite requests are plain objects, not FormData — a snapshot of
// the field's current, possibly-just-accepted value, same reasoning as
// src/lib/cover-letters/schemas.ts's regenerateParagraphSchema.
export const regenerateLinkedinAboutSchema = z.object({
  draftId: z.string().uuid(),
  currentAbout: z.string().trim().min(1, "There's no About text to rewrite yet.").max(2600),
});

export const resolveLinkedinAboutRewriteSchema = z.object({
  rewriteId: z.string().uuid(),
  status: z.enum(["accepted", "rejected"]),
});

export const regenerateLinkedinExperienceBulletSchema = z.object({
  bulletId: z.string().uuid(),
  currentContent: z.string().trim().min(1, "There's no bullet text to rewrite yet.").max(300),
  otherBullets: z.string().max(4000),
});

export const resolveLinkedinExperienceBulletRewriteSchema = z.object({
  rewriteId: z.string().uuid(),
  status: z.enum(["accepted", "rejected"]),
});

// Manual edits of the optimised text — autosaved, so plain FormData like the CV/cover-letter autosave forms.
export const saveLinkedinAboutSchema = z.object({
  draftId: z.string().uuid(),
  about: z.string().trim().min(1, "The About section can't be empty.").max(2600, "LinkedIn About sections are at most 2,600 characters."),
});

export const saveLinkedinBulletSchema = z.object({
  bulletId: z.string().uuid(),
  content: z.string().trim().min(1, "A bullet can't be empty.").max(300, "Keep each bullet to 300 characters or fewer."),
});

export const saveLinkedinHeadlineSchema = z.object({
  draftId: z.string().uuid(),
  // Empty clears the choice.
  headline: z.string().trim().max(220, "LinkedIn headlines are at most 220 characters."),
});

export const restoreLinkedinDraftVersionSchema = z.object({
  draftId: z.string().uuid(),
  versionId: z.string().uuid(),
});
