import { z } from "zod";

export const demoRequestSchema = z.object({
  institutionName: z.string().trim().min(1, "Enter your institution's name").max(200),
  contactName: z.string().trim().min(1, "Enter your name").max(200),
  email: z.email().trim().max(254),
  role: z.string().trim().max(200).optional(),
  studentPopulation: z.string().trim().max(100).optional(),
  message: z.string().trim().max(5000).optional(),
});
