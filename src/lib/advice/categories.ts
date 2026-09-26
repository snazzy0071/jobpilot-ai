// The Advice Hub's eight fixed categories (mirrors migration 0114's check constraint). Each carries the JobPilot tool or page most
// useful to someone reading in that category — shown at the foot of a guide.

export const ADVICE_CATEGORIES = ["cv", "ats", "interviews", "applications", "graduate_schemes", "visa_sponsorship", "assessments", "career_advice"] as const;
export type AdviceCategory = (typeof ADVICE_CATEGORIES)[number];

export const ADVICE_CATEGORY_LABELS: Record<AdviceCategory, string> = {
  cv: "CV",
  ats: "ATS",
  interviews: "Interviews",
  applications: "Applications",
  graduate_schemes: "Graduate Schemes",
  visa_sponsorship: "Visa & Sponsorship",
  assessments: "Assessments",
  career_advice: "Career Advice",
};

export const ADVICE_CATEGORY_DESCRIPTIONS: Record<AdviceCategory, string> = {
  cv: "Writing and tailoring a CV that gets read.",
  ats: "How applicant tracking systems handle your application.",
  interviews: "Preparing for and performing well in interviews.",
  applications: "Managing deadlines, versions and follow-ups.",
  graduate_schemes: "Understanding graduate scheme listings and timelines.",
  visa_sponsorship: "Sponsor licences and sponsorship in a UK job search.",
  assessments: "Aptitude tests, video interviews and assessment centres.",
  career_advice: "Decisions that shape your early career.",
};

export type AdviceCategoryTool = { label: string; description: string; href: string };

export const ADVICE_CATEGORY_TOOLS: Record<AdviceCategory, AdviceCategoryTool> = {
  cv: { label: "CV Builder", description: "Build a UK-standard CV and keep a version for every application.", href: "/features/cv" },
  ats: { label: "ATS Scanner", description: "Check your CV against a real job description.", href: "/features/ats" },
  interviews: { label: "Interview Coach", description: "Practise competency questions with scored feedback.", href: "/features/interview" },
  applications: { label: "Job Tracker", description: "Track deadlines, CV versions and reminders in one place.", href: "/features/tracker" },
  graduate_schemes: { label: "Graduate schemes", description: "Browse schemes with deadlines, assessments and sources.", href: "/graduate-schemes" },
  visa_sponsorship: { label: "Visa sponsor register", description: "Search employers on the Home Office register of licensed sponsors.", href: "/visa-sponsors" },
  assessments: { label: "Grad Scheme Prep", description: "Original practice for the common graduate aptitude tests.", href: "/features/gradprep" },
  career_advice: { label: "JobPilot AI", description: "The tools for every stage of the search, in one workspace.", href: "/signup" },
};

export function isAdviceCategory(value: unknown): value is AdviceCategory {
  return typeof value === "string" && (ADVICE_CATEGORIES as readonly string[]).includes(value);
}
