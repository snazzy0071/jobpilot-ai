export type { PromptDefinition } from "@/lib/ai/prompts/types";
export { toPromptCallOptions } from "@/lib/ai/prompts/types";
export { ANTI_FABRICATION_INSTRUCTION, UK_CONVENTIONS_INSTRUCTION } from "@/lib/ai/prompts/shared";

export { cvRewriteBulletsPrompt, cvRewriteBulletsSchema, cvRewriteSummaryPrompt, cvRewriteSummarySchema } from "@/lib/ai/prompts/cv-rewrite";
export type { CvRewriteInput, CvRewriteBulletsOutput, CvRewriteSummaryInput, CvRewriteSummaryOutput } from "@/lib/ai/prompts/cv-rewrite";

export { cvKeywordRewritePrompt, cvKeywordRewriteSchema } from "@/lib/ai/prompts/cv-keyword-rewrite";
export type { CvKeywordRewriteInput, CvKeywordRewriteOutput } from "@/lib/ai/prompts/cv-keyword-rewrite";

export {
  atsScanPrompt,
  atsScanSchema,
  atsScanScoresSchema,
  atsPrioritizedFixSchema,
  atsMatchedKeywordSchema,
  atsMissingKeywordSchema,
} from "@/lib/ai/prompts/ats-scan";
export type {
  AtsScanInput,
  AtsScanOutput,
  AtsScanScores,
  AtsPrioritizedFix,
  AtsMatchedKeyword,
  AtsMissingKeyword,
} from "@/lib/ai/prompts/ats-scan";

export { coverLetterPrompt } from "@/lib/ai/prompts/cover-letter";
export type { CoverLetterInput } from "@/lib/ai/prompts/cover-letter";

export { coverLetterParagraphRewritePrompt, coverLetterParagraphRewriteSchema } from "@/lib/ai/prompts/cover-letter-paragraph-rewrite";
export type { CoverLetterParagraphRewriteInput, CoverLetterParagraphRewriteOutput } from "@/lib/ai/prompts/cover-letter-paragraph-rewrite";

export { interviewAnswerScorePrompt, interviewAnswerScoreSchema } from "@/lib/ai/prompts/interview-answer-score";
export type { InterviewAnswerScoreInput, InterviewAnswerScoreOutput } from "@/lib/ai/prompts/interview-answer-score";

export {
  interviewOpeningTurnPrompt,
  interviewOpeningTurnSchema,
  interviewChatTurnPrompt,
  interviewChatTurnSchema,
} from "@/lib/ai/prompts/interview-chat";
export type {
  InterviewOpeningTurnInput,
  InterviewOpeningTurnOutput,
  InterviewChatTurnInput,
  InterviewChatTurnOutput,
} from "@/lib/ai/prompts/interview-chat";

export { interviewSessionSummaryPrompt, interviewSessionSummarySchema } from "@/lib/ai/prompts/interview-session-summary";
export type { InterviewSessionSummaryInput, InterviewSessionSummaryOutput } from "@/lib/ai/prompts/interview-session-summary";

export { linkedinOptimizerPrompt, linkedinOptimizerSchema, linkedinHeadlineVariantsSchema } from "@/lib/ai/prompts/linkedin-optimizer";
export type { LinkedinOptimizerInput, LinkedinOptimizerOutput, LinkedinHeadlineVariants } from "@/lib/ai/prompts/linkedin-optimizer";

export { linkedinAboutRewritePrompt, linkedinAboutRewriteSchema } from "@/lib/ai/prompts/linkedin-about-rewrite";
export type { LinkedinAboutRewriteInput, LinkedinAboutRewriteOutput } from "@/lib/ai/prompts/linkedin-about-rewrite";

export {
  linkedinExperienceBulletRewritePrompt,
  linkedinExperienceBulletRewriteSchema,
} from "@/lib/ai/prompts/linkedin-experience-bullet-rewrite";
export type {
  LinkedinExperienceBulletRewriteInput,
  LinkedinExperienceBulletRewriteOutput,
} from "@/lib/ai/prompts/linkedin-experience-bullet-rewrite";

export { jobMatchPrompt, jobMatchSchema } from "@/lib/ai/prompts/job-match";
export type { JobMatchInput, JobMatchOutput, JobMatchComponent } from "@/lib/ai/prompts/job-match";
