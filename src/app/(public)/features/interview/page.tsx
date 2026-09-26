import { MessagesSquare } from "lucide-react";
import { FeaturePage } from "@/components/marketing/feature-page";
import { InterviewFeedbackPreview } from "@/components/marketing/interview-feedback-preview";
import { siteConfig } from "@/config/site";
import { buildMetadata } from "@/lib/seo/metadata";

export const metadata = buildMetadata({
  title: "Interview Coach",
  description: `Work through realistic competency-style interview questions with ${siteConfig.aiCoachName}, and get feedback on how you answered.`,
  path: "/features/interview",
});

export default function InterviewCoachPage() {
  return (
    <FeaturePage
      slug="interview"
      icon={MessagesSquare}
      eyebrow="Interview Coach"
      title="Practise before it counts"
      description={`Work through realistic competency-style interview questions with ${siteConfig.aiCoachName}, and get feedback on how you answered.`}
      plan="premium"
      quickAnswer="From Premium — practise competency-based interview questions and get feedback on your answers."
      demo={<InterviewFeedbackPreview />}
      capabilities={[
        'UK-style competency questions — "Tell me about a time..." not US-style case interviews',
        "Sector-targeted question packs across consulting, banking, law, and public sector",
        "Feedback broken down against the STAR structure — situation, task, action, result, reflection",
        "A session summary scored across clarity, structure, keywords, and relevance",
        "Voice-based practice with spoken questions, with a monthly allowance on Premium and a larger one on Elite",
      ]}
      beforeAfter={{
        before: '"I worked on a few projects and helped the team out."',
        after:
          '"I led three people to redesign our onboarding flow — signups went from a five-step form to two, and I measured the drop-off before and after."',
      }}
      outcomes={[
        "Answers structured well enough to hold a recruiter's attention",
        "Less blanking under pressure, because you've said it before",
        "A clear view of your weakest area, not just a vague sense of it",
      ]}
      faq={[
        {
          question: "Is this US-style behavioural interviewing?",
          answer: "No — it's built around UK competency-based formats.",
        },
        {
          question: "What does the feedback actually show me?",
          answer:
            "A breakdown against the STAR structure, plus a session score across clarity, structure, keywords, and relevance.",
        },
        {
          question: "Do I need a microphone?",
          answer:
            "Only for voice practice, which has a monthly allowance on Premium and Elite. Text-based practice needs nothing extra.",
        },
        {
          question: "Can I revisit a weak answer?",
          answer: "Yes — replay and retry any question.",
        },
      ]}
    />
  );
}
