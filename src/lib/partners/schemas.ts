import { z } from "zod";

export const PARTNERSHIP_TYPES = [
  "University careers service",
  "Student society or ambassador programme",
  "Employer partner",
  "Bootcamp or accelerator",
  "Other",
] as const;

export const partnerInquirySchema = z.object({
  organisationName: z.string().trim().min(1, "Enter your organisation's name").max(200),
  contactName: z.string().trim().min(1, "Enter your name").max(200),
  email: z.email().trim().max(254),
  partnershipType: z.enum(PARTNERSHIP_TYPES, "Choose a partnership type"),
  message: z.string().trim().min(10, "Tell us a bit more — at least 10 characters").max(5000),
});
