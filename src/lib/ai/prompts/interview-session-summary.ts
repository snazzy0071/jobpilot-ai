import { z } from "zod";
import type { PromptDefinition } from "@/lib/ai/prompts/types";
import { ANTI_FABRICATION_INSTRUCTION, UK_CONVENTIONS_INSTRUCTION } from "@/lib/ai/prompts/shared";
import type { InterviewCompetency } from "@/lib/interviews/types";

export type InterviewSessionSummaryInput = {
  role: string;
  company: string;
  answers: {
    question: string;
    competency: InterviewCompetency;
    overallScore: number;
    strengths: string[];
    improvements: string[];
  }[];
};

export const interviewSessionSummarySchema = z.object({
  overallScore: z
    .number()
    .int()
    .min(0)
    .max(100)
    .describe("Your own holistic read of the whole interview performance — not an average of the per-answer scores given to you."),
  strengths: z
    .array(z.string().min(1).max(240))
    .min(1)
    .max(5)
    .describe("Session-wide strengths — real patterns across multiple answers, not one answer's detail repeated."),
  weaknesses: z
    .array(z.string().min(1).max(240))
    .min(1)
    .max(5)
    .describe("Session-wide weaknesses — real patterns worth addressing, grounded in what actually happened across the answers."),
  recommendedPractice: z
    .array(z.string().min(1).max(240))
    .min(2)
    .max(5)
    .describe(
      "Specific, actionable things to practise next — reference the actual competencies or answer patterns that " +
        "need work, not generic interview advice.",
    ),
});

export type InterviewSessionSummaryOutput = z.infer<typeof interviewSessionSummarySchema>;

/**
 * Synthesizes a whole completed interview into session-level results —
 * fired once, right when a session concludes
 * (src/lib/interviews/chat-actions.ts), from the real per-answer scores
 * and feedback already produced by interviewAnswerScorePrompt, not a
 * fresh read of the raw transcript. This is a genuine synthesis step
 * (spotting patterns across multiple answers), not a concatenation of
 * each answer's own strengths/improvements.
 */
export const interviewSessionSummaryPrompt: PromptDefinition<InterviewSessionSummaryInput, InterviewSessionSummaryOutput> = {
  id: "interview_session_summary",
  version: "1.0.0",
  operation: "interview_session_summary",
  schema: interviewSessionSummarySchema,
  buildSystem: () =>
    [
      "You are an interview coach writing the closing report for a completed UK-style competency-based mock " +
        "interview. You're given every question asked, its competency, the score it already received, and the " +
        "specific strengths/improvements already noted for it — synthesise these into session-level findings: real " +
        "patterns across multiple answers, not a repeat of any single answer's detail.",
      "Base every strength, weakness, and recommendation only on the answers and scores actually given to you — " +
        "never assume anything about the candidate beyond what's there.",
      "Recommended practice must be specific and actionable — name the actual competency or pattern that needs " +
        "work, not generic interview tips like \"practise more\".",
      UK_CONVENTIONS_INSTRUCTION,
      ANTI_FABRICATION_INSTRUCTION,
    ].join(" "),
  buildPrompt: (input) =>
    [
      `Company: ${input.company}`,
      `Role: ${input.role}`,
      "",
      "Every question asked, with its score and existing feedback:",
      ...input.answers.map(
        (answer, index) =>
          `${index + 1}. [${answer.competency}] ${answer.question}\n   Score: ${answer.overallScore}/100\n   Strengths: ${answer.strengths.join("; ")}\n   Improvements: ${answer.improvements.join("; ")}`,
      ),
      "",
      "Write the session-level results.",
    ].join("\n"),
};
