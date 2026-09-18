import { ScanSearch } from "lucide-react";
import { FeaturePage } from "@/components/marketing/feature-page";
import { AtsScorePreview } from "@/components/marketing/ats-score-preview";
import { buildMetadata } from "@/lib/seo/metadata";

export const metadata = buildMetadata({
  title: "ATS Scanner",
  description: "Check how your CV reads to the applicant tracking systems that filter applications before a human sees them.",
  path: "/features/ats",
});

export default function AtsScannerPage() {
  return (
    <FeaturePage
      slug="ats"
      icon={ScanSearch}
      eyebrow="ATS Scanner"
      title="Know before you apply"
      description="Check how your CV reads to the applicant tracking systems that filter applications before a human sees them."
      plan="free"
      quickAnswer="Yes — scan your CV against a job description for free, with unlimited scans."
      demo={<AtsScorePreview />}
      capabilities={[
        "Match your CV against a specific job description",
        "See which keywords are missing, and which section to add them to",
        "A section-by-section fix list, ranked by impact",
        "Checked against how major ATS platforms — Workday, Greenhouse, Lever, and others — actually parse your file",
        "Live re-scoring as you edit inside the CV Builder",
      ]}
      beforeAfter={{
        before: "CV scores 38/100 against the job description — missing most of the required keywords.",
        after: "Same CV, rewritten with the missing terms in the right sections — scores 84/100.",
      }}
      outcomes={[
        "Know before you apply, not after a silent rejection",
        "Spend less time guessing what recruiters' software wants",
        "Apply with confidence to roles that match your CV",
      ]}
      faq={[
        {
          question: "Is this the same as the free ATS checker on the homepage?",
          answer: "Yes — this page describes the same tool. No signup is needed to try it.",
        },
        {
          question: "Does a high score guarantee an interview?",
          answer:
            "No — it means your CV won't be filtered out for missing keywords. The rest is still up to you.",
        },
        {
          question: "Which ATS platforms does it check against?",
          answer: "The major systems used by large employers, including Workday, Greenhouse, and Lever.",
        },
        {
          question: "How many scans do I get?",
          answer: "Unlimited, on every plan including Free.",
        },
      ]}
    />
  );
}
