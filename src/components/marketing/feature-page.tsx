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
import { JsonLd } from "@/components/seo/json-ld";
import { siteConfig } from "@/config/site";
import { getRelatedTools } from "@/config/tools";
import { getPublicPlans } from "@/lib/plans/public-plans";
import { minPlanForTool } from "@/lib/plans/plan-features";
import { PLAN_LABELS, PLAN_ORDER, type PlanTier } from "@/config/plans";

export async function FeaturePage({
  slug,
  icon,
  eyebrow,
  title,
  description,
  plan: planFallback,
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
  // Which plan includes this tool is read from the plans table (what the server enforces); the page's own value is only a fallback if that read fails.
  const derived = minPlanForTool(slug, await getPublicPlans());
  const plan: PlanTier = derived && (PLAN_ORDER as readonly string[]).includes(derived) ? (derived as PlanTier) : planFallback;
  const url = `${siteConfig.domain}/features/${slug}`;
  // The pages' quick answers open with "From <plan> — ..."; the plan named there is the one the plans table says (see above), not a typed-in guess.
  const quickAnswerText = plan === "free" ? quickAnswer.replace(/^From \w+ — /, "") : quickAnswer.replace(/^From \w+ — /, `From ${PLAN_LABELS[plan]} — `);

  return (
    <>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "WebApplication",
          name: `${siteConfig.name}: ${title}`,
          url,
          description,
          applicationCategory: "BusinessApplication",
          operatingSystem: "Web",
          areaServed: "GB",
          featureList: capabilities,
          isPartOf: { "@id": `${siteConfig.domain}/#website` },
          offers: { "@type": "Offer", price: "0", priceCurrency: "GBP", description: "Free plan available" },
        }}
      />
      <FeatureHero
        icon={icon}
        eyebrow={eyebrow}
        title={title}
        description={description}
        plan={plan}
        quickAnswer={quickAnswerText}
        demo={demo}
      />

      <Section tone="muted">
        <SectionHeading eyebrow="What it does" title="Capabilities" />
        <div className="mt-12">
          <Capabilities items={capabilities} />
        </div>
      </Section>

      <Section tone="aurora">
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

      <Section tone="aurora">
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
