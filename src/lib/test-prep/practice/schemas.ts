import { z } from "zod";

export const startSessionSchema = z.object({
  questionPackId: z.string().uuid(),
});

export const submitAnswerSchema = z.object({
  testSessionId: z.string().uuid(),
  questionId: z.string().uuid(),
  // Empty string means "skipped, then came back and still left it
  // blank" — normalized to null before it's stored, same as every
  // other optional-text-field transform in this app.
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
