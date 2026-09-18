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
