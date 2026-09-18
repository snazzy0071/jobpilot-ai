import { Kanban } from "lucide-react";
import { FeaturePage } from "@/components/marketing/feature-page";
import { JobTrackerPreview } from "@/components/marketing/job-tracker-preview";
import { buildMetadata } from "@/lib/seo/metadata";

export const metadata = buildMetadata({
  title: "Job Tracker",
  description: "Track every application from wishlist to offer, so you know exactly where things stand.",
  path: "/features/tracker",
});

export default function JobTrackerPage() {
  return (
    <FeaturePage
      slug="tracker"
      icon={Kanban}
      eyebrow="Job Tracker"
      title="See your pipeline, not just a spreadsheet"
      description="Track every application from wishlist to offer, so you know exactly where things stand."
      plan="free"
      quickAnswer="Yes — track every application from wishlist to offer, free."
      demo={<JobTrackerPreview />}
      capabilities={[
        "A six-stage board — Wishlist, Applied, Interview, Offer, Rejected, Withdrawn",
        "Sponsor status shown on every card, cross-checked against the UK Home Office register",
        "A match-score snapshot frozen at the moment you applied, so it can't be skewed later",
        "The exact CV version you sent, linked to each application",
        "Stage history so you can see your own funnel, not just the current state",
      ]}
      beforeAfter={{
        before: "A spreadsheet with three different date formats and half the rows out of date.",
        after: "A board where every application's stage, sponsor status, and CV version is one glance away.",
      }}
      outcomes={[
        "Never lose track of where an application actually stands",
        "See your real applied-to-interview ratio, not a guess",
        "Know exactly which CV version you sent before a callback",
      ]}
      faq={[
        {
          question: "Can I add applications I made elsewhere?",
          answer: "Yes — add any application manually, whenever you applied.",
        },
        {
          question: "Does it apply for me?",
          answer: "No — it tracks applications you've made; it doesn't submit them.",
        },
        {
          question: "Why does the match score stay fixed after I apply?",
          answer:
            "It's a snapshot from the moment of application, so later CV or job changes can't retroactively change your funnel history.",
        },
        {
          question: "Is this free?",
          answer: "Yes, on every plan including Free.",
        },
      ]}
    />
  );
}
