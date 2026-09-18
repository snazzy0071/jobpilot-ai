import { z } from "zod";
import type { PromptDefinition } from "@/lib/ai/prompts/types";
import { ANTI_FABRICATION_INSTRUCTION, UK_CONVENTIONS_INSTRUCTION } from "@/lib/ai/prompts/shared";

export type InterviewAnswerScoreInput = {
  role: string;
  question: string;
  /** The full answer, including any follow-up replies folded in (src/lib/interviews/internal.ts's appendAnswer) — scored as one complete answer, not just the first reply. */
  answerTranscript: string;
};

export const interviewAnswerScoreSchema = z.object({
  situationScore: z.number().int().min(0).max(100).describe("How clearly the answer sets out a real situation or context."),
  taskScore: z.number().int().min(0).max(100).describe("How clearly the candidate's own responsibility or goal within that situation is defined."),
  actionScore: z.number().int().min(0).max(100).describe("How clearly and specifically the answer describes what the candidate themselves actually did."),
  resultScore: z.number().int().min(0).max(100).describe("How clear and concrete the outcome is — ideally with real evidence of impact, not a vague conclusion."),
  relevanceScore: z.number().int().min(0).max(100).describe("How directly the answer actually addresses the question that was asked."),
  clarityScore: z.number().int().min(0).max(100).describe("How clear and well-organised the answer is to follow."),
  evidenceScore: z.number().int().min(0).max(100).describe("How much the answer is backed by concrete specifics — numbers, names, timeframes, outcomes — rather than vague generalities."),
  overallScore: z
    .number()
    .int()
    .min(0)
    .max(100)
    .describe("Overall answer quality — your own holistic judgment, not an average of the scores above."),
  strengths: z.array(z.string().min(1).max(240)).min(1).max(4),
  improvements: z
    .array(z.string().min(1).max(240))
    .min(1)
    .max(4)
    .describe("Specific, actionable improvement advice — each one referencing something the candidate actually said, not generic advice."),
  suggestedRephrase: z
    .string()
    .max(600)
    .optional()
    .describe("A short example of how the weakest part of the answer could be rephrased, if applicable."),
});

export type InterviewAnswerScoreOutput = z.infer<typeof interviewAnswerScoreSchema>;

/**
 * Scores one finished interview answer against the STAR structure
 * (Situation, Task, Action, Result, each independently) plus relevance,
 * clarity, and evidence — fired once a question's answer becomes final
 * (the interviewer has moved on to a follow-up-free next question or
 * concluded), never mid-follow-up, so it always scores the complete
 * answer rather than a partial one.
 */
export const interviewAnswerScorePrompt: PromptDefinition<InterviewAnswerScoreInput, InterviewAnswerScoreOutput> = {
  id: "interview_answer_score",
  version: "1.0.0",
  operation: "interview_answer_score",
  schema: interviewAnswerScoreSchema,
  buildSystem: () =>
    [
      "You are an interview coach scoring one candidate's answer from a completed UK-style competency-based mock " +
        "interview. Score it the way an experienced interviewer would, against the STAR structure — Situation, " +
        "Task, Action, and Result, each scored independently — plus how relevant, clear, and evidence-backed the " +
        "answer is.",
      "Base every score and comment only on what the answer transcript actually contains — never assume context " +
        "that wasn't said, and never fill a gap in the story with an assumption.",
      "Improvement advice must be specific and actionable, referencing something the candidate actually said, not " +
        "generic interview tips.",
      UK_CONVENTIONS_INSTRUCTION,
      ANTI_FABRICATION_INSTRUCTION,
    ].join(" "),
  buildPrompt: (input) =>
    [
      `Role being interviewed for: ${input.role}`,
      `Interview question: ${input.question}`,
      "",
      "Candidate's full answer (including any follow-up replies):",
      input.answerTranscript,
      "",
      "Score this answer.",
    ].join("\n"),
};
