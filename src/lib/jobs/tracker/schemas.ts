import { z } from "zod";

// Either a live job from the feed, or a saved job (which may outlive its listing) — exactly one.
export const addJobToTrackerSchema = z
  .object({
    jobId: z.string().uuid().optional(),
    savedJobId: z.string().uuid().optional(),
    // Which CV the application will use — optional; re-verified as the requesting user's own before it is stored.
    cvId: z.string().uuid().optional(),
  })
  .refine((value) => (value.jobId ? 1 : 0) + (value.savedJobId ? 1 : 0) === 1, "Choose one job.");
