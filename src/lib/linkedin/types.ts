// Canonical source for the LinkedIn Optimiser domain — mirrors migration
// 0046's real Postgres enum (linkedin_target_seniority) exactly, same
// direction of dependency as src/lib/interviews/types.ts mirroring its
// own migrations.

export const LINKEDIN_TARGET_SENIORITIES = [
  "entry",
  "associate",
  "mid",
  "senior",
  "lead",
  "director",
  "executive",
] as const;
export type LinkedinTargetSeniority = (typeof LINKEDIN_TARGET_SENIORITIES)[number];

export const LINKEDIN_TARGET_SENIORITY_LABELS: Record<LinkedinTargetSeniority, string> = {
  entry: "Entry-level",
  associate: "Associate",
  mid: "Mid-level",
  senior: "Senior",
  lead: "Lead",
  director: "Director",
  executive: "Executive",
};

/** A row in the dashboard's LinkedIn drafts list. */
export type LinkedinProfileDraftListItem = {
  id: string;
  title: string;
  targetRole: string;
  targetSeniority: LinkedinTargetSeniority;
  hasGenerated: boolean;
  updatedAt: string;
};

/** The three headline rewrites linkedinOptimizerPrompt always generates together — genuinely different angles on the same facts, not three phrasings of one idea. */
export type LinkedinHeadlineVariants = {
  concise: string;
  narrative: string;
  keywordDense: string;
};

/** One Experience bullet — a real row (migration 0047's linkedin_experience_bullets), not a jsonb array entry, so it can be individually regenerated/accepted/rejected via AiRewritePanel. */
export type LinkedinExperienceBulletItem = {
  id: string;
  content: string;
  displayOrder: number;
};

export const LINKEDIN_KEYWORD_IMPORTANCES = ["high", "medium", "low"] as const;
export type LinkedinKeywordImportance = (typeof LINKEDIN_KEYWORD_IMPORTANCES)[number];

export const LINKEDIN_KEYWORD_PLACEMENTS = ["headline", "about", "experience"] as const;
export type LinkedinKeywordPlacement = (typeof LINKEDIN_KEYWORD_PLACEMENTS)[number];

export const LINKEDIN_KEYWORD_PLACEMENT_LABELS: Record<LinkedinKeywordPlacement, string> = {
  headline: "Headline",
  about: "About",
  experience: "Experience",
};

/** One term recruiters are likely to search for this target role/seniority — migration 0048's keyword_coverage_terms, generated once per full generation (createLinkedinDraft/regenerateLinkedinDraft) and re-checked against whatever text is current every time the draft is read (see src/lib/linkedin/keyword-coverage.ts). `suggestedPlacement` is a property of the term itself (where this *kind* of term typically belongs), not of any specific missing instance. */
export type LinkedinKeywordTerm = {
  term: string;
  importance: LinkedinKeywordImportance;
  suggestedPlacement: LinkedinKeywordPlacement;
};

/** The result of checking a fixed keyword list against one piece of text — used for both the "before" (as-pasted) and "after" (currently optimized) sides of the coverage comparison, so the two scores are directly comparable (same denominator, different numerator). */
export type LinkedinKeywordCoverage = {
  score: number;
  found: LinkedinKeywordTerm[];
  missing: LinkedinKeywordTerm[];
};

/** Everything the draft detail page needs: the pasted input and, once generated at least once, the AI's rewrite. */
export type LinkedinProfileDraftDetail = {
  id: string;
  title: string;
  targetRole: string;
  targetSeniority: LinkedinTargetSeniority;
  currentHeadline: string;
  currentAbout: string;
  currentExperience: string;
  /** Null until the first successful generation. */
  optimizedHeadlineVariants: LinkedinHeadlineVariants | null;
  optimizedAbout: string | null;
  /** The headline the user chose (a variant, or one they then edited) — null until they choose. The "after" keyword score is computed against this, not all three variants at once. */
  selectedHeadline: string | null;
  experienceBullets: LinkedinExperienceBulletItem[];
  suggestedSkills: string[];
  notes: string[];
  /** The fixed recruiter-search keyword list this generation produced — the client recomputes the "after" coverage from this every time an About/Experience-bullet suggestion is accepted, rather than the score going stale until the whole draft is regenerated. */
  keywordTerms: LinkedinKeywordTerm[];
  /** Coverage against the as-pasted original text — this never changes for a given generation, so it's computed once, server-side. Null until the first successful generation. */
  keywordCoverageBefore: LinkedinKeywordCoverage | null;
  generatedAt: string | null;
  updatedAt: string;
};

/** A past state of a draft (migration 0093's linkedin_draft_versions) — always a past state: the draft itself is the current one. */
export type LinkedinDraftVersionSummary = {
  id: string;
  label: string;
  createdAt: string;
};
