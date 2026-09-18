import { IdCard } from "lucide-react";
import { FeaturePage } from "@/components/marketing/feature-page";
import { LinkedInPreview } from "@/components/marketing/linkedin-preview";
import { buildMetadata } from "@/lib/seo/metadata";

export const metadata = buildMetadata({
  title: "LinkedIn Optimiser",
  description: "Rewrite your headline, about section, and experience so your profile matches how UK recruiters actually search.",
  path: "/features/linkedin",
});

export default function LinkedInOptimiserPage() {
  return (
    <FeaturePage
      slug="linkedin"
      icon={IdCard}
      eyebrow="LinkedIn Optimiser"
      title="Show up when recruiters search"
      description="Rewrite your headline, about section, and experience so your profile matches how UK recruiters actually search."
      plan="pro"
      quickAnswer="From Pro — rewrite your headline, about section, and experience to match how UK recruiters search."
      demo={<LinkedInPreview />}
      capabilities={[
        "Three headline variants — concise, narrative, and keyword-dense — for your target role and seniority, no LinkedIn sign-in needed",
        "About section rebuilt around who you are, what you do, and what you want next",
        "Experience bullets rewritten to match LinkedIn's voice, not just copied from your CV",
        "Regenerate and Accept or Reject any rewrite individually, with a before/after preview each time",
        "Side-by-side before/after for every change, with a one-tap copy so you paste it into LinkedIn yourself",
        "Recruiter-search keyword coverage — found and missing terms, where to add each one, and a before/after score",
        "Skills to add, based only on what your pasted profile actually evidences",
      ]}
      beforeAfter={{
        before: "Student at University of Manchester",
        after: "Data Analytics Graduate | Python, SQL, Power BI | Open to Graduate Roles in London",
      }}
      outcomes={[
        "Show up when recruiters actually search",
        "A profile that matches your CV, not a stale summary",
        "Nothing changes on LinkedIn until you say so",
      ]}
      faq={[
        {
          question: "Does it post anything automatically?",
          answer: "No — there's no LinkedIn account connection at all. You copy the rewrite and paste it into LinkedIn yourself.",
        },
        {
          question: "Do I need to connect my LinkedIn account?",
          answer: "No — paste your current headline, About, and Experience text in, and choose a target role and seniority.",
        },
        {
          question: "Is this included in the free plan?",
          answer: "No — it's part of Pro and above.",
        },
      ]}
    />
  );
}
