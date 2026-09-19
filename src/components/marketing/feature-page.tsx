import type { LucideIcon } from "lucide-react";
import { Section } from "@/components/marketing/section";
import { SectionHeading } from "@/components/marketing/section-heading";
import { FeatureHero } from "@/components/marketing/feature-hero";
import { Capabilities, Outcomes } from "@/components/marketing/bullet-list";
import { BeforeAfter } from "@/components/marketing/before-after";
import { FeaturePlanAvailability } from "@/components/marketing/feature-plan-availability";
import { PlanCta } from "@/components/marketing/plan-cta";
import { RelatedTools } from "@/components/marketing/related-tools";
import { Faq, type FaqItem } from "@/components/marketing/faq";
import { getRelatedTools } from "@/config/tools";
import type { PlanTier } from "@/config/plans";

export function FeaturePage({
  slug,
  icon,
  eyebrow,
  title,
  description,
  plan,
  quickAnswer,
  demo,
  capabilities,
  beforeAfter,
  outcomes,
  faq,
}: {
  slug: string;
  icon: LucideIcon;
  eyebrow: string;
  title: string;
  description: string;
  plan: PlanTier;
  quickAnswer: string;
  demo?: React.ReactNode;
  capabilities: string[];
  beforeAfter: { before: string; after: string };
  outcomes: string[];
  faq: FaqItem[];
}) {
  const related = getRelatedTools(slug);

  return (
    <>
      <FeatureHero
        icon={icon}
        eyebrow={eyebrow}
        title={title}
        description={description}
        plan={plan}
        quickAnswer={quickAnswer}
        demo={demo}
      />

      <Section tone="muted">
        <SectionHeading eyebrow="What it does" title="Capabilities" />
        <div className="mt-12">
          <Capabilities items={capabilities} />
        </div>
      </Section>

      <Section>
        <SectionHeading eyebrow="See the difference" title="Before and after" />
        <div className="mt-12">
          <BeforeAfter {...beforeAfter} />
        </div>
      </Section>

      <Section tone="muted">
        <SectionHeading eyebrow="Plan availability" title="Which plan includes this" />
        <div className="mt-12">
          <FeaturePlanAvailability plan={plan} />
        </div>
      </Section>

      <Section>
        <SectionHeading eyebrow="Why it matters" title="Outcomes" />
        <div className="mt-12">
          <Outcomes items={outcomes} />
        </div>
      </Section>

      <Section tone="muted">
        <PlanCta plan={plan} />
      </Section>

      <Section>
        <SectionHeading eyebrow="Related tools" title="Works well with" />
        <div className="mt-12">
          <RelatedTools tools={related} />
        </div>
      </Section>

      <Section tone="muted">
        <SectionHeading eyebrow="FAQ" title="Questions about this tool" />
        <div className="mt-12">
          <Faq items={faq} />
        </div>
      </Section>
    </>
  );
}
