import Link from "next/link";
import { BriefcaseIcon, InfinityIcon, ScanSearchIcon, ShieldCheckIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Section } from "@/components/marketing/section";
import { SectionHeading } from "@/components/marketing/section-heading";
import { PageHero } from "@/components/marketing/page-hero";
import { GradientText } from "@/components/marketing/gradient-text";
import { StatStrip } from "@/components/marketing/stat-strip";
import { CtaSection } from "@/components/marketing/cta-section";
import { Badge } from "@/components/ui/badge";
import { PricingTiers } from "@/components/marketing/pricing-tiers";
import { ComparisonTable, type ComparisonColumn, type ComparisonRow } from "@/components/marketing/comparison-table";
import { Faq } from "@/components/marketing/faq";
import { siteConfig } from "@/config/site";
import { PLAN_LABELS } from "@/config/plans";
import { buildMetadata } from "@/lib/seo/metadata";

export const metadata = buildMetadata({
  title: "Pricing",
  description:
    "Free, Pro, Premium, and Elite plans for the JobPilot AI career toolkit — every account is free today, with paid plans launching soon.",
  path: "/pricing",
});

const COLUMNS: ComparisonColumn[] = [
  { id: "free", label: PLAN_LABELS.free },
  { id: "pro", label: PLAN_LABELS.pro },
  { id: "premium", label: PLAN_LABELS.premium, highlighted: true },
  { id: "elite", label: PLAN_LABELS.elite },
];

const ROWS: ComparisonRow[] = [
  { label: "CV Builder", values: { free: "1 CV", pro: "Unlimited", premium: "Unlimited", elite: "Unlimited" } },
  { label: "ATS Scanner", values: { free: true, pro: true, premium: true, elite: true } },
  { label: "Cover Letter Generator", values: { free: false, pro: true, premium: true, elite: true } },
  { label: "LinkedIn Optimiser", values: { free: false, pro: true, premium: true, elite: true } },
  { label: "Interview Coach (text)", values: { free: false, pro: false, premium: true, elite: true } },
  { label: "Voice Interview Coach", values: { free: false, pro: false, premium: true, elite: true } },
  { label: "Job Match Engine", values: { free: false, pro: false, premium: true, elite: true } },
  { label: "Grad Scheme Prep", values: { free: false, pro: false, premium: true, elite: true } },
  { label: "Job Tracker", values: { free: true, pro: true, premium: true, elite: true } },
  { label: "UK Visa Sponsor Register", values: { free: true, pro: true, premium: true, elite: true } },
  { label: "Support", values: { free: "Email", pro: "Email", premium: "Email", elite: "Priority" } },
];

const FAQ_ITEMS = [
  {
    question: "Is JobPilot AI free?",
    answer:
      "Yes — every account today is on the free plan. The paid plans shown above are a preview of what's launching; nothing is charged yet.",
  },
  {
    question: "When do paid plans launch?",
    answer:
      "We don't have an exact date yet. Create an account and opt into emails during signup to hear first.",
  },
  {
    question: "Will I be charged automatically?",
    answer: "No. There's no billing integration live yet, so there's nothing to be charged for. We'll always ask before taking payment.",
  },
  {
    question: "What's the difference between monthly and annual billing?",
    answer: "Once billing launches, annual billing will work out cheaper than paying monthly — toggle above to compare.",
  },
  {
    question: "Can I change plans later?",
    answer: "Yes — switching plans up or down will be possible at any time once billing is live.",
  },
];

export default function PricingPage() {
  return (
    <>
      <PageHero
        badge={<Badge variant="secondary">Paid plans launching soon</Badge>}
        eyebrow="Pricing"
        title={
          <>
            Plans for <GradientText>every stage</GradientText> of your search
          </>
        }
        description="Start free. The plans below are a preview of what's coming — everyone is on Free today."
        className="pb-4 sm:pb-8"
      />

      <Section className="pt-0 sm:pt-0">
        <PricingTiers />
        <div className="mt-14">
          <p className="mb-4 text-center text-xs font-semibold tracking-widest text-muted-foreground uppercase">
            Every account includes
          </p>
          <StatStrip
            items={[
              { icon: ScanSearchIcon, title: "Unlimited ATS scans", caption: "Check any CV against any job" },
              { icon: BriefcaseIcon, title: "Job Tracker", caption: "Every application in one board" },
              { icon: ShieldCheckIcon, title: "Sponsor register search", caption: "UK Home Office data" },
              { icon: InfinityIcon, title: "No card to start", caption: "Nothing is charged today" },
            ]}
          />
        </div>
      </Section>

      <Section>
        <SectionHeading eyebrow="Compare plans" title="What's included" />
        <div className="mt-12">
          <ComparisonTable columns={COLUMNS} rows={ROWS} />
        </div>
      </Section>

      <Section tone="muted">
        <SectionHeading eyebrow="FAQ" title="Pricing questions" />
        <div className="mt-12">
          <Faq items={FAQ_ITEMS} />
        </div>
        <p className="mt-8 text-center text-sm text-muted-foreground">
          Anything else?{" "}
          <a href={`mailto:${siteConfig.supportEmail}`} className="text-foreground underline">
            Get in touch
          </a>
          .
        </p>
      </Section>

      <CtaSection title="Start free today" description="Create an account in a minute. Upgrade if and when paid plans launch.">
        <Button size="lg" variant="secondary" render={<Link href="/signup">Create free account</Link>} />
      </CtaSection>
    </>
  );
}
