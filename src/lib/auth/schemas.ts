import { z } from "zod";
import { isAtLeastAge, MIN_SIGNUP_AGE } from "@/lib/date";

export const signInSchema = z.object({
  email: z.email().trim().max(254),
  password: z.string().min(1, "Password is required").max(200),
  redirectTo: z.string().optional(),
});

export const signUpSchema = z
  .object({
    mode: z.enum(["subscribe", "access_code"]),
    accessCode: z.string().trim().max(100).optional(),
    fullName: z.string().trim().min(1, "Full name is required").max(100),
    email: z.email().trim().max(254),
    password: z.string().min(8, "Password must be at least 8 characters").max(200),
    dateOfBirth: z
      .iso.date("Enter a valid date")
      .refine((value) => isAtLeastAge(value, MIN_SIGNUP_AGE), {
        message: `You must be at least ${MIN_SIGNUP_AGE} to sign up`,
      }),
    newsletterOptIn: z.preprocess((value) => value === "on" || value === true, z.boolean()),
  })
  .refine((data) => data.mode !== "access_code" || !!data.accessCode?.length, {
    message: "Enter your access code",
    path: ["accessCode"],
  });

export const requestPasswordResetSchema = z.object({
  email: z.email().trim().max(254),
});

export const updatePasswordSchema = z
  .object({
    password: z.string().min(8, "Password must be at least 8 characters").max(200),
    confirmPassword: z.string().min(1, "Confirm your new password"),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords don't match",
    path: ["confirmPassword"],
  });

export const resendSignupConfirmationSchema = z.object({
  email: z.email().trim().max(254),
});
