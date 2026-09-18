import { z } from "zod";

export const quickScanFieldsSchema = z.object({
  email: z.string().trim().min(1, "Enter your email first.").email("Enter a real email address."),
  jobDescription: z.string().trim().min(30, "Paste the full job description first.").max(20000),
  // A hidden field real users never see or fill — a bot's autofill often
  // does. Any non-empty value here is treated as automated submission.
  website: z.string().max(200).optional(),
});
