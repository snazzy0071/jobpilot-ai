import { Mail } from "lucide-react";
import { FeaturePage } from "@/components/marketing/feature-page";
import { CoverLetterPreview } from "@/components/marketing/cover-letter-preview";
import { buildMetadata } from "@/lib/seo/metadata";

export const metadata = buildMetadata({
  title: "Cover Letter Generator",
  description: "Draft a cover letter from your CV and the job details, then edit it until it sounds like you.",
  path: "/features/cover-letter",
});

export default function CoverLetterPage() {
  return (
    <FeaturePage
      slug="cover-letter"
      icon={Mail}
      eyebrow="Cover Letter Generator"
      title="A tailored letter for every application"
      description="Draft a cover letter from your CV and the job details, then edit it until it sounds like you."
      plan="pro"
      quickAnswer="From Pro — generate a tailored cover letter from your CV and a job description in minutes."
      demo={<CoverLetterPreview />}
      capabilities={[
        "Grounded entirely in your real CV — no invented employers, numbers, or achievements",
        "Paste a job description, or a link, and the letter targets that specific role",
        "Regenerate a single paragraph without rewriting the whole letter",
        "A handful of UK-appropriate templates, formal to minimal, all ATS-safe",
        "A pre-send checklist — action verbs, quantified results, spelling and grammar",
      ]}
      beforeAfter={{
        before: "Dear Hiring Manager, I am writing to apply for the position of Graduate Analyst.",
        after:
          "I spent last summer turning a two-week reporting process into a same-day one — I'd like to bring that instinct for cutting waste to your Graduate Analyst team.",
      }}
      outcomes={[
        "A letter that sounds like you, not a template",
        "Less time spent staring at a blank page",
        "Every claim traceable back to your actual CV",
      ]}
      faq={[
        {
          question: "Does it invent achievements I don't have?",
          answer: "No — every claim comes from your CV. Nothing is fabricated.",
        },
        {
          question: "Can I regenerate just one paragraph?",
          answer: "Yes — edit or regenerate a single paragraph without touching the rest.",
        },
        {
          question: "What templates are available?",
          answer: "A few UK-appropriate styles, from formal to minimal, all built to stay ATS-safe.",
        },
        {
          question: "Is this included in the free plan?",
          answer: "No — it's part of Pro and above.",
        },
      ]}
    />
  );
}
