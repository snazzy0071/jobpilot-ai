import { z } from "zod";

export const contactMessageSchema = z.object({
  name: z.string().trim().min(1, "Enter your name").max(200),
  email: z.email().trim().max(254),
  subject: z.string().trim().min(1, "Enter a subject").max(200),
  message: z.string().trim().min(10, "Message must be at least 10 characters").max(5000),
});
