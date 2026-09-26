import { z } from "zod";
import { QUESTION_TYPES, QUESTION_DIFFICULTIES } from "@/lib/test-prep/types";
import { exhibitSchema, optionFiguresSchema } from "@/lib/test-prep/exhibit";

// Length limits mirror migration 0067/0069/0106's check constraints exactly — validated here too so a bad request is
// rejected with a clear message before ever reaching the database.

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

/** A JSON text box: empty -> null; otherwise it must parse and then satisfy `schema`. Errors say which box and what is wrong. */
function jsonField<T>(label: string, schema: z.ZodType<T>) {
  return z
    .string()
    .trim()
    .max(20000, `${label} is too long.`)
    .optional()
    .transform((value, ctx): T | null => {
      if (!value) return null;
      let parsed: unknown;
      try {
        parsed = JSON.parse(value);
      } catch {
        ctx.addIssue({ code: "custom", message: `${label} isn't valid JSON.` });
        return z.NEVER;
      }
      const result = schema.safeParse(parsed);
      if (!result.success) {
        const issue = result.error.issues[0];
        ctx.addIssue({ code: "custom", message: `${label}: ${issue.path.join(".") || "value"} — ${issue.message}` });
        return z.NEVER;
      }
      return result.data;
    });
}

const questionBaseFields = {
  questionPackId: z.string().uuid("Choose a question pack."),
  questionType: z.enum(QUESTION_TYPES, "Choose a question type."),
  stimulus: z
    .string()
    .trim()
    .max(4000, "Keep the passage to 4,000 characters or fewer.")
    .optional()
    .transform((value) => (value ? value : null)),
  prompt: z.string().trim().min(1, "Enter the question prompt.").max(4000),
  // Newline-separated in the form, one option per line — split into a real array here.
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
  exhibit: jsonField("Exhibit", exhibitSchema),
  optionFigures: jsonField("Option figures", optionFiguresSchema),
  displayOrder: z.coerce.number().int().min(0).default(0),
  isActive: z.coerce.boolean().default(true),
};

type QuestionShape = {
  questionType: (typeof QUESTION_TYPES)[number];
  options: string[];
  correctAnswer: string | null;
  optionFigures: unknown[] | null;
};

/**
 * The rules a question must satisfy, mirroring migration 0067/0106's check constraints and going further where SQL can't:
 * a multiple-choice question needs two real options; only free-text may lack a correct answer; the correct answer must be
 * one of the options (the database enforces that too now); option figures must line up one-to-one with the options; and
 * options must all be different (two identical options make the answer ambiguous).
 */
export function questionRules(data: QuestionShape, ctx: z.RefinementCtx) {
  const choice = data.questionType !== "free_text";
  if (data.questionType === "multiple_choice" && data.options.length < 2) {
    ctx.addIssue({ code: "custom", message: "Multiple choice questions need at least two options.", path: ["options"] });
  }
  if (data.questionType === "true_false" && data.options.length !== 2) {
    ctx.addIssue({ code: "custom", message: "True / False questions need exactly two options.", path: ["options"] });
  }
  if (choice && !data.correctAnswer) {
    ctx.addIssue({ code: "custom", message: "Enter the correct answer (only free-text questions can skip this).", path: ["correctAnswer"] });
  }
  if (choice && data.correctAnswer && !data.options.includes(data.correctAnswer)) {
    ctx.addIssue({ code: "custom", message: "The correct answer must exactly match one of the options.", path: ["correctAnswer"] });
  }
  if (new Set(data.options).size !== data.options.length) {
    ctx.addIssue({ code: "custom", message: "Two options are identical — every option must be different.", path: ["options"] });
  }
  if (data.optionFigures && data.optionFigures.length !== data.options.length) {
    ctx.addIssue({
      code: "custom",
      message: `There are ${data.options.length} options but ${data.optionFigures.length} option figures — they must match one to one.`,
      path: ["optionFigures"],
    });
  }
}

export const createQuestionSchema = z.object(questionBaseFields).superRefine(questionRules);
export const updateQuestionSchema = z.object({ id: z.string().uuid(), ...questionBaseFields }).superRefine(questionRules);
export const deleteQuestionSchema = z.object({ id: z.string().uuid() });
export const setQuestionActiveSchema = z.object({ id: z.string().uuid(), isActive: z.boolean() });
export const duplicateQuestionSchema = z.object({ id: z.string().uuid() });

// ---- bulk import ----------------------------------------------------------------------------------------------------

const importedQuestionSchema = z
  .object({
    questionType: z.enum(QUESTION_TYPES).default("multiple_choice"),
    stimulus: z.string().trim().max(4000).nullish().transform((value) => value || null),
    prompt: z.string().trim().min(1, "prompt is required").max(4000),
    options: z.array(z.string().trim().min(1).max(500)).max(8).default([]),
    correctAnswer: z.string().trim().max(500).nullish().transform((value) => value || null),
    explanation: z.string().trim().max(2000).nullish().transform((value) => value || null),
    difficulty: z.enum(QUESTION_DIFFICULTIES).nullish().transform((value) => value ?? null),
    subtype: z.string().trim().max(100).nullish().transform((value) => value || null),
    exhibit: exhibitSchema.nullish().transform((value) => value ?? null),
    optionFigures: optionFiguresSchema.nullish().transform((value) => value ?? null),
    isActive: z.boolean().default(true),
  })
  .strict()
  .superRefine((data, ctx) => questionRules({ questionType: data.questionType, options: data.options, correctAnswer: data.correctAnswer, optionFigures: data.optionFigures }, ctx));

export const MAX_IMPORT_QUESTIONS = 200;

export const importQuestionsSchema = z.object({
  questionPackId: z.string().uuid("Choose a question pack."),
  json: z.string().trim().min(2, "Paste the questions as a JSON array.").max(1_000_000, "That's too large to import in one go."),
  dryRun: z.boolean().default(true),
});

export type ImportedQuestion = z.infer<typeof importedQuestionSchema>;

/** Validates a pasted JSON array of questions. Returns each row's own errors so a bad row is easy to find. */
export function parseImportedQuestions(json: string): { ok: true; questions: ImportedQuestion[] } | { ok: false; errors: string[] } {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    return { ok: false, errors: ["That isn't valid JSON."] };
  }
  if (!Array.isArray(parsed)) return { ok: false, errors: ["The JSON must be an array of questions: [ { ... }, { ... } ]."] };
  if (parsed.length === 0) return { ok: false, errors: ["The array is empty."] };
  if (parsed.length > MAX_IMPORT_QUESTIONS) return { ok: false, errors: [`Import at most ${MAX_IMPORT_QUESTIONS} questions at a time (this has ${parsed.length}).`] };

  const errors: string[] = [];
  const questions: ImportedQuestion[] = [];
  const seen = new Set<string>();
  parsed.forEach((item, index) => {
    const result = importedQuestionSchema.safeParse(item);
    if (!result.success) {
      for (const issue of result.error.issues) errors.push(`Question ${index + 1}${issue.path.length ? ` (${issue.path.join(".")})` : ""}: ${issue.message}`);
      return;
    }
    const key = JSON.stringify([result.data.stimulus, result.data.prompt, result.data.exhibit]);
    if (seen.has(key)) errors.push(`Question ${index + 1}: duplicates an earlier question in this import.`);
    seen.add(key);
    questions.push(result.data);
  });
  return errors.length > 0 ? { ok: false, errors: errors.slice(0, 30) } : { ok: true, questions };
}
