/**
 * Plain data every cover letter template renders from — decoupled from
 * the editor's live-preview context on purpose, same reasoning as
 * CvTemplateContentData: the template engine itself has no dependency
 * on autosave/live-preview machinery, and can also render a fixed
 * sample letter for template-picker thumbnails.
 */
export type CoverLetterTemplateContentData = {
  senderName: string | null;
  senderEmail: string | null;
  senderPhone: string | null;
  senderLocation: string | null;
  companyName: string;
  jobTitle: string;
  paragraphs: { id: string; content: string }[];
};
