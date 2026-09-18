import { z } from "zod";
import { INTERVIEW_MODES, INTERVIEW_DIFFICULTIES, INTERVIEW_COMPETENCIES } from "@/lib/interviews/types";

const uuid = z.string().uuid();

// Same "JSON-encoded array in one hidden field" shape as
// src/lib/cvs/schemas.ts's reorderRowsSchema — a plain FormData field
// has no native array-of-strings representation.
const jsonArray = <T extends z.ZodTypeAny>(itemSchema: T) =>
  z
    .string()
    .transform((value, ctx) => {
      try {
        const parsed = JSON.parse(value);
        if (!Array.isArray(parsed)) throw new Error("not an array");
        return parsed;
      } catch {
        ctx.addIssue({ code: "custom", message: "Invalid focus competencies." });
        return z.NEVER;
      }
    })
    .pipe(z.array(itemSchema));

// "Interview type" in the setup form is the practice mode — chat or
// voice — matching migration 0040's interview_mode enum and the
// chat_interviews_per_month/voice_interviews_per_month entitlements
// this flow gates on; company and role are required, the job
// description is deliberately optional (grounding is nice-to-have, not
// mandatory — a candidate may just want generic competency practice for
// a role), CV selection is required (there is always a real CV to
// ground questions against). `focusCompetencies`/`practicedFromSessionId`
// are both optional — set only by the results page's "Practice weak
// areas" flow (migration 0044); an ordinary new session has neither.
export const createInterviewSessionSchema = z.object({
  cvId: uuid,
  company: z.string().trim().min(1, "Enter the company name.").max(200),
  role: z.string().trim().min(1, "Enter the role.").max(200),
  jobDescription: z.string().trim().max(20000).optional(),
  mode: z.enum(INTERVIEW_MODES),
  difficulty: z.enum(INTERVIEW_DIFFICULTIES),
  focusCompetencies: jsonArray(z.enum(INTERVIEW_COMPETENCIES))
    .refine((competencies) => competencies.length <= 10, "Too many focus competencies.")
    .optional(),
  practicedFromSessionId: uuid.optional(),
});

export const startInterviewSchema = z.object({ sessionId: uuid });

export const submitInterviewAnswerSchema = z.object({
  sessionId: uuid,
  answerText: z.string().trim().min(1, "Write an answer first.").max(4000),
  // How long the candidate spoke for this reply — only ever set by the
  // voice-mode flow (the browser measures its own recording), summed
  // across follow-up replies to the same question onto
  // interview_answers.duration_seconds (src/lib/interviews/internal.ts's
  // appendAnswer). Absent entirely for chat-mode answers.
  durationSeconds: z.number().int().min(0).max(3600).optional(),
});
