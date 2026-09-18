import { GraduationCap } from "lucide-react";
import { FeaturePage } from "@/components/marketing/feature-page";
import { GradPrepPreview } from "@/components/marketing/grad-prep-preview";
import { buildMetadata } from "@/lib/seo/metadata";

export const metadata = buildMetadata({
  title: "Grad Scheme Prep",
  description: "Sector-targeted practice for the aptitude tests graduate schemes actually use — original questions, real formats.",
  path: "/features/gradprep",
});

export default function GradSchemePrepPage() {
  return (
    <FeaturePage
      slug="gradprep"
      icon={GraduationCap}
      eyebrow="Grad Scheme Prep"
      title="Practise the tests, not just the interview"
      description="Sector-targeted practice for the aptitude tests graduate schemes actually use — original questions, real formats."
      plan="premium"
      quickAnswer="From Premium — practise five test formats in sector-specific packs, with streaks, accuracy tracking, and weak-spot analysis."
      demo={<GradPrepPreview />}
      capabilities={[
        "Five formats: critical thinking, situational judgement, numerical, verbal, and diagrammatic reasoning",
        "Sector packs for consulting, banking & finance, law, technology, and public sector schemes",
        "Timed practice that mirrors the pacing of the real thing",
        "A weak-spot view that shows exactly which question type is holding your score back",
        "Daily streaks and an accuracy curve so you can see improvement, not just guess at it",
      ]}
      beforeAfter={{
        before: "Walking into a numerical reasoning test having never seen the format before.",
        after: "Recognising the question types and pacing because you've practised them daily.",
      }}
      outcomes={[
        "Less time lost to an unfamiliar format on test day",
        "A clear view of your weak spots before the real test, not after",
        "Practice that matches what schemes actually use, not generic puzzles",
      ]}
      faq={[
        {
          question: "Are these the real test questions?",
          answer:
            "No — original questions built to the same formats. We never copy proprietary test content.",
        },
        {
          question: "Which test types are covered?",
          answer:
            "Critical thinking, situational judgement, numerical reasoning, verbal reasoning, and diagrammatic reasoning.",
        },
        {
          question: "What are sector packs?",
          answer:
            "Question sets weighted toward the formats and difficulty a given sector — consulting, banking, law, tech, or public sector — actually uses.",
        },
        {
          question: "How does the streak and accuracy tracking work?",
          answer:
            "Daily practice builds a streak, and every session updates an accuracy curve per test type, so you can see which format needs more work.",
        },
        {
          question: "Is this free?",
          answer: "No — it's part of Premium and above.",
        },
      ]}
    />
  );
}
