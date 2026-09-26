// Canonical source for the graduate schemes domain — mirrors public.graduate_schemes (migrations 0056, 0057, 0111).
// Enum values are the database's own snake_case labels; a display label lives alongside each.

export const GRADUATE_SCHEME_SECTORS = [
  "consulting",
  "banking_and_finance",
  "accounting_and_audit",
  "law",
  "technology",
  "engineering_and_manufacturing",
  "retail_and_consumer",
  "healthcare_and_life_sciences",
  "energy_and_utilities",
  "property_and_construction",
  "media_and_marketing",
  "charity_and_education",
  "public_sector",
  "other",
] as const;
export type GraduateSchemeSector = (typeof GRADUATE_SCHEME_SECTORS)[number];

export const GRADUATE_SCHEME_SECTOR_LABELS: Record<GraduateSchemeSector, string> = {
  consulting: "Consulting",
  banking_and_finance: "Banking & Finance",
  accounting_and_audit: "Accounting & Audit",
  law: "Law",
  technology: "Technology",
  engineering_and_manufacturing: "Engineering & Manufacturing",
  retail_and_consumer: "Retail & Consumer",
  healthcare_and_life_sciences: "Healthcare & Life Sciences",
  energy_and_utilities: "Energy & Utilities",
  property_and_construction: "Property & Construction",
  media_and_marketing: "Media & Marketing",
  charity_and_education: "Charity & Education",
  public_sector: "Public Sector",
  other: "Other",
};

// Matches migration 0057's relabelled enum exactly.
export const GRADUATE_SCHEME_SPONSORSHIP_STATUSES = ["sponsors", "some_tracks", "no", "not_published"] as const;
export type GraduateSchemeSponsorshipStatus = (typeof GRADUATE_SCHEME_SPONSORSHIP_STATUSES)[number];

export const GRADUATE_SCHEME_SPONSORSHIP_STATUS_LABELS: Record<GraduateSchemeSponsorshipStatus, string> = {
  sponsors: "Sponsors",
  some_tracks: "Some tracks",
  no: "No",
  not_published: "Not published",
};

/** Who the scheme is open to (migration 0111's check constraint). */
export const STUDY_STAGES = ["penultimate_year", "final_year", "graduate", "postgraduate"] as const;
export type StudyStage = (typeof STUDY_STAGES)[number];

export const STUDY_STAGE_LABELS: Record<StudyStage, string> = {
  penultimate_year: "Penultimate-year students",
  final_year: "Final-year students",
  graduate: "Recent graduates",
  postgraduate: "Postgraduates (Master's / PhD)",
};

/** The kinds of assessment a scheme can be mapped to (migration 0112's check constraint). */
export const ASSESSMENT_TYPES = ["sjt", "numerical", "verbal", "watson_glaser", "hirevue", "hackerrank", "case_interview", "assessment_centre", "other"] as const;
export type AssessmentType = (typeof ASSESSMENT_TYPES)[number];

export const ASSESSMENT_LABELS: Record<AssessmentType, string> = {
  sjt: "Situational judgement test (SJT)",
  numerical: "Numerical reasoning test",
  verbal: "Verbal reasoning test",
  watson_glaser: "Watson-Glaser-style critical thinking test",
  hirevue: "HireVue-style video interview",
  hackerrank: "HackerRank-style coding assessment",
  case_interview: "Case interview",
  assessment_centre: "Assessment centre",
  other: "Other assessment",
};

/** Compact names for listing chips. */
export const ASSESSMENT_SHORT_LABELS: Record<AssessmentType, string> = {
  sjt: "SJT",
  numerical: "Numerical",
  verbal: "Verbal",
  watson_glaser: "Watson-Glaser-style",
  hirevue: "HireVue-style",
  hackerrank: "HackerRank-style",
  case_interview: "Case interview",
  assessment_centre: "Assessment centre",
  other: "Other",
};

/** One assessment a scheme uses, with the evidence for that specific claim. */
export type SchemeAssessment = {
  id: string;
  schemeId: string;
  type: AssessmentType;
  /** Names an "other" assessment (required for it); optional detail for the rest. */
  label: string | null;
  /** The test provider/platform, only when the source names one. */
  provider: string | null;
  notes: string | null;
  isRequired: boolean;
  displayOrder: number;
  sourceUrl: string;
  sourceDate: string;
  verifiedAt: string;
};

/** Where a scheme is in its application cycle, worked out from its dates (src/lib/graduate-schemes/status.ts) — never stored. */
export type ApplicationStatus = "open" | "upcoming" | "closed" | "dates_not_published";

/** One public.graduate_schemes row, as the pages and admin consume it. */
export type GraduateScheme = {
  id: string;
  slug: string;
  employer: string;
  schemeName: string;
  sector: GraduateSchemeSector;
  description: string | null;
  /** Free text — published figures are a single number, a band, or "Not disclosed"; null when nothing's given at all. */
  salary: string | null;
  salaryMin: number | null;
  salaryMax: number | null;
  locations: string[];
  studyStages: StudyStage[];
  /** ISO dates (YYYY-MM-DD). Null means the employer hasn't published one — never a guess. */
  opensOn: string | null;
  deadlineOn: string | null;
  isRolling: boolean;
  sponsorshipStatus: GraduateSchemeSponsorshipStatus;
  assessments: SchemeAssessment[];
  assessmentNotes: string | null;
  applicationUrl: string | null;
  notes: string | null;
  sourceUrl: string;
  sourceDate: string;
  verifiedAt: string;
  isPublished: boolean;
  updatedAt: string;
};
