import { z } from "zod";
import type { PromptDefinition } from "@/lib/ai/prompts/types";
import { UK_CONVENTIONS_INSTRUCTION } from "@/lib/ai/prompts/shared";
import { INTERVIEW_COMPETENCIES, INTERVIEW_COMPETENCY_LABELS } from "@/lib/interviews/types";
import type { InterviewDifficulty, InterviewCompetency } from "@/lib/interviews/types";

type SessionGrounding = {
  role: string;
  company: string;
  jobDescription?: string;
  difficulty: InterviewDifficulty;
  cvText?: string;
  /** Set for a targeted re-practice session (migration 0044) — every question must come from this set instead of the full 10-competency spread, even if that means asking a different scenario for a competency already covered in this same session. */
  focusCompetencies?: InterviewCompetency[];
};

function groundingLines(input: SessionGrounding): (string | null)[] {
  return [
    `Company: ${input.company}`,
    `Role: ${input.role}`,
    input.jobDescription ? `Job description:\n${input.jobDescription}` : null,
    input.cvText ? `Candidate's CV (for context, to tailor questions where relevant):\n${input.cvText}` : null,
  ];
}

const DIFFICULTY_GUIDANCE: Record<InterviewDifficulty, string> = {
  easy: "Keep questions approachable — common, well-signposted competency prompts a candidate would expect and could reasonably prepare for.",
  medium: "Standard competency-interview difficulty — specific, evidence-seeking questions a real interviewer would actually ask.",
  hard: "Push harder — layered or less predictable angles on each competency, the kind of question that catches out a candidate who's only rehearsed generic answers.",
};

const COMPETENCY_LIST_INSTRUCTION =
  "Choose competencies from this fixed set: leadership, teamwork, communication, problem solving, decision making, " +
  "adaptability, resilience, initiative, customer focus, time management.";

/** The focused version of COMPETENCY_LIST_INSTRUCTION for a targeted re-practice session — every question restricted to the given competencies, explicitly allowing a repeat with a different scenario once all of them have been covered once, since the target is still 5-8 questions total even when the focus set is smaller. */
function competencyInstruction(focusCompetencies: InterviewCompetency[] | undefined): string {
  if (!focusCompetencies || focusCompetencies.length === 0) return COMPETENCY_LIST_INSTRUCTION;

  const labels = focusCompetencies.map((competency) => INTERVIEW_COMPETENCY_LABELS[competency]).join(", ");
  return (
    `This is a targeted practice session — every question must probe one of these specific competencies only: ` +
    `${labels}. Do not ask about any other competency. Once you've covered all of them, it's fine to come back to ` +
    `one again with a different scenario rather than repeating the exact same question.`
  );
}

const INTERVIEWER_PERSONA_INSTRUCTION =
  "You are conducting a live UK-style competency-based mock interview — \"Tell me about a time when...\" questions, " +
  "not US-style case interviews or IQ puzzles. Speak directly to the candidate, in the first person, the way a real " +
  "interviewer would — warm but professional, one thing at a time.";

const GROUNDING_DISCIPLINE_INSTRUCTION =
  "Base every question only on the role, company, and job description actually given — never invent details about " +
  "the company or role that weren't provided. If a CV is given, you may tailor a question toward the candidate's " +
  "real background, but still never invent facts about them.";

// ---------------------------------------------------------------------
// Opening turn — the interview's very first question, before any
// candidate reply exists yet.
// ---------------------------------------------------------------------

export type InterviewOpeningTurnInput = SessionGrounding;

export const interviewOpeningTurnSchema = z.object({
  message: z
    .string()
    .min(1)
    .max(500)
    .describe("A brief, warm opening line followed by the first interview question, as one interviewer message."),
  competency: z.enum(INTERVIEW_COMPETENCIES).describe("The one competency this opening question is written to probe."),
});

export type InterviewOpeningTurnOutput = z.infer<typeof interviewOpeningTurnSchema>;

