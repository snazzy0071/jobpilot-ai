import { z } from "zod";
import { QUESTION_TYPES, QUESTION_DIFFICULTIES } from "@/lib/test-prep/types";

// Length limits mirror migration 0067/0069's check constraints exactly
// — validated here too so a bad request is rejected with a clear
// message before ever reaching the database, same reasoning
// src/lib/linkedin/schemas.ts gives for its own fields.

const testTypeInputFields = {
  slug: z.string().trim().min(1, "Enter a slug.").max(100),
  name: z.string().trim().min(1, "Enter a name.").max(200),
  description: z
    .string()
    .trim()
    .max(2000)
    .optional()
    .transform((value) => (value ? value : null)),
  isActive: z.coerce.boolean().default(true),
};

export const createTestTypeSchema = z.object(testTypeInputFields);
export const updateTestTypeSchema = z.object({ id: z.string().uuid(), ...testTypeInputFields });
export const deleteTestTypeSchema = z.object({ id: z.string().uuid() });

const questionPackInputFields = {
  testTypeId: z.string().uuid("Choose a test type."),
  slug: z.string().trim().min(1, "Enter a slug.").max(100),
  name: z.string().trim().min(1, "Enter a name.").max(200),
  description: z
    .string()
    .trim()
    .max(2000)
    .optional()
    .transform((value) => (value ? value : null)),
  sectorStyle: z
    .string()
    .trim()
    .max(100)
    .optional()
    .transform((value) => (value ? value : null)),
  timeLimitSeconds: z
    .string()
    .trim()
    .optional()
    .transform((value) => (value ? Number(value) : null))
    .refine((value) => value === null || (Number.isInteger(value) && value > 0), "Enter a whole number of seconds greater than 0."),
  isActive: z.coerce.boolean().default(true),
};

export const createQuestionPackSchema = z.object(questionPackInputFields);
export const updateQuestionPackSchema = z.object({ id: z.string().uuid(), ...questionPackInputFields });
export const deleteQuestionPackSchema = z.object({ id: z.string().uuid() });

const questionBaseFields = {
  questionPackId: z.string().uuid("Choose a question pack."),
  questionType: z.enum(QUESTION_TYPES, "Choose a question type."),
  prompt: z.string().trim().min(1, "Enter the question prompt.").max(4000),
  // Newline-separated in the form, one option per line — split into a
  // real array here, same "delimited text field in, real array
  // column out" shape src/lib/graduate-schemes/schemas.ts's own
  // `locations` field already uses.
  options: z
    .string()
    .trim()
    .max(4000)
    .optional()
    .transform((value) =>
      (value ?? "")
        .split("\n")
        .map((option) => option.trim())
        .filter(Boolean),
    ),
  correctAnswer: z
    .string()
    .trim()
    .max(500)
    .optional()
    .transform((value) => (value ? value : null)),
  explanation: z
    .string()
    .trim()
    .max(2000)
    .optional()
    .transform((value) => (value ? value : null)),
  difficulty: z
    .enum([...QUESTION_DIFFICULTIES, ""])
    .optional()
    .transform((value) => (value ? value : null)),
  subtype: z
    .string()
    .trim()
    .max(100)
    .optional()
    .transform((value) => (value ? value : null)),
  displayOrder: z.coerce.number().int().min(0).default(0),
  isActive: z.coerce.boolean().default(true),
};

// Mirrors migration 0067's own two check constraints exactly — a
// multiple_choice question needs at least two real options, and only
// free_text is allowed to have no correct_answer at all (an ungraded,
// reflective practice prompt). The third check goes beyond the DB
// constraint (which can't easily express it): for multiple_choice, the
// correct answer must actually match one of the given options.

export const createQuestionSchema = z
  .object(questionBaseFields)
  .refine((data) => data.questionType !== "multiple_choice" || data.options.length >= 2, {
    message: "Multiple choice questions need at least two options.",
    path: ["options"],
  })
  .refine((data) => data.questionType === "free_text" || !!data.correctAnswer, {
    message: "Enter the correct answer (only free-text questions can skip this).",
    path: ["correctAnswer"],
  })
  .refine((data) => data.questionType !== "multiple_choice" || !data.correctAnswer || data.options.includes(data.correctAnswer), {
    message: "The correct answer must exactly match one of the options.",
    path: ["correctAnswer"],
  });

export const updateQuestionSchema = z
  .object({ id: z.string().uuid(), ...questionBaseFields })
  .refine((data) => data.questionType !== "multiple_choice" || data.options.length >= 2, {
    message: "Multiple choice questions need at least two options.",
    path: ["options"],
  })
  .refine((data) => data.questionType === "free_text" || !!data.correctAnswer, {
    message: "Enter the correct answer (only free-text questions can skip this).",
    path: ["correctAnswer"],
  })
  .refine((data) => data.questionType !== "multiple_choice" || !data.correctAnswer || data.options.includes(data.correctAnswer), {
    message: "The correct answer must exactly match one of the options.",
    path: ["correctAnswer"],
  });

export const deleteQuestionSchema = z.object({ id: z.string().uuid() });
