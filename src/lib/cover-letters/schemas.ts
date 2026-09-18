import { z } from "zod";
import { COVER_LETTER_TONES, COVER_LETTER_LENGTHS } from "@/lib/cover-letters/types";
import { COVER_LETTER_TEMPLATE_SLUGS } from "@/config/cover-letter-templates";

const uuid = z.string().uuid();

export const generateCoverLetterSchema = z.object({
  cvId: uuid,
  companyName: z.string().trim().min(1, "Enter the company name.").max(200),
  jobTitle: z.string().trim().min(1, "Enter the job title.").max(200),
  jobDescription: z.string().trim().min(30, "Paste the full job description first.").max(20000),
  tone: z.enum(COVER_LETTER_TONES),
  length: z.enum(COVER_LETTER_LENGTHS),
});

export const paragraphSchema = z.object({
  id: uuid.optional(),
  versionId: uuid,
  content: z.string().trim().min(1, "A paragraph can't be empty.").max(4000),
});

export const paragraphRowIdSchema = z.object({ id: uuid, versionId: uuid });

// Same "JSON-encoded array in one hidden field" shape as
// src/lib/cvs/schemas.ts's reorderRowsSchema — drag-reorder has no
// native FormData array representation that survives a plain submit.
const jsonArray = <T extends z.ZodTypeAny>(itemSchema: T) =>
  z
    .string()
    .transform((value, ctx) => {
      try {
        const parsed = JSON.parse(value);
        if (!Array.isArray(parsed)) throw new Error("not an array");
        return parsed;
      } catch {
        ctx.addIssue({ code: "custom", message: "Invalid order." });
        return z.NEVER;
      }
    })
    .pipe(z.array(itemSchema));

export const reorderParagraphsSchema = z.object({
  versionId: uuid,
  orderedIds: jsonArray(uuid).refine((ids) => ids.length > 0, "Nothing to reorder."),
});

export const saveVersionSettingsSchema = z.object({
  versionId: uuid,
  tone: z.enum(COVER_LETTER_TONES),
  length: z.enum(COVER_LETTER_LENGTHS),
});

export const restoreCoverLetterVersionSchema = z.object({
  coverLetterId: uuid,
  versionId: uuid,
});

export const updateCoverLetterTemplateSchema = z.object({
  coverLetterId: uuid,
  template: z.enum(COVER_LETTER_TEMPLATE_SLUGS),
});

// AI rewrite requests are plain objects, not FormData — a snapshot of
// the paragraph's current, possibly-unsaved value, same reasoning as
// src/lib/cvs/schemas.ts's aiRewriteSummarySchema.
export const regenerateParagraphSchema = z.object({
  versionId: uuid,
  paragraphId: uuid,
  paragraphContent: z.string().trim().min(1, "Write something in this paragraph first.").max(4000),
  paragraphIndex: z.number().int().min(1),
  totalParagraphs: z.number().int().min(1),
  otherParagraphs: z.string().max(20000),
});

export const resolveParagraphRewriteSchema = z.object({
  rewriteId: uuid,
  status: z.enum(["accepted", "rejected"]),
});
