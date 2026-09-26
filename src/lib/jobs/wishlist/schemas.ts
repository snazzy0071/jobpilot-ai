import { z } from "zod";

export const saveJobSchema = z.object({
  jobId: z.string().uuid(),
  // Which CV's match score (if any) to snapshot — optional, since a
  // job can be saved with no CV selected at all.
  cvId: z.string().uuid().optional(),
});

export const unsaveJobSchema = z.object({
  jobId: z.string().uuid(),
});

export const removeSavedJobSchema = z.object({
  savedJobId: z.string().uuid(),
});

export const updateSavedJobNotesSchema = z.object({
  savedJobId: z.string().uuid(),
  notes: z
    .string()
    .trim()
    .max(2000, "Keep notes to 2,000 characters or fewer.")
    .transform((value) => (value ? value : null)),
});
