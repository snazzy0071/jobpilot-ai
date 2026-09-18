import { z } from "zod";

export const createInstitutionSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(200),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .min(1, "Slug is required")
    .max(100)
    .regex(/^[a-z0-9-]+$/, "Use lowercase letters, numbers, and hyphens only"),
});

export const createLicenceSchema = z.object({
  institutionId: z.string().uuid(),
  planId: z.string().uuid(),
  seatCount: z.coerce.number().int().positive("Seat count must be at least 1"),
  expiresAt: z
    .string()
    .trim()
    .optional()
    .transform((value) => (value ? new Date(value).toISOString() : null)),
});

export const licenceIdSchema = z.object({ licenceId: z.string().uuid() });

export const addInstitutionAdminSchema = z.object({
  institutionId: z.string().uuid(),
  email: z.string().trim().toLowerCase().email("Enter a valid email"),
});
