import type { AssessmentType } from "@/lib/graduate-schemes/types";

/**
 * Which JobPilot preparation exists for each kind of assessment — and, just as important, which does NOT. This is the single
 * place the graduate-scheme pages read from, so a link is only ever shown for something that is really built:
 *  - Test Prep (`/dashboard/test-prep`): original practice in five formats (critical thinking, situational judgement,
 *    numerical, verbal, diagrammatic). Premium and Elite.
 *  - Interview Coach (`/dashboard/interview`): competency-style text and voice interview practice.
 * Nothing here reproduces a vendor's product; the copy says "-style" practice and where it stops.
 */
export type PrepLink = {
  label: string;
  href: string;
  /** Test Prep links resolve to the test type's own section (`#<id>`) by slug at render time. */
  testTypeSlug?: string;
  note?: string;
};

export type AssessmentPrep = {
  /** full: dedicated practice exists · partial: covers part of it · none: nothing built for this yet. */
  coverage: "full" | "partial" | "none";
  summary: string;
  links: PrepLink[];
};

export const ASSESSMENT_PREP: Record<AssessmentType, AssessmentPrep> = {
  sjt: {
    coverage: "full",
    summary: "Practise choosing the most effective response to workplace scenarios, with an explanation after every answer.",
    links: [{ label: "Situational judgement practice", href: "/dashboard/test-prep", testTypeSlug: "situational-judgement", note: "Premium and Elite" }],
  },
  numerical: {
    coverage: "full",
    summary: "Practise reading tables and charts and working out percentages, ratios and change — untimed, then as a timed exam.",
    links: [{ label: "Numerical reasoning practice", href: "/dashboard/test-prep", testTypeSlug: "numerical-reasoning", note: "Premium and Elite" }],
  },
  verbal: {
    coverage: "full",
    summary: "Practise deciding whether a statement is true, false or can't be said from a passage.",
    links: [{ label: "Verbal reasoning practice", href: "/dashboard/test-prep", testTypeSlug: "verbal-reasoning", note: "Premium and Elite" }],
  },
  watson_glaser: {
    coverage: "full",
    summary: "Original critical-thinking practice on inferences, assumptions, deductions, interpretation and arguments. It is not the official test.",
    links: [{ label: "Critical thinking practice", href: "/dashboard/test-prep", testTypeSlug: "critical-thinking", note: "Premium and Elite" }],
  },
  hirevue: {
    coverage: "partial",
    summary: "Practise answering competency questions out loud and get scored feedback. JobPilot does not reproduce HireVue's platform, timing or scoring.",
    links: [{ label: "Interview Coach (voice)", href: "/dashboard/interview" }],
  },
  hackerrank: {
    coverage: "none",
    summary: "JobPilot doesn't have coding-assessment practice yet.",
    links: [],
  },
  case_interview: {
    coverage: "none",
    summary: "JobPilot doesn't have case-interview practice yet. The Interview Coach covers competency-style questions, not case frameworks.",
    links: [],
  },
  assessment_centre: {
    coverage: "partial",
    summary: "Covers the interview and aptitude-test parts of a centre. Group exercises and presentations aren't covered.",
    links: [
      { label: "Interview Coach", href: "/dashboard/interview" },
      { label: "Aptitude test practice", href: "/dashboard/test-prep", note: "Premium and Elite" },
    ],
  },
  other: {
    coverage: "none",
    summary: "There is no specific JobPilot practice for this stage.",
    links: [],
  },
};

export const PREP_COVERAGE_LABELS: Record<AssessmentPrep["coverage"], string> = {
  full: "JobPilot practice available",
  partial: "Partly covered",
  none: "No JobPilot practice yet",
};
