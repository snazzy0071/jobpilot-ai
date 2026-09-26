import { z } from "zod";

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((value) => (value ? value : null));

export const campusCrewApplicationSchema = z.object({
  name: z.string().trim().min(1, "Enter your name").max(200),
  email: z.email("Enter a valid email address").trim().max(254),
  university: z.string().trim().min(1, "Enter your university or college").max(200),
  course: optionalText(200),
  studyYear: optionalText(50),
  motivation: z.string().trim().min(10, "Tell us a bit more, at least 10 characters").max(3000, "Keep it under 3,000 characters"),
  reach: optionalText(1000),
});

export type CampusCrewApplicationInput = z.infer<typeof campusCrewApplicationSchema>;
