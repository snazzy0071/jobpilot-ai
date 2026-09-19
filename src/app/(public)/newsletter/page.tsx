import Link from "next/link";
import { BellOffIcon, InboxIcon, LightbulbIcon, MegaphoneIcon, SparklesIcon } from "lucide-react";
import { PageHero } from "@/components/marketing/page-hero";
import { GradientText } from "@/components/marketing/gradient-text";
import { MockWindow } from "@/components/marketing/mock-window";
import { Line } from "@/components/marketing/wireframe-line";
import { Section } from "@/components/marketing/section";
import { SectionHeading } from "@/components/marketing/section-heading";
import { FeatureCard } from "@/components/marketing/feature-card";
import { FloatingChip } from "@/components/marketing/floating-chip";
import { NewsletterForm } from "@/components/newsletter/newsletter-form";
import { buildMetadata } from "@/lib/seo/metadata";

export const metadata = buildMetadata({
  title: "Newsletter",
  description: "Occasional emails on new features and career tips — no account needed, unsubscribe anytime.",
  path: "/newsletter",
});

const TOPICS = [
  {
    icon: MegaphoneIcon,
    title: "New features",
    description: "What's shipped in the toolkit, in a couple of lines each.",
  },
  {
    icon: LightbulbIcon,
    title: "Career tips",
    description: "Practical, UK-specific advice on CVs, applications and interviews.",
  },
  {
    icon: BellOffIcon,
    title: "Low volume",
    description: "Occasional, not weekly. Unsubscribe in one click, any time.",
  },
];

function EmailMockup() {
  return (
    <div className="relative mx-auto w-full max-w-md">
      <MockWindow title="Inbox">
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-3">
            <span className="gradient-brand flex size-9 items-center justify-center rounded-full text-white">
              <InboxIcon className="size-4" />
            </span>
            <div className="flex flex-col gap-1.5">
              <Line width="1/2" />
              <Line width="3/4" />
            </div>
          </div>
          <div className="flex flex-col gap-2 rounded-xl border bg-background p-4">
            <p className="text-xs font-medium tracking-wide text-primary uppercase">This issue</p>
            <p className="text-sm font-semibold">A career tip, a new feature, one useful link</p>
            <Line width="full" />
            <Line width="full" />
            <Line width="3/4" />
          </div>
          <div className="flex flex-wrap gap-2">
            {["Tip", "What's new", "Unsubscribe anytime"].map((label) => (
              <span key={label} className="rounded-full bg-muted px-3 py-1 text-xs text-muted-foreground">
                {label}
              </span>
            ))}
          </div>
        </div>
      </MockWindow>
      <FloatingChip className="-top-4 -right-3 sm:-right-8" delay={0.5}>
        <div className="flex items-center gap-2">
          <span className="flex size-7 items-center justify-center rounded-full bg-primary/10 text-primary">
            <SparklesIcon className="size-3.5" />
          </span>
          <p className="text-xs font-medium">No account needed</p>
        </div>
      </FloatingChip>
    </div>
  );
}

export default function NewsletterPage() {
  return (
    <>
      <PageHero
        eyebrow="Newsletter"
        title={
          <>
            Career tips in <GradientText>your inbox</GradientText>
          </>
        }
        description="Occasional emails on new features and career tips. No account needed, unsubscribe anytime."
        actions={
          <div className="flex w-full max-w-md flex-col gap-4 rounded-2xl border bg-card/80 p-4 text-left shadow-elevated backdrop-blur-sm">
            <NewsletterForm />
            <p className="text-center text-sm text-muted-foreground">
              Already have an account?{" "}
              <Link href="/dashboard/settings" className="text-foreground underline">
                Opt in from your settings
              </Link>{" "}
              instead.
            </p>
          </div>
        }
        visual={<EmailMockup />}
      />

      <Section tone="muted">
        <SectionHeading eyebrow="What to expect" title="Short, useful, and not too often" />
        <div className="mt-12 grid gap-6 md:grid-cols-3">
          {TOPICS.map((topic, index) => (
            <FeatureCard key={topic.title} {...topic} index={index} />
          ))}
        </div>
      </Section>
    </>
  );
}
