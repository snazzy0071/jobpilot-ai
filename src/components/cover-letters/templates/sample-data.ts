import type { CoverLetterTemplateContentData } from "@/components/cover-letters/templates/types";

/** Fixed, deliberately concise sample letter for template-picker thumbnails — not the user's own content, so all 4 thumbnails stay a consistent size regardless of how long a real letter is. */
export const COVER_LETTER_SAMPLE_DATA: CoverLetterTemplateContentData = {
  senderName: "Alex Morgan",
  senderEmail: "alex.morgan@email.com",
  senderPhone: "07700 900123",
  senderLocation: "Manchester, UK",
  companyName: "Northbridge Partners",
  jobTitle: "Marketing Executive",
  paragraphs: [
    {
      id: "sample-1",
      content:
        "Dear Hiring Manager, I am writing to apply for the Marketing Executive role at Northbridge Partners, having followed the team's recent campaign work with real interest.",
    },
    {
      id: "sample-2",
      content:
        "In my current role I have led social campaigns that grew organic engagement by 40% over six months, working closely with design and sales to keep messaging consistent across channels.",
    },
    {
      id: "sample-3",
      content: "I would welcome the opportunity to discuss how I could contribute to your team. Yours sincerely, Alex Morgan",
    },
  ],
};
