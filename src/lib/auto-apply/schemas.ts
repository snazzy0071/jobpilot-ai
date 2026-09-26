import { z } from "zod";
import { LIMITS } from "@/lib/auto-apply/types";

const list = (max: number, label: string) =>
  z
    .string()
    .optional()
    .transform((value) => [...new Set((value ?? "").split(/[,\n]/).map((item) => item.trim()).filter(Boolean))])
    .refine((items) => items.length <= max, `Use at most ${max} ${label}.`)
    .refine((items) => items.every((item) => item.length <= 60), `Each of your ${label} must be 60 characters or fewer.`);

const optionalId = z
  .string()
  .nullish()
  .transform((value) => (value && !value.startsWith("__") ? value : null))
  .refine((value) => value === null || z.string().uuid().safeParse(value).success, "Choose one of your own documents.");

export const settingsSchema = z.object({
  enabled: z.boolean(),
  minMatchScore: z.coerce.number().int().min(LIMITS.minScore, `The match threshold can't be lower than ${LIMITS.minScore}.`).max(LIMITS.maxScore),
  roleKeywords: list(LIMITS.maxKeywords, "role keywords"),
  locations: list(LIMITS.maxLocations, "locations"),
  minSalary: z
    .string()
    .optional()
    .transform((value) => (value ? Number(value.replace(/[£,\s]/g, "")) : null))
    .refine((value) => value === null || (Number.isInteger(value) && value > 0 && value < 10_000_000), "Enter the minimum salary as a whole number of pounds a year."),
  includeUnknownSalary: z.boolean(),
  sponsorOnly: z.boolean(),
  dailyLimit: z.coerce.number().int().min(1, "The daily limit must be at least 1.").max(LIMITS.maxDaily, `The daily limit can't be more than ${LIMITS.maxDaily}.`),
  cvId: optionalId,
  coverLetterId: optionalId,
  consent: z.boolean(),
});

export const pausedSchema = z.object({ paused: z.boolean() });
export const queueIdSchema = z.object({ id: z.string().uuid() });
export const approveSchema = z.object({ id: z.string().uuid(), cvId: optionalId.optional(), coverLetterId: optionalId.optional() });
export type SettingsInput = z.infer<typeof settingsSchema>;
