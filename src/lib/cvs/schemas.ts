import { z } from "zod";
import { CV_TEMPLATE_SLUGS } from "@/config/cv-templates";
import { LANGUAGE_PROFICIENCIES, SECTION_KEYS } from "@/lib/cvs/types";

// Mirrors the check constraints in supabase/migrations/0024_cvs.sql and
// 0025_cvs_metadata.sql — validated here too so a bad request is
// rejected with a real message before it ever reaches Postgres, per
// CLAUDE.md's "validate all input server-side" rule.

const uuid = z.string().uuid();
const optionalUrl = (maxLength: number) =>
  z
    .string()
    .trim()
    .max(maxLength)
    .refine((value) => /^https?:\/\//i.test(value), "Must start with http:// or https://")
    .optional()
    .or(z.literal("").transform(() => undefined));
const optionalText = (maxLength: number) =>
  z
    .string()
    .trim()
    .max(maxLength)
    .optional()
    .or(z.literal("").transform(() => undefined));

export const createCvSchema = z.object({
  title: z.string().trim().min(1, "Give your CV a name.").max(200),
  template: z.enum(CV_TEMPLATE_SLUGS),
});

export const renameCvSchema = z.object({
  cvId: uuid,
  title: z.string().trim().min(1, "Give your CV a name.").max(200),
});

export const cvIdSchema = z.object({ cvId: uuid });

export const updateCvTemplateSchema = z.object({
  cvId: uuid,
  template: z.enum(CV_TEMPLATE_SLUGS),
});

export const personalSchema = z.object({
  versionId: uuid,
  fullName: z.string().trim().min(1, "Full name is required.").max(200),
  headline: optionalText(200),
  email: z
    .string()
    .trim()
    .max(320)
    .email("Enter a valid email address.")
    .optional()
    .or(z.literal("").transform(() => undefined)),
  phone: optionalText(40),
  location: optionalText(200),
  websiteUrl: optionalUrl(500),
  linkedinUrl: optionalUrl(500),
  portfolioUrl: optionalUrl(500),
});

export const summarySchema = z.object({
  versionId: uuid,
  content: z.string().trim().max(2000),
});

const dateOrUndefined = z
  .string()
  .trim()
  .optional()
  .or(z.literal("").transform(() => undefined));

export const experienceSchema = z
  .object({
    id: uuid.optional(),
    versionId: uuid,
    jobTitle: z.string().trim().min(1, "Job title is required.").max(200),
    employer: z.string().trim().min(1, "Employer is required.").max(200),
    location: optionalText(200),
    startDate: z.string().trim().min(1, "Start date is required."),
    endDate: dateOrUndefined,
    isCurrent: z.boolean().default(false),
    description: optionalText(4000),
  })
  .refine((data) => !data.isCurrent || !data.endDate, {
    message: "A current role can't have an end date.",
    path: ["endDate"],
  })
  .refine((data) => !data.endDate || data.endDate >= data.startDate, {
    message: "End date can't be before the start date.",
    path: ["endDate"],
  });

export const educationSchema = z
  .object({
    id: uuid.optional(),
    versionId: uuid,
    institution: z.string().trim().min(1, "Institution is required.").max(200),
    qualification: z.string().trim().min(1, "Qualification is required.").max(200),
    fieldOfStudy: optionalText(200),
    location: optionalText(200),
    startDate: dateOrUndefined,
    endDate: dateOrUndefined,
    isCurrent: z.boolean().default(false),
    grade: optionalText(100),
    description: optionalText(2000),
  })
  .refine((data) => !data.isCurrent || !data.endDate, {
    message: "A course in progress can't have an end date.",
    path: ["endDate"],
  })
  .refine((data) => !data.startDate || !data.endDate || data.endDate >= data.startDate, {
    message: "End date can't be before the start date.",
    path: ["endDate"],
  });

export const skillSchema = z.object({
  id: uuid.optional(),
  versionId: uuid,
  name: z.string().trim().min(1, "Skill name is required.").max(100),
  category: optionalText(100),
});

export const projectSchema = z
  .object({
    id: uuid.optional(),
    versionId: uuid,
    name: z.string().trim().min(1, "Project name is required.").max(200),
    description: optionalText(2000),
    url: optionalUrl(500),
    technologies: z
      .array(z.string().trim().min(1).max(60))
      .max(30, "Up to 30 technologies.")
      .default([]),
    startDate: dateOrUndefined,
    endDate: dateOrUndefined,
    isOngoing: z.boolean().default(false),
  })
  .refine((data) => !data.isOngoing || !data.endDate, {
    message: "An ongoing project can't have an end date.",
    path: ["endDate"],
  })
  .refine((data) => !data.startDate || !data.endDate || data.endDate >= data.startDate, {
    message: "End date can't be before the start date.",
    path: ["endDate"],
  });

export const certificationSchema = z
  .object({
    id: uuid.optional(),
    versionId: uuid,
    name: z.string().trim().min(1, "Certification name is required.").max(200),
    issuingOrganization: z.string().trim().min(1, "Issuing organization is required.").max(200),
    issueDate: dateOrUndefined,
    expiryDate: dateOrUndefined,
    credentialId: optionalText(200),
    credentialUrl: optionalUrl(500),
  })
  .refine((data) => !data.issueDate || !data.expiryDate || data.expiryDate >= data.issueDate, {
    message: "Expiry date can't be before the issue date.",
    path: ["expiryDate"],
  });

export const languageSchema = z.object({
  id: uuid.optional(),
  versionId: uuid,
  name: z.string().trim().min(1, "Language name is required.").max(100),
  proficiency: z.enum(LANGUAGE_PROFICIENCIES),
});

export const customSectionSchema = z.object({
  id: uuid.optional(),
  versionId: uuid,
  title: z.string().trim().min(1, "Give this section a title.").max(200),
  content: optionalText(4000),
});

export const sectionRowIdSchema = z.object({ id: uuid });

export const toggleVisibilitySchema = z.object({
  id: uuid,
  versionId: uuid,
  isVisible: z.enum(["true", "false"]).transform((value) => value === "true"),
});

// Drag-reorder posts the new order as a JSON-encoded array in a single
// hidden field — FormData has no native array-of-strings shape that
// survives a plain form submission cleanly, and this still gets fully
// validated (real array, real uuids/keys) before anything touches
// Postgres.
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

export const reorderRowsSchema = z.object({
  versionId: uuid,
  orderedIds: jsonArray(uuid).refine((ids) => ids.length > 0, "Nothing to reorder."),
});

export const reorderSectionsSchema = z.object({
  versionId: uuid,
  order: jsonArray(z.enum(SECTION_KEYS)).refine((order) => order.length === SECTION_KEYS.length, "Invalid section order."),
});

export const restoreVersionSchema = z.object({
  cvId: uuid,
  versionId: uuid,
});

// AI rewrite requests are plain objects (not FormData — there's nothing
// to submit, just a snapshot of the field's current, possibly-unsaved
// value) sent straight from a client component to the Server Action.
export const aiRewriteSummarySchema = z.object({
  versionId: uuid,
  currentSummary: z.string().trim().min(1, "Write a summary first.").max(2000),
  headline: optionalText(200),
});

export const aiRewriteExperienceSchema = z.object({
  versionId: uuid,
  jobTitle: z.string().trim().min(1, "Add a job title first.").max(200),
  currentDescription: z.string().trim().min(1, "Write a description first.").max(4000),
});

export const resolveAiRewriteSchema = z.object({
  rewriteId: uuid,
  status: z.enum(["accepted", "rejected"]),
});

export const rewriteSummaryForKeywordSchema = z.object({
  versionId: uuid,
  keyword: z.string().trim().min(1, "Missing a term to add.").max(60),
  currentSummary: z.string().trim().min(1, "Write a summary first.").max(2000),
});

export const rewriteExperienceForKeywordSchema = z.object({
  versionId: uuid,
  keyword: z.string().trim().min(1, "Missing a term to add.").max(60),
  experienceId: uuid,
  jobTitle: z.string().trim().min(1, "Add a job title first.").max(200),
  currentDescription: z.string().trim().min(1, "Write a description first.").max(4000),
});

// Mirrors CvAtsFormatIssue (src/lib/cvs/types.ts) — the client's own
// live computeFormatIssues() result, sent along so the persisted scan
// snapshot reflects exactly what was on screen at scan time, the same
// "what you see is what gets scanned" invariant cvText already follows.
const atsFormatIssueSchema = z.object({
  id: z.string().min(1).max(100),
  severity: z.enum(["warning", "info"]),
  message: z.string().min(1).max(400),
  sectionKey: z.enum(SECTION_KEYS),
});

export const runAtsScanSchema = z.object({
  versionId: uuid,
  jobDescription: z.string().trim().min(30, "Paste the full job description first.").max(20000),
  cvText: z.string().trim().min(1, "Add some CV content before scanning.").max(12000),
  formatIssues: z.array(atsFormatIssueSchema).max(50),
  /** The earlier scan this job description was reused from, if the user picked "use a previous job description" rather than pasting fresh. */
  reusedFromScanId: uuid.optional(),
});

export const fetchJobUrlSchema = z.object({
  url: z.string().trim().min(1, "Paste a link first.").max(2000),
});
