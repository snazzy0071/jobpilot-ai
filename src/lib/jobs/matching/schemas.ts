import { z } from "zod";

export const runJobMatchSchema = z.object({
  jobId: z.string().uuid(),
  cvId: z.string().uuid(),
});
