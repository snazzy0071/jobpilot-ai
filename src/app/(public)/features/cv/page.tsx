import { FileText } from "lucide-react";
import { FeaturePage } from "@/components/marketing/feature-page";
import { CvPreview } from "@/components/marketing/cv-preview";
import { buildMetadata } from "@/lib/seo/metadata";

export const metadata = buildMetadata({
  title: "CV Builder",
  description:
    "Templates that follow UK conventions — A4, no photo, two pages — with guided sections and an AI assist for the bullets that are hardest to write.",
  path: "/features/cv",
});

export default function CvBuilderPage() {
  return (
    <FeaturePage
      slug="cv"
      icon={FileText}
      eyebrow="CV Builder"
      title="A CV built for UK recruiters"
      description="Templates that follow UK conventions — A4, no photo, two pages — with guided sections and an AI assist for the bullets that are hardest to write."
      plan="free"
      quickAnswer="Yes — build a UK-standard CV for free, no card required."
      demo={<CvPreview />}
      capabilities={[
        "UK-standard templates by sector and experience level",
        "Guided sections — personal details, summary, experience, skills, and education",
        "AI-assisted bullet rewriting, with side-by-side suggestions you can accept, reject, or refine",
        "Live preview as you type, with automatic two-page and margin checks",
        "Built-in ATS pre-flight scoring against a specific job before you export",
        "Export as an ATS-friendly PDF when you're ready to apply",
      ]}
      beforeAfter={{
        before: "Worked on a data project with the team during placement.",
        after:
          "Built a Python pipeline that cut manual reporting from three hours to twelve minutes.",
      }}
      outcomes={[
        "A CV recruiters can scan in seconds, not minutes",
        "Fewer rejections from formatting mismatches",
        "One CV, tailored per application in minutes, not hours",
      ]}
      faq={[
        {
          question: "Do I need design skills?",
          answer: "No — pick a template and fill in guided sections. The layout is handled for you.",
        },
        {
          question: "Can I have more than one CV?",
          answer: "Yes, on paid plans. The free plan includes one saved CV.",
        },
        {
          question: "Does it check ATS compatibility too?",
          answer:
            "Yes — a built-in pre-flight score shows how a specific job's ATS might read your CV before you export it.",
        },
        {
          question: "What file format do I get?",
          answer: "A polished, ATS-friendly PDF.",
        },
      ]}
    />
  );
}
