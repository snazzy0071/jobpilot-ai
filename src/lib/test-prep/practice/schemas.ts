import { z } from "zod";

export const startSessionSchema = z.object({
  questionPackId: z.string().uuid(),
  mode: z.enum(["practice", "timed"]).default("practice"),
});

export const startFocusedSessionSchema = z.object({
  testTypeId: z.string().uuid(),
  // "General" is how the app labels questions with no subtype.
  subtype: z.string().trim().min(1).max(100),
});

export const submitAnswerSchema = z.object({
  testSessionId: z.string().uuid(),
  questionId: z.string().uuid(),
  // Empty string means "skipped, then came back and still left it blank" — normalized to null before it's stored.
  selectedAnswer: z
    .string()
    .trim()
    .max(500)
    .optional()
    .transform((value) => (value ? value : null)),
});

export const completeSessionSchema = z.object({
  testSessionId: z.string().uuid(),
});

export const reviewSessionSchema = z.object({
  testSessionId: z.string().uuid(),
});
