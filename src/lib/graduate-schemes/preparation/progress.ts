// The preparation journey's state machine — pure, so every rule is unit-tested and the scheme page, the journey page and the
// server actions can't disagree about what "done" means. Nothing here is stored: it is worked out from real data (the chosen
// CV, the ATS scan run for this scheme, practice history, mock interviews, the tracker application).

import type { AssessmentType } from "@/lib/graduate-schemes/types";

export const JOURNEY_STEPS = ["scheme", "cv", "ats", "tests", "interview", "tracker"] as const;
export type JourneyStep = (typeof JOURNEY_STEPS)[number];

export const JOURNEY_STEP_LABELS: Record<JourneyStep, string> = {
  scheme: "Scheme",
  cv: "CV",
  ats: "ATS check",
  tests: "Tests",
  interview: "Interview",
  tracker: "Tracker",
};

/** The thresholds behind "ready", in one place. */
export const CV_READY_PERCENT = 80;
export const ATS_READY_SCORE = 70;
export const TEST_READY_ANSWERS = 10;
export const TEST_READY_ACCURACY = 70;

export type StepStatus = "done" | "in_progress" | "todo" | "not_applicable" | "locked";

export type TestRow = {
  assessmentType: AssessmentType;
  testTypeSlug: string;
  name: string;
  answers: number;
  /** 0-100, or null with no answers. */
  accuracy: number | null;
};

export type JourneyInput = {
  started: boolean;
  cv: { id: string; title: string; readinessPercent: number; ready: boolean } | null;
  ats: { scanId: string; score: number; createdAt: string } | null;
  /** One row per required/used assessment that JobPilot has real practice for. Empty = nothing practicable for this scheme. */
  tests: TestRow[];
  /** The plan doesn't include Test Prep. */
  testsLocked: boolean;
  interview: { total: number; completed: number; bestScore: number | null; inProgressId: string | null; latestCompletedId: string | null };
  tracker: { applicationId: string; status: string } | null;
};

export function testRowReady(row: TestRow): boolean {
  return row.answers >= TEST_READY_ANSWERS && row.accuracy !== null && row.accuracy >= TEST_READY_ACCURACY;
}

export function stepStatuses(input: JourneyInput): Record<JourneyStep, StepStatus> {
  const cv: StepStatus = input.cv ? (input.cv.ready ? "done" : "in_progress") : "todo";
  const ats: StepStatus = input.ats ? (input.ats.score >= ATS_READY_SCORE ? "done" : "in_progress") : "todo";

  let tests: StepStatus;
  if (input.tests.length === 0) tests = "not_applicable";
  else if (input.testsLocked) tests = "locked";
  else if (input.tests.every(testRowReady)) tests = "done";
  else tests = input.tests.some((row) => row.answers > 0) ? "in_progress" : "todo";

  const interview: StepStatus = input.interview.completed > 0 ? "done" : input.interview.total > 0 ? "in_progress" : "todo";
  const tracker: StepStatus = input.tracker ? "done" : "todo";

  return { scheme: input.started ? "done" : "todo", cv, ats, tests, interview, tracker };
}

/** The first step still needing the user's attention (not done, not applicable, not plan-locked). Null when the journey is complete. */
export function nextStep(statuses: Record<JourneyStep, StepStatus>): JourneyStep | null {
  return JOURNEY_STEPS.find((step) => statuses[step] === "todo" || statuses[step] === "in_progress") ?? null;
}

/** Share of the steps that apply to this user that are done (a step that is not applicable or locked isn't counted either way). */
export function journeyPercent(statuses: Record<JourneyStep, StepStatus>): number {
  const counted = JOURNEY_STEPS.filter((step) => statuses[step] !== "not_applicable" && statuses[step] !== "locked");
  if (counted.length === 0) return 0;
  return Math.round((counted.filter((step) => statuses[step] === "done").length / counted.length) * 100);
}
