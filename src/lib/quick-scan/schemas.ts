import { z } from "zod";

export const quickScanFieldsSchema = z.object({
  email: z.string().trim().min(1, "Enter your email first.").email("Enter a real email address."),
  // Optional: a caller who just wants a general CV/ATS-readiness check, with no specific role in mind yet, can
  // leave this blank. If they do type something, it still has to be a real job description, not a stray word or
  // two — the same 30-character floor the authenticated scanner uses, just not mandatory here.
  jobDescription: z
    .string()
    .trim()
    .max(20000)
    .nullish()
    .transform((value) => (value ? value : undefined))
    .refine((value) => value === undefined || value.length >= 30, "Paste the full job description, or leave it blank to skip it."),
  // A hidden field real users never see or fill — a bot's autofill often
  // does. Any non-empty value here is treated as automated submission.
  website: z.string().max(200).optional(),
});