export const interviewOpeningTurnPrompt: PromptDefinition<InterviewOpeningTurnInput, InterviewOpeningTurnOutput> = {
  id: "interview_opening_turn",
  version: "1.0.0",
  operation: "interview_chat",
  schema: interviewOpeningTurnSchema,
  buildSystem: (input) =>
    [
      INTERVIEWER_PERSONA_INSTRUCTION,
      "This is the opening message of the interview — greet the candidate briefly, then ask your first question.",
      competencyInstruction(input.focusCompetencies),
      DIFFICULTY_GUIDANCE[input.difficulty],
      GROUNDING_DISCIPLINE_INSTRUCTION,
      UK_CONVENTIONS_INSTRUCTION,
    ].join(" "),
  buildPrompt: (input) =>
    [...groundingLines(input), "", "Open the interview and ask your first question."]
      .filter((line): line is string => line !== null)
      .join("\n"),
};

// ---------------------------------------------------------------------
// Continuation turn — after each candidate reply, decide whether to
// probe further, move to a fresh question, or wrap up.
// ---------------------------------------------------------------------

export type InterviewChatTurnInput = SessionGrounding & {
  /** The conversation so far, formatted "Interviewer: ...\nCandidate: ...\n..." (src/lib/interviews/transcript.ts's formatTranscriptForPrompt). */
  transcript: string;
  questionsAskedSoFar: number;
  /** True once at least 5 questions have been asked — the model may only choose "conclude" when this is true (also enforced server-side, never trusted alone). */
  canConclude: boolean;
  /** True once a question has already had 2 follow-ups — the model must not choose "follow_up" again (also enforced server-side). */
  mustAdvance: boolean;
};

export const interviewChatTurnSchema = z.object({
  action: z
    .enum(["follow_up", "next_question", "conclude"])
    .describe(
      "follow_up: probe deeper on the candidate's last answer, same competency. next_question: move on to a fresh " +
        "competency. conclude: end the interview — only once at least 5 questions have been asked.",
    ),
  message: z
    .string()
    .min(1)
    .max(600)
    .describe("The interviewer's next message — a follow-up question, a new question, or a brief closing remark."),
  competency: z
    .enum(INTERVIEW_COMPETENCIES)
    .optional()
    .describe("Required when action is next_question — the competency the new question probes. Omit otherwise."),
});

export type InterviewChatTurnOutput = z.infer<typeof interviewChatTurnSchema>;

export const interviewChatTurnPrompt: PromptDefinition<InterviewChatTurnInput, InterviewChatTurnOutput> = {
  id: "interview_chat_turn",
  version: "1.0.0",
  operation: "interview_chat",
  schema: interviewChatTurnSchema,
  buildSystem: (input) =>
    [
      INTERVIEWER_PERSONA_INSTRUCTION,
      "Read the conversation so far and decide what to do next: ask a contextual follow-up on the candidate's most " +
        "recent answer (only when it's genuinely thin, vague, or leaves an obvious gap — don't follow up just for " +
        "the sake of it), move on to a fresh competency question, or conclude the interview.",
      `${input.questionsAskedSoFar} question(s) asked so far, out of a target of 5-8 for the whole interview.`,
      input.canConclude
        ? "You may choose to conclude now if you've covered enough ground, or continue if there's more worth covering (up to 8 questions total)."
        : "Do not conclude yet — at least 5 questions must be asked before ending the interview.",
      input.mustAdvance
        ? "This question has already had enough follow-ups — move on to a fresh competency question or conclude, do not follow up again."
        : "",
      competencyInstruction(input.focusCompetencies),
      DIFFICULTY_GUIDANCE[input.difficulty],
      GROUNDING_DISCIPLINE_INSTRUCTION,
      UK_CONVENTIONS_INSTRUCTION,
    ]
      .filter((line) => line !== "")
      .join(" "),
  buildPrompt: (input) =>
    [
      ...groundingLines(input),
      "",
      "Conversation so far:",
      input.transcript,
      "",
      "Decide what to do next and respond as the interviewer.",
    ]
      .filter((line): line is string => line !== null)
      .join("\n"),
};
