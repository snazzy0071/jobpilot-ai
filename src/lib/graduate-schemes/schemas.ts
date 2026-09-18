import { z } from "zod";
import { GRADUATE_SCHEME_SECTORS, GRADUATE_SCHEME_SPONSORSHIP_STATUSES } from "@/lib/graduate-schemes/types";

// Length limits mirror migration 0056's check constraints exactly —
// validated here too so a bad request is rejected with a clear message
// before ever reaching the database, same reasoning as
// src/lib/linkedin/schemas.ts.
const schemeInputFields = {
  employer: z.string().trim().min(1, "Enter the employer's name.").max(300),
  schemeName: z.string().trim().min(1, "Enter the scheme's name.").max(300),
  sector: z.enum(GRADUATE_SCHEME_SECTORS, "Choose a sector."),
  salary: z
    .string()
    .trim()
    .max(200, "Keep the salary field to 200 characters or fewer.")
    .optional()
    .transform((value) => (value ? value : null)),
  // A newline- or comma-separated list in the form, split into a real
  // array here — the DB column is text[], not a delimited string.
  locations: z
    .string()
    .trim()
    .max(2000)
    .optional()
    .transform((value) =>
      (value ?? "")
        .split(/[,\n]/)
        .map((location) => location.trim())
        .filter(Boolean),
    ),
  sponsorshipStatus: z.enum(GRADUATE_SCHEME_SPONSORSHIP_STATUSES, "Choose a sponsorship status."),
  notes: z
    .string()
    .trim()
    .max(2000, "Keep notes to 2,000 characters or fewer.")
    .optional()
    .transform((value) => (value ? value : null)),
  // Required — every sponsorship claim on this page has to be sourced,
  // never asserted from nothing (this table's own 0056 doc comment).
  sourceUrl: z.url("Enter a valid source URL.").max(2000),
  sourceDate: z.iso.date("Enter a valid source date."),
  verifiedAt: z.iso.date("Enter a valid verification date."),
};

export const createGraduateSchemeSchema = z
  .object(schemeInputFields)
  .refine((data) => data.verifiedAt >= data.sourceDate, {
    message: "The verification date can't be before the source date.",
    path: ["verifiedAt"],
  });

export const updateGraduateSchemeSchema = z
  .object({ id: z.string().uuid(), ...schemeInputFields })
  .refine((data) => data.verifiedAt >= data.sourceDate, {
    message: "The verification date can't be before the source date.",
    path: ["verifiedAt"],
  });

export const deleteGraduateSchemeSchema = z.object({ id: z.string().uuid() });

// One row from an admin CSV import — same field set as the manual form,
// plus the raw row number so a partial-failure report can point at
// exactly which line went wrong.
export const importGraduateSchemeRowSchema = z
  .object({ rowNumber: z.number(), ...schemeInputFields })
  .refine((data) => data.verifiedAt >= data.sourceDate, {
    message: "The verification date can't be before the source date.",
    path: ["verifiedAt"],
  });

export type ImportGraduateSchemeRow = z.infer<typeof importGraduateSchemeRowSchema>;
