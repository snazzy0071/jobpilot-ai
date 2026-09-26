// The 24-template catalog (slugs, names, sector/experience-level tags)
// lives in src/config/cv-templates.ts — that's presentation/config data,
// not a fact about a cv row the way the fields below are. Re-exported
// here only so existing `import type { CvTemplate } from "@/lib/cvs/types"`
// call sites didn't all need to change when the catalog grew from 3
// placeholder values to 24 real ones.
export type { CvTemplate } from "@/config/cv-templates";
import type { CvTemplate } from "@/config/cv-templates";
import type { AtsFormatCheck } from "@/lib/files/ats-format-analysis";

export type CvListItem = {
  id: string;
  title: string;
  template: CvTemplate;
  isArchived: boolean;
  updatedAt: string;
  currentVersionId: string | null;
  atsScore: number | null;
};

export const LANGUAGE_PROFICIENCIES = [
  "basic",
  "conversational",
  "professional",
  "fluent",
  "native",
] as const;
export type LanguageProficiency = (typeof LANGUAGE_PROFICIENCIES)[number];

export const LANGUAGE_PROFICIENCY_LABELS: Record<LanguageProficiency, string> = {
  basic: "Basic",
  conversational: "Conversational",
  professional: "Professional",
  fluent: "Fluent",
  native: "Native",
};

export type CvPersonal = {
  id: string;
  fullName: string;
  headline: string | null;
  email: string | null;
  phone: string | null;
  location: string | null;
  websiteUrl: string | null;
  linkedinUrl: string | null;
  portfolioUrl: string | null;
};

export type CvSummary = {
  id: string;
  content: string;
};

export type CvExperience = {
  id: string;
  jobTitle: string;
  employer: string;
  location: string | null;
  startDate: string;
  endDate: string | null;
  isCurrent: boolean;
  description: string | null;
  displayOrder: number;
};

export type CvEducation = {
  id: string;
  institution: string;
  qualification: string;
  fieldOfStudy: string | null;
  location: string | null;
  startDate: string | null;
  endDate: string | null;
  isCurrent: boolean;
  grade: string | null;
  description: string | null;
  displayOrder: number;
};

export type CvSkill = {
  id: string;
  name: string;
  category: string | null;
  displayOrder: number;
  isVisible: boolean;
};

export type CvProject = {
  id: string;
  name: string;
  description: string | null;
  url: string | null;
  technologies: string[];
  startDate: string | null;
  endDate: string | null;
  isOngoing: boolean;
  displayOrder: number;
  isVisible: boolean;
};

export type CvCertification = {
  id: string;
  name: string;
  issuingOrganization: string;
  issueDate: string | null;
  expiryDate: string | null;
  credentialId: string | null;
  credentialUrl: string | null;
  displayOrder: number;
  isVisible: boolean;
};

export type CvLanguage = {
  id: string;
  name: string;
  proficiency: LanguageProficiency;
  displayOrder: number;
  isVisible: boolean;
};

export type CvCustomSection = {
  id: string;
  title: string;
  content: string | null;
  displayOrder: number;
  isVisible: boolean;
};

export const SECTION_KEYS = [
  "personal",
  "summary",
  "experience",
  "education",
  "skills",
  "projects",
  "certifications",
  "languages",
  "customSections",
] as const;
export type SectionKey = (typeof SECTION_KEYS)[number];

export const SECTION_LABELS: Record<SectionKey, string> = {
  personal: "Personal details",
  summary: "Summary",
  experience: "Experience",
  education: "Education",
  skills: "Skills",
  projects: "Projects",
  certifications: "Certifications",
  languages: "Languages",
  customSections: "Custom sections",
};

export type CvEditorData = {
  cvId: string;
  cvTitle: string;
  template: CvTemplate;
  versionId: string;
  versionNumber: number;
  atsScore: number | null;
  sectionOrder: SectionKey[];
  personal: CvPersonal | null;
  summary: CvSummary | null;
  experience: CvExperience[];
  education: CvEducation[];
  skills: CvSkill[];
  projects: CvProject[];
  certifications: CvCertification[];
  languages: CvLanguage[];
  customSections: CvCustomSection[];
};

export type CvVersionSummary = {
  id: string;
  versionNumber: number;
  label: string | null;
  isCurrent: boolean;
  createdAt: string;
};

/** A deterministic, code-computed CV content check — never AI-guessed, so it's never wrong about what's actually in the CV. */
export type CvAtsFormatIssue = {
  id: string;
  severity: "warning" | "info";
  message: string;
  sectionKey: SectionKey;
};

export type CvAtsFixPriority = "high" | "medium" | "low";

export type CvAtsPrioritizedFix = {
  priority: CvAtsFixPriority;
  sectionKey: SectionKey | null;
  message: string;
};

/** How central this term is to the job description, per the AI — not derived purely from occurrenceCount (a term can matter a lot after appearing once, e.g. "must have security clearance"). */
export type CvAtsKeywordImportance = "high" | "medium" | "low";

export type CvAtsMatchedKeyword = {
  term: string;
  importance: CvAtsKeywordImportance;
  /** Deterministic: how many times this term appears in the job description (src/lib/cvs/ats-keyword-occurrences.ts), never asked of the model. */
  occurrenceCount: number;
};

export type CvAtsMissingKeyword = {
  term: string;
  importance: CvAtsKeywordImportance;
  occurrenceCount: number;
  /** The one CV section this gap would most naturally be filled in, or null if genuinely unclear. */
  suggestedSection: SectionKey | null;
};

export type CvAtsScan = {
  id: string;
  jobDescription: string;
  /** The AI's five independent 0-100 scores — see atsScanScoresSchema (src/lib/ai/prompts/ats-scan.ts) for what each one judges. */
  overallScore: number;
  keywordScore: number;
  structureScore: number;
  formatScore: number;
  sectionsScore: number;
  matchedKeywords: CvAtsMatchedKeyword[];
  missingKeywords: CvAtsMissingKeyword[];
  strengths: string[];
  prioritizedFixes: CvAtsPrioritizedFix[];
  summary: string;
  createdAt: string;
};

/** A past job description the user pasted (for this CV or another one) offered back so they don't have to re-paste it. */
export type CvAtsJobOption = {
  id: string;
  jobDescription: string;
  createdAt: string;
};

/**
 * The ATS Scanner's own "scan a file, not a saved CV" result (`source: 'manual_text'`, see migration 0031) —
 * the same real AI scoring engine as `CvAtsScan`, plus the uploaded file's own real structural facts
 * (`src/lib/files/ats-format-analysis.ts`: embedded fonts, tables, columns, headings...), which the AI scan
 * never sees since it only ever reads extracted text. `null` for a plain-text upload or pasted text, which
 * has no file format to check beyond "is it readable" — already true by the time a scan runs at all.
 */
export type ManualAtsScan = CvAtsScan & { fileFormatChecks: AtsFormatCheck[] | null };
