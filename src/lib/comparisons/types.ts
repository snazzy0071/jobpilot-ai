// Comparison pages (migration 0117). Every claim about a competitor carries the public page it came from and the date it was
// checked; the page carries an "information checked on" date. The shapes are validated on write (src/lib/comparisons/schemas.ts).

export const SUPPORT_LEVELS = ["yes", "partial", "no", "unknown"] as const;
/** What the competitor's own published information says. "unknown" = not confirmed from a source — shown honestly, never guessed. */
export type SupportLevel = (typeof SUPPORT_LEVELS)[number];

export const SUPPORT_LABELS: Record<SupportLevel, string> = { yes: "Yes", partial: "Partly", no: "No", unknown: "Not confirmed" };

export const JOBPILOT_LEVELS = ["yes", "partial", "no"] as const;
export type JobpilotLevel = (typeof JOBPILOT_LEVELS)[number];

export type Evidence = { sourceUrl: string; sourceDate: string };

export type ComparisonFeature = {
  label: string;
  competitor: SupportLevel;
  competitorNote: string | null;
  jobpilot: JobpilotLevel;
  jobpilotNote: string | null;
  /** Required whenever the competitor value isn't "unknown". */
  sourceUrl: string | null;
  sourceDate: string | null;
};

export type ComparisonPricing = { plan: string; price: string; notes: string | null } & Evidence;

export type ComparisonDifference = { title: string; competitor: string; jobpilot: string } & Evidence;

export type ComparisonFaq = { question: string; answer: string; sourceUrl: string | null; sourceDate: string | null };

export type ComparisonPage = {
  id: string;
  slug: string;
  competitorName: string;
  competitorWebsite: string | null;
  intro: string | null;
  features: ComparisonFeature[];
  pricing: ComparisonPricing[];
  differences: ComparisonDifference[];
  faqs: ComparisonFaq[];
  /** ISO date the competitor information was last checked. */
  updatedOn: string;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

/** A source, deduplicated across the whole page and numbered in order of first appearance — the footnotes readers can follow. */
export type ComparisonSource = { number: number; url: string; host: string; checkedOn: string; label: string };
