import { Target } from "lucide-react";
import { FeaturePage } from "@/components/marketing/feature-page";
import { JobMatchPreview } from "@/components/marketing/job-match-preview";
import { buildMetadata } from "@/lib/seo/metadata";

export const metadata = buildMetadata({
  title: "Job Match",
  description: "Live UK job listings scored against your CV, so you can focus on roles worth your time.",
  path: "/features/jobmatch",
});

export default function JobMatchPage() {
  return (
    <FeaturePage
      slug="jobmatch"
      icon={Target}
      eyebrow="Job Match"
      title="Apply where you actually fit"
      description="Live UK job listings scored against your CV, so you can focus on roles worth your time."
      plan="premium"
      quickAnswer="From Premium — see live UK job listings scored against your CV, with sponsor status shown."
      demo={<JobMatchPreview />}
      capabilities={[
        "Live UK job listings, refreshed daily rather than a once-a-week batch",
        "Every role scored against your CV across skills, tech stack, domain, and seniority",
        "Sponsor status shown on every listing, not something you look up separately",
        "Filter by match score, location, and sector",
        "Send a match straight to your tracker in one click, with the score attached",
      ]}
      beforeAfter={{
        before: "Scrolling through 200 listings a day, most of them irrelevant.",
        after: "A shortlist of roles actually worth 20 minutes of your time.",
      }}
      outcomes={[
        "Spend time applying, not searching",
        "Fewer applications to roles that were never realistic",
        "Sponsor status known before you apply, not after an offer falls through",
      ]}
      faq={[
        {
          question: "Where do listings come from?",
          answer: "Live UK job feeds, refreshed regularly rather than once a week.",
        },
        {
          question: "Does a sponsor badge guarantee sponsorship for that role?",
          answer:
            "No — it means the employer holds a licence. Always confirm the specific role is sponsored.",
        },
        {
          question: "How is the match score worked out?",
          answer:
            "Across four dimensions — core skills, technical stack, domain relevance, and seniority — compared against your CV.",
        },
        {
          question: "Can I track a match?",
          answer: "Yes — one click adds it to your Job Tracker with the match score attached.",
        },
      ]}
    />
  );
}
