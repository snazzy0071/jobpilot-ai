import { z } from "zod";
import { isAtLeastAge, MIN_SIGNUP_AGE } from "@/lib/date";
import {
  CAREER_STAGES,
  INDUSTRY_OPTIONS,
  PRIMARY_GOALS,
  VISA_SPONSORSHIP_PREFERENCES,
} from "@/lib/onboarding/schemas";

export const profileSchema = z.object({
  fullName: z.string().trim().min(1, "Full name is required").max(100),
  dateOfBirth: z
    .iso.date("Enter a valid date")
    .refine((value) => isAtLeastAge(value, MIN_SIGNUP_AGE), {
      message: `You must be at least ${MIN_SIGNUP_AGE} years old`,
    }),
});

export const careerPreferencesSchema = z.object({
  careerStage: z.enum(CAREER_STAGES, "Choose your career stage"),
  primaryGoal: z.enum(PRIMARY_GOALS, "Choose your main goal"),
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
  industries: z.array(z.enum(INDUSTRY_OPTIONS)).min(1, "Choose at least one industry").max(10),
  location: z.string().trim().min(1, "Enter your location").max(200),
  graduationYear: z.coerce
    .number("Enter a graduation year")
    .int()
    .min(1950, "Enter a valid year")
    .max(2100, "Enter a valid year"),
  visaSponsorshipPreference: z.enum(VISA_SPONSORSHIP_PREFERENCES, "Choose an option"),
});

export const updateEmailSchema = z.object({
  email: z.email().trim().max(254),
});

export const updateAccountPasswordSchema = z
  .object({
    password: z.string().min(8, "Password must be at least 8 characters").max(200),
    confirmPassword: z.string().min(1, "Confirm your new password"),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords don't match",
    path: ["confirmPassword"],
  });

export const notificationsSchema = z.object({
  newsletterOptIn: z.preprocess((value) => value === "on" || value === true, z.boolean()),
});

export const deleteAccountSchema = z.object({
  confirmation: z.string().refine((value) => value === "DELETE", 'Type "DELETE" to confirm'),
});
