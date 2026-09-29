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
import { Faq, type FaqItem } from "@/components/marketing/faq";
import { JsonLd } from "@/components/seo/json-ld";
import { siteConfig } from "@/config/site";
import { getPublicPlans, isBillingConfigured } from "@/lib/plans/public-plans";
import { comparisonRows, formatPounds } from "@/lib/plans/plan-features";
import { buildMetadata } from "@/lib/seo/metadata";

export const metadata = buildMetadata({
  title: "Pricing",
  description:
    "Free, Pro, Premium and Elite plans for the JobPilot AI career toolkit: what each one includes, monthly and annual prices, and how billing works.",
  path: "/pricing",
});

// Plans, prices and what each includes are read from the `plans` table (the entitlements the server enforces), never typed
// here. getPublicPlans() already reads through a cookie-free anon client with its own 5-minute unstable_cache
// (src/lib/plans/public-plans.ts) — matched here so the whole page (not just that one query) is ISR instead of fully
// dynamic. isBillingConfigured() reads process.env, which is fixed for the life of the deployment, not something that
// needs re-evaluating on every request either.
export const revalidate = 300;

function faqItems(billingLive: boolean): FaqItem[] {
  return billingLive
    ? [
        { question: "Is JobPilot AI free?", answer: "Yes. Every account starts on the Free plan with no card. Paid plans add more tools and higher limits, and you can subscribe from Settings, Billing once you have an account." },
        { question: "Will I be charged automatically?", answer: "Paid plans renew automatically each month or year until you cancel. You can cancel at any time in Settings, Billing and keep your plan until the end of the period you have paid for." },
        { question: "What's the difference between monthly and annual billing?", answer: "Annual billing costs less than twelve monthly payments; the saving is shown on the toggle above. You can switch between them in Settings, Billing." },
        { question: "Can I change plans later?", answer: "Yes. Move up or down at any time in Settings, Billing. Stripe prorates the difference so you only pay for what you use." },
        { question: "What happens if a payment fails?", answer: "Your plan stays active while Stripe retries the payment. We email you, and you can update your card from Manage billing. If it still can't be collected the subscription ends and you return to the Free plan." },
        { question: "Does my university or employer plan replace this?", answer: "If your institution gives you a licence you get its plan while the licence is in force. If you also pay for a plan yourself, the higher of the two applies." },
      ]
    : [
        { question: "Is JobPilot AI free?", answer: "Yes. Every account is on the Free plan today. The paid plans shown above are a preview of what's coming, and nothing is charged yet." },
        { question: "When do paid plans launch?", answer: "We don't have an exact date yet. Create an account and opt into emails during signup to hear first." },
        { question: "Will I be charged automatically?", answer: "No. Billing isn't switched on yet, so there's nothing to be charged for. We'll always ask before taking payment." },
        { question: "What's the difference between monthly and annual billing?", answer: "Once billing launches, annual billing will work out cheaper than paying monthly. Use the toggle above to compare." },
        { question: "Can I change plans later?", answer: "Yes. Switching plans up or down will be possible at any time once billing is live." },
      ];
}

export default async function PricingPage() {
  const plans = await getPublicPlans();
  const billingLive = isBillingConfigured();
  const free = plans.find((plan) => plan.monthlyPence === 0) ?? null;
  const columns: ComparisonColumn[] = plans.map((plan) => ({ id: plan.slug, label: plan.name, highlighted: plan.slug === "premium" }));
  const rows: ComparisonRow[] = comparisonRows(plans);
  const freeQuickScans = free?.entitlements.quick_ats_scans_per_month;
  const freeScansCaption =
    freeQuickScans === null ? "Unlimited quick scans" : typeof freeQuickScans === "number" && freeQuickScans > 0 ? `${freeQuickScans} quick scans a month` : null;

  return (
    <>
      <PageHero
        badge={billingLive ? undefined : <Badge variant="secondary">Paid plans launching soon</Badge>}
        eyebrow="Pricing"
        title={
          <>
            Plans for <GradientText>every stage</GradientText> of your search
          </>
        }
        description={
          billingLive
            ? "Start free and upgrade when you need more. Cancel or change plan at any time."
            : "Start free. The plans below are a preview of what's coming — everyone is on Free today."
        }
        className="pb-4 sm:pb-8"
      />

      <Section className="pt-0 sm:pt-0">
        {plans.length > 0 ? (
          <PricingTiers plans={plans} />
        ) : (
          <p className="text-center text-muted-foreground">Plan details couldn&apos;t be loaded right now. Please try again in a moment.</p>
        )}
        {free && (
          <div className="mt-14">
            <p className="mb-4 text-center text-xs font-semibold tracking-widest text-muted-foreground uppercase">Every account includes</p>
            <StatStrip
              items={[
                ...(freeScansCaption ? [{ icon: ScanSearchIcon, title: "ATS scanner", caption: freeScansCaption }] : []),
                ...(free.entitlements.job_tracker === true ? [{ icon: BriefcaseIcon, title: "Job Tracker", caption: "Every application in one board" }] : []),
                ...(free.entitlements.visa_sponsor_register === true ? [{ icon: ShieldCheckIcon, title: "Sponsor register search", caption: "UK Home Office data" }] : []),
                { icon: InfinityIcon, title: "No card to start", caption: billingLive ? "Upgrade only if you want to" : "Nothing is charged today" },
              ]}
            />
          </div>
        )}
      </Section>

      {plans.length > 0 && (
        <Section>
          <SectionHeading eyebrow="Compare plans" title="What's included" />
          <div className="mt-12">
            <ComparisonTable columns={columns} rows={rows} />
          </div>
        </Section>
      )}

      <Section tone="muted">
        <SectionHeading eyebrow="FAQ" title="Pricing questions" />
        <div className="mt-12">
          <Faq items={faqItems(billingLive)} />
        </div>
        <p className="mt-8 text-center text-sm text-muted-foreground">
          Anything else?{" "}
          <a href={`mailto:${siteConfig.supportEmail}`} className="text-foreground underline">
            Get in touch
          </a>
          .
        </p>
      </Section>

      {plans.length > 0 && (
        <JsonLd
          data={{
            "@context": "https://schema.org",
            "@type": "Product",
            name: `${siteConfig.name} plans`,
            url: `${siteConfig.domain}/pricing`,
            description: "UK career toolkit plans: CV builder, ATS scanner, interview coach, job tracker and the UK visa sponsor register.",
            brand: { "@type": "Brand", name: siteConfig.name },
            offers: plans.map((plan) => ({
              "@type": "Offer",
              name: plan.name,
              price: (plan.monthlyPence / 100).toString(),
              priceCurrency: "GBP",
              // Paid plans are marked pre-order until checkout is configured; the Free plan is always available.
              availability: plan.monthlyPence === 0 || billingLive ? "https://schema.org/InStock" : "https://schema.org/PreOrder",
              url: plan.monthlyPence === 0 ? `${siteConfig.domain}/signup` : `${siteConfig.domain}/pricing`,
              description: plan.monthlyPence === 0 ? "Free plan" : `${formatPounds(plan.monthlyPence)} a month or ${formatPounds(plan.annualPence)} a year`,
            })),
          }}
        />
      )}

      <CtaSection
        title="Start free today"
        description={billingLive ? "Create an account in a minute and upgrade whenever you're ready." : "Create an account in a minute. Upgrade if and when paid plans launch."}
        points={billingLive ? ["No card required", "Cancel any time"] : ["No card required", "Nothing is charged today"]}
      >
        <Button size="lg" variant="secondary" render={<Link href="/signup">Create free account</Link>} />
      </CtaSection>
    </>
  );
}
