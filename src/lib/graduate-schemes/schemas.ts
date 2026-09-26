import { z } from "zod";
import { todayInUk } from "@/lib/graduate-schemes/status";
import { RESERVED_SCHEME_SLUGS } from "@/lib/graduate-schemes/slug";
import {
  GRADUATE_SCHEME_SECTORS,
  GRADUATE_SCHEME_SPONSORSHIP_STATUSES,
  STUDY_STAGES,
} from "@/lib/graduate-schemes/types";

// Length limits mirror migrations 0056/0111's check constraints exactly — validated here too so a bad request is rejected
// with a clear message before ever reaching the database.

const emptyToNull = (value: string | undefined) => (value ? value : null);

const optionalText = (max: number, message: string) => z.string().trim().max(max, message).optional().transform(emptyToNull);

/** http(s) only: a `javascript:` or `data:` link must never reach an <a href>. */
const httpUrl = (message: string) =>
  z
    .string()
    .trim()
    .max(2000)
    .refine((value) => {
      try {
        const url = new URL(value);
        return url.protocol === "http:" || url.protocol === "https:";
      } catch {
        return false;
      }
    }, message);

const optionalDate = (message: string) =>
  z
    .string()
    .trim()
    .optional()
    .transform(emptyToNull)
    .refine((value) => value === null || z.iso.date().safeParse(value).success, message);

const optionalMoney = (message: string) =>
  z
    .string()
    .trim()
    .optional()
    .transform((value) => (value ? Number(value.replace(/[£,\s]/g, "")) : null))
    .refine((value) => value === null || (Number.isInteger(value) && value > 0 && value < 10_000_000), message);

const schemeInputFields = {
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .max(200)
    .optional()
    .transform(emptyToNull)
    .refine((value) => value === null || /^[a-z0-9]+(-[a-z0-9]+)*$/.test(value), "The URL slug can only use lower-case letters, numbers and single hyphens.")
    .refine((value) => value === null || !RESERVED_SCHEME_SLUGS.has(value), "That address is reserved. Choose a different URL slug."),
  employer: z.string().trim().min(1, "Enter the employer's name.").max(300),
  schemeName: z.string().trim().min(1, "Enter the scheme's name.").max(300),
  sector: z.enum(GRADUATE_SCHEME_SECTORS, "Choose a sector."),
  description: optionalText(4000, "Keep the description to 4,000 characters or fewer."),
  salary: optionalText(200, "Keep the salary field to 200 characters or fewer."),
  salaryMin: optionalMoney("Enter the minimum salary as a whole number of pounds."),
  salaryMax: optionalMoney("Enter the maximum salary as a whole number of pounds."),
  // A newline- or comma-separated list in the form, split into a real array here — the DB column is text[].
  locations: z
    .string()
    .trim()
    .max(2000)
    .optional()
    .transform((value) =>
      [...new Set((value ?? "").split(/[,\n]/).map((location) => location.trim()).filter(Boolean))],
    ),
  studyStages: z.array(z.enum(STUDY_STAGES, "Choose valid study stages.")).default([]),
  opensOn: optionalDate("Enter a valid opening date."),
  deadlineOn: optionalDate("Enter a valid deadline."),
  isRolling: z.coerce.boolean().default(false),
  sponsorshipStatus: z.enum(GRADUATE_SCHEME_SPONSORSHIP_STATUSES, "Choose a sponsorship status."),
  assessmentNotes: optionalText(2000, "Keep assessment notes to 2,000 characters or fewer."),
  applicationUrl: z
    .string()
    .trim()
    .optional()
    .transform(emptyToNull)
    .refine((value) => value === null || httpUrl("").safeParse(value).success, "Enter a valid application link starting with http:// or https://."),
  notes: optionalText(2000, "Keep notes to 2,000 characters or fewer."),
  // Required — every claim on these pages has to be sourced, never asserted from nothing (migration 0056's own comment).
  sourceUrl: httpUrl("Enter a valid source URL starting with http:// or https://."),
  sourceDate: z.iso.date("Enter a valid source date."),
  verifiedAt: z.iso.date("Enter a valid verification date."),
  isPublished: z.coerce.boolean().default(true),
};

type Checked = {
  verifiedAt: string;
  sourceDate: string;
  opensOn: string | null;
  deadlineOn: string | null;
  salaryMin: number | null;
  salaryMax: number | null;
};

/** Cross-field rules, mirroring migration 0056/0111's table checks — and refusing a verification date in the future, which would claim a check that hasn't happened. */
export function schemeRules(data: Checked, ctx: z.RefinementCtx, today: string = todayInUk()) {
  if (data.verifiedAt < data.sourceDate) {
    ctx.addIssue({ code: "custom", message: "The verification date can't be before the source date.", path: ["verifiedAt"] });
  }
  if (data.verifiedAt > today) {
    ctx.addIssue({ code: "custom", message: "The verification date can't be in the future.", path: ["verifiedAt"] });
  }
  if (data.opensOn && data.deadlineOn && data.deadlineOn < data.opensOn) {
    ctx.addIssue({ code: "custom", message: "The deadline can't be before the opening date.", path: ["deadlineOn"] });
  }
  if (data.salaryMin !== null && data.salaryMax !== null && data.salaryMax < data.salaryMin) {
    ctx.addIssue({ code: "custom", message: "The maximum salary can't be lower than the minimum.", path: ["salaryMax"] });
  }
}

export const createGraduateSchemeSchema = z.object(schemeInputFields).superRefine((data, ctx) => schemeRules(data, ctx));
export const updateGraduateSchemeSchema = z.object({ id: z.string().uuid(), ...schemeInputFields }).superRefine((data, ctx) => schemeRules(data, ctx));
export const deleteGraduateSchemeSchema = z.object({ id: z.string().uuid() });
export const setPublishedSchema = z.object({ id: z.string().uuid(), isPublished: z.boolean() });

// One row from an admin CSV import — same field set as the manual form, plus the raw row number so a report can point at
// exactly which line went wrong.
export const importGraduateSchemeRowSchema = z
  .object({ rowNumber: z.number(), ...schemeInputFields })
  .superRefine((data, ctx) => schemeRules(data, ctx));

export type ImportGraduateSchemeRow = z.infer<typeof importGraduateSchemeRowSchema>;
export type GraduateSchemeInput = z.infer<typeof createGraduateSchemeSchema>;

/** A dates-only correction or re-verification: the three dates, the rolling flag and the evidence they were checked against. */
export const updateSchemeDatesSchema = z
  .object({
    id: z.string().uuid(),
    opensOn: schemeInputFields.opensOn,
    deadlineOn: schemeInputFields.deadlineOn,
    isRolling: z.boolean(),
    sourceUrl: schemeInputFields.sourceUrl,
    sourceDate: schemeInputFields.sourceDate,
    verifiedAt: schemeInputFields.verifiedAt,
  })
  .superRefine((data, ctx) => schemeRules({ ...data, salaryMin: null, salaryMax: null }, ctx));

export const verifySchemeSchema = z.object({ id: z.string().uuid() });
