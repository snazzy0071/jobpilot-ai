import { z } from "zod";
import { APPLICATION_STATUSES } from "@/lib/applications/types";

// Length limits mirror migration 0063/0064's check constraints exactly
// — validated here too so a bad request is rejected with a clear
// message before ever reaching the database, same reasoning
// src/lib/linkedin/schemas.ts gives for its own fields.
const applicationInputFields = {
  companyName: z.string().trim().min(1, "Enter the company name.").max(300),
  jobTitle: z.string().trim().min(1, "Enter the role.").max(300),
  location: z
    .string()
    .trim()
    .max(200)
    .optional()
    .transform((value) => (value ? value : null)),
  salary: z
    .string()
    .trim()
    .max(200, "Keep the salary field to 200 characters or fewer.")
    .optional()
    .transform((value) => (value ? value : null)),
  url: z
    .string()
    .trim()
    .max(2000)
    .optional()
    .transform((value) => (value ? value : null))
    .refine((value) => value === null || z.url({ protocol: /^https?$/ }).safeParse(value).success, "Enter a valid URL starting with http:// or https://."),
  deadline: z
    .string()
    .trim()
    .optional()
    .transform((value) => (value ? value : null))
    .refine((value) => value === null || z.iso.date().safeParse(value).success, "Enter a valid deadline date."),
  notes: z
    .string()
    .trim()
    .max(4000, "Keep notes to 4,000 characters or fewer.")
    .optional()
    .transform((value) => (value ? value : null)),
  status: z.enum(APPLICATION_STATUSES, "Choose a status."),
  cvId: z
    .string()
    .uuid()
    .optional()
    .transform((value) => (value ? value : null)),
  coverLetterId: z
    .string()
    .uuid()
    .optional()
    .transform((value) => (value ? value : null)),
};

export const createApplicationSchema = z.object(applicationInputFields);

export const updateApplicationSchema = z.object({
  id: z.string().uuid(),
  ...applicationInputFields,
});

export const deleteApplicationSchema = z.object({ id: z.string().uuid() });

// A focused schema for the kanban board's own drag/drop move — just id
// + the new status, never the full applicationInputFields set, so
// moving a card between columns can never accidentally touch any of
// its other fields.
export const updateApplicationStatusSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(APPLICATION_STATUSES, "Choose a status."),
});
