import { z } from "zod";

export const createAccessCodeSchema = z.object({
  code: z
    .string()
    .trim()
    .toUpperCase()
    .max(50)
    .optional()
    .transform((value) => (value ? value : null)),
  label: z.string().trim().min(1, "Label is required").max(200),
  maxRedemptions: z.preprocess(
    (value) => (value === "" || value === null || value === undefined ? undefined : value),
    z.coerce.number().int().positive().optional(),
  ),
  expiresAt: z
    .string()
    .trim()
    .optional()
    .transform((value) => (value ? new Date(value).toISOString() : null)),
  institutionId: z
    .string()
    .trim()
    .optional()
    .transform((value) => (value ? value : null))
    .refine((value) => value === null || z.string().uuid().safeParse(value).success, "Invalid institution"),
  grantedPlanId: z
    .string()
    .trim()
    .optional()
    .transform((value) => (value ? value : null))
    .refine((value) => value === null || z.string().uuid().safeParse(value).success, "Invalid plan"),
});

export const accessCodeIdSchema = z.object({ id: z.string().uuid() });
