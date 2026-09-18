// Canonical source for every interview-domain enum — mirrors migration
// 0040/0041's real Postgres enums exactly (interview_mode,
// interview_session_status, interview_competency, interview_difficulty,
// interview_speaker). src/lib/ai/prompts/interview-chat.ts imports
// INTERVIEW_COMPETENCIES from here rather than declaring its own copy —
// same direction of dependency as src/lib/ai/prompts/ats-scan.ts
// importing SECTION_KEYS from src/lib/cvs/types.ts: the domain/DB shape
// is authoritative, the AI schema conforms to it, not the reverse.

export const INTERVIEW_MODES = ["chat", "voice"] as const;
export type InterviewMode = (typeof INTERVIEW_MODES)[number];

export const INTERVIEW_MODE_LABELS: Record<InterviewMode, string> = {
  chat: "Chat (text)",
  voice: "Voice",
};

export const INTERVIEW_STATUSES = ["in_progress", "completed", "abandoned"] as const;
export type InterviewStatus = (typeof INTERVIEW_STATUSES)[number];

export const INTERVIEW_DIFFICULTIES = ["easy", "medium", "hard"] as const;
export type InterviewDifficulty = (typeof INTERVIEW_DIFFICULTIES)[number];

export const INTERVIEW_DIFFICULTY_LABELS: Record<InterviewDifficulty, string> = {
  easy: "Easy",
  medium: "Medium",
  hard: "Hard",
};

/** A generic competency-based interview framework, not any one employer's branded one — matches this feature's own marketing copy ("UK-style competency questions"). */
export const INTERVIEW_COMPETENCIES = [
  "leadership",
  "teamwork",
  "communication",
  "problem_solving",
  "decision_making",
  "adaptability",
  "resilience",
  "initiative",
  "customer_focus",
  "time_management",
] as const;
export type InterviewCompetency = (typeof INTERVIEW_COMPETENCIES)[number];

export const INTERVIEW_COMPETENCY_LABELS: Record<InterviewCompetency, string> = {
  leadership: "Leadership",
  teamwork: "Teamwork",
  communication: "Communication",
  problem_solving: "Problem Solving",
  decision_making: "Decision Making",
  adaptability: "Adaptability",
  resilience: "Resilience",
  initiative: "Initiative",
  customer_focus: "Customer Focus",
  time_management: "Time Management",
};

/** A row in the dashboard's interview session list. */
export type InterviewSessionListItem = {
  id: string;
  role: string;
  company: string | null;
  mode: InterviewMode;
  status: InterviewStatus;
  difficulty: InterviewDifficulty;
  questionCount: number;
  createdAt: string;
};

export type InterviewQuestion = {
  id: string;
  competency: InterviewCompetency;
  question: string;
  displayOrder: number;
};

export const INTERVIEW_SPEAKERS = ["interviewer", "candidate"] as const;
export type InterviewSpeaker = (typeof INTERVIEW_SPEAKERS)[number];

/** One turn in the live conversation — the raw material the chat UI renders and the AI prompt reconstructs context from (src/lib/interviews/transcript.ts's formatTranscriptForPrompt). */
export type InterviewTranscriptTurn = {
  id: string;
  speaker: InterviewSpeaker;
  content: string;
  questionId: string | null;
  sequenceIndex: number;
};

/** interviewAnswerScorePrompt's real output shape, as persisted on interview_scores (migration 0042) — Situation/Task/Action/Result plus relevance, clarity, and evidence, each 0-100, and the model's own holistic overall score. */
export type InterviewAnswerScore = {
  situationScore: number;
  taskScore: number;
  actionScore: number;
  resultScore: number;
  relevanceScore: number;
  clarityScore: number;
  evidenceScore: number;
  overallScore: number;
  strengths: string[];
  improvements: string[];
  suggestedRephrase: string | null;
};

/** interviewSessionSummaryPrompt's real output shape, as persisted on interview_sessions (migration 0043) — generated once, right when the session concludes. Null until then. */
export type InterviewSessionSummary = {
  overallScore: number;
  strengths: string[];
  weaknesses: string[];
  recommendedPractice: string[];
};

/** One competency's aggregate score across every question in the session that targeted it — the radar chart's real input (src/lib/interviews/results.ts's computeCompetencyBreakdown), averaged when a competency was probed more than once. */
export type InterviewCompetencyBreakdownEntry = {
  competency: InterviewCompetency;
  score: number;
};

/** Everything the session page needs: the setup parameters, the live conversation so far, and (once completed) the session-level results. */
export type InterviewSessionDetail = {
  id: string;
  role: string;
  company: string | null;
  mode: InterviewMode;
  status: InterviewStatus;
  difficulty: InterviewDifficulty;
  jobDescription: string | null;
  createdAt: string;
  questions: InterviewQuestion[];
  transcript: InterviewTranscriptTurn[];
  /** Every already-scored question's feedback, keyed by question id — questions with no entry haven't been scored yet (still in progress, or a follow-up round). */
  scores: Record<string, InterviewAnswerScore>;
  /** Null until the session concludes and the summary is generated (best-effort — a failed generation also leaves this null even once completed). */
  summary: InterviewSessionSummary | null;
  /** Set when this session was launched to target specific weak competencies (src/lib/interviews/actions.ts's createInterviewSession) — empty for an ordinary session covering a broad spread. */
  focusCompetencies: InterviewCompetency[];
  /** The earlier session this one was a targeted re-practice of, if any — migration 0044's practiced_from_session_id. */
  practicedFromSessionId: string | null;
};

/** One competency's score history across every completed session that practiced it, oldest first — src/lib/interviews/queries.ts's getInterviewProgress. */
export type InterviewCompetencyProgress = {
  competency: InterviewCompetency;
  history: { score: number; completedAt: string; sessionId: string }[];
  firstScore: number;
  latestScore: number;
  /** latestScore - firstScore — positive means improvement. */
  delta: number;
};

/** A row in the progress page's session trend — only completed sessions have a real overallScore. */
export type InterviewProgressSession = {
  id: string;
  role: string;
  company: string | null;
  overallScore: number | null;
  completedAt: string;
};

export type InterviewProgress = {
  sessions: InterviewProgressSession[];
  competencies: InterviewCompetencyProgress[];
};
