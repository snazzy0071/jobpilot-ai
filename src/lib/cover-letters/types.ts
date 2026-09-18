// Re-exported here, same convention as src/lib/cvs/types.ts re-exporting
// CvTemplate from src/config/cv-templates.ts — the catalog itself is
// presentation/config data, not a fact about a cover_letters row, but
// existing `import type { CoverLetterTemplate } from
// "@/lib/cover-letters/types"` call sites shouldn't all need to change
// if the catalog grows.
export type { CoverLetterTemplate } from "@/config/cover-letter-templates";
import type { CoverLetterTemplate } from "@/config/cover-letter-templates";

export const COVER_LETTER_TONES = ["formal", "conversational"] as const;
export type CoverLetterTone = (typeof COVER_LETTER_TONES)[number];

export const COVER_LETTER_TONE_LABELS: Record<CoverLetterTone, string> = {
  formal: "Formal",
  conversational: "Conversational",
};

export const COVER_LETTER_LENGTHS = ["concise", "standard", "detailed"] as const;
export type CoverLetterLength = (typeof COVER_LETTER_LENGTHS)[number];

export const COVER_LETTER_LENGTH_LABELS: Record<CoverLetterLength, string> = {
  concise: "Concise (~150-200 words)",
  standard: "Standard (~250-350 words)",
  detailed: "Detailed (~400-500 words)",
};

/** A row in the dashboard's cover-letter list — tone/length come from the current version, template from the container, joined in at query time (src/lib/cover-letters/queries.ts). */
export type CoverLetterListItem = {
  id: string;
  companyName: string;
  jobTitle: string;
  tone: CoverLetterTone;
  length: CoverLetterLength;
  template: CoverLetterTemplate;
  createdAt: string;
  updatedAt: string;
};

export type CoverLetterParagraph = {
  id: string;
  content: string;
  displayOrder: number;
};

export type CoverLetterVersionSummary = {
  id: string;
  versionNumber: number;
  label: string | null;
  isCurrent: boolean;
  createdAt: string;
};

/**
 * Everything the paragraph editor and template preview need for the
 * *current* version of one cover letter — the direct analog of
 * CvEditorData. Structurally a superset of
 * CoverLetterTemplateContentData (src/components/cover-letters/
 * templates/types.ts), same relationship CvEditorData has to
 * CvTemplateContentData — a value of this type can be passed anywhere
 * that shape is expected without a separate conversion step.
 *
 * `senderName`/`senderEmail`/`senderPhone`/`senderLocation` come from
 * the linked CV's personal details (via cover_letter_versions.
 * cv_version_id — see getCoverLetterEditorData), not from any field
 * this feature collects itself; all four are null if no CV is linked or
 * that CV has no personal details filled in yet.
 */
export type CoverLetterEditorData = {
  coverLetterId: string;
  companyName: string;
  jobTitle: string;
  jobDescription: string;
  template: CoverLetterTemplate;
  versionId: string;
  versionNumber: number;
  tone: CoverLetterTone;
  length: CoverLetterLength;
  senderName: string | null;
  senderEmail: string | null;
  senderPhone: string | null;
  senderLocation: string | null;
  paragraphs: CoverLetterParagraph[];
};
