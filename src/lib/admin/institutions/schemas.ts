import { z } from "zod";
import { endOfDayUtc } from "@/lib/institutions/licence";

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
    .refine((value) => !value || /^d{4}-d{2}-d{2}$/.test(value), "Enter the expiry as a date")
    .transform((value) => (value ? endOfDayUtc(value) : null))
    .refine((value) => value === null || new Date(value) > new Date(), "The expiry date must be in the future"),
});

export const updateLicenceSchema = z.object({
  licenceId: z.string().uuid(),
  seatCount: z.coerce.number().int().positive("Seat count must be at least 1").max(1_000_000),
  expiresAt: createLicenceSchema.shape.expiresAt,
});

export const domainVerificationSchema = z.object({
  domainId: z.string().uuid(),
  verified: z.enum(["true", "false"]).transform((value) => value === "true"),
});

export const licenceIdSchema = z.object({ licenceId: z.string().uuid() });

export const addInstitutionAdminSchema = z.object({
  institutionId: z.string().uuid(),
  email: z.string().trim().toLowerCase().email("Enter a valid email"),
});
