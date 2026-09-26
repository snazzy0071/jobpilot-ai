import { z } from "zod";

export const CAREER_STAGES = [
  "student",
  "recent_graduate",
  "early_career",
  "career_switcher",
  "experienced_professional",
] as const;

export const CAREER_STAGE_LABELS: Record<(typeof CAREER_STAGES)[number], string> = {
  student: "Still studying",
  recent_graduate: "Recently graduated",
  early_career: "Early career (1–3 years)",
  career_switcher: "Switching careers",
  experienced_professional: "Experienced professional",
};

export const PRIMARY_GOALS = [
  "first_role",
  "career_change",
  "career_growth",
  "exploring",
  "other",
] as const;

export const PRIMARY_GOAL_LABELS: Record<(typeof PRIMARY_GOALS)[number], string> = {
  first_role: "Land my first role",
  career_change: "Change career direction",
  career_growth: "Grow in my current field",
  exploring: "Just exploring my options",
  other: "Something else",
};

export const INDUSTRY_OPTIONS = [
  "Technology",
  "Finance & Banking",
  "Consulting",
  "Engineering",
  "Law",
  "Healthcare",
  "Retail & Consumer",
  "Public Sector",
  "Marketing & Media",
  "Other",
] as const;

export const VISA_SPONSORSHIP_PREFERENCES = ["required", "not_required", "unsure"] as const;

export const VISA_SPONSORSHIP_LABELS: Record<(typeof VISA_SPONSORSHIP_PREFERENCES)[number], string> = {
  required: "I'll need visa sponsorship",
  not_required: "I already have the right to work",
  unsure: "Not sure yet",
};

export const aboutStepSchema = z.object({
  careerStage: z.enum(CAREER_STAGES, "Choose your career stage"),
  primaryGoal: z.enum(PRIMARY_GOALS, "Choose your main goal"),
});

export const targetsStepSchema = z.object({
  targetRoles: z
    .string()
    .trim()
    .max(500)
    .transform((value) =>
      value
        .split(",")
        .map((role) => role.trim())
        .filter(Boolean)
        .slice(0, 10),
    )
    .refine((roles) => roles.length > 0, "Enter at least one target role"),
  industries: z
    .array(z.enum(INDUSTRY_OPTIONS))
    .min(1, "Choose at least one industry")
    .max(10),
});

export const logisticsStepSchema = z.object({
  location: z.string().trim().min(1, "Enter your location").max(200),
  graduationYear: z.coerce
    .number("Enter a graduation year")
    .int()
    .min(1950, "Enter a valid year")
    .max(2100, "Enter a valid year"),
  visaSponsorshipPreference: z.enum(VISA_SPONSORSHIP_PREFERENCES, "Choose an option"),
});

/** An element id for an industry's checkbox. The labels contain spaces and "&" ("Finance & Banking"), which are not valid in an id and break the label association, leaving the checkbox with no accessible name. */
export function industryFieldId(industry: string): string {
  return `industry-${industry.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}`;
}
