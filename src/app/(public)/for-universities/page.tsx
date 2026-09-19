import Link from "next/link";
import { KeySquare, Users, BarChart3, Globe, Layers, FileText, ShieldCheck, LockKeyholeIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHero } from "@/components/marketing/page-hero";
import { GradientText } from "@/components/marketing/gradient-text";
import { MockWindow } from "@/components/marketing/mock-window";
import { FloatingChip } from "@/components/marketing/floating-chip";
import { AnimatedBar } from "@/components/dashboard/animated-bar";
import { Section } from "@/components/marketing/section";
import { SectionHeading } from "@/components/marketing/section-heading";
import { FeatureCard } from "@/components/marketing/feature-card";
import { JourneySteps } from "@/components/marketing/journey-steps";
import { Faq } from "@/components/marketing/faq";
import { CtaSection } from "@/components/marketing/cta-section";
import { buildMetadata } from "@/lib/seo/metadata";

export const metadata = buildMetadata({
  title: "For Universities",
  description:
    "One UK-first career toolkit for your entire cohort, licensed per institution — CV Builder, ATS Scanner, Interview Coach, and the UK visa sponsor register.",
  path: "/for-universities",
});

const LICENSING_FACTS = [
  {
    icon: KeySquare,
    title: "Access-code seats",
    description: "Students join with an access code your institution provides — no per-student billing.",
  },
  {
    icon: Users,
    title: "Built for cohorts",
    description: "Licensed per institution, not per feature — every student gets the full toolkit.",
  },
  {
    icon: BarChart3,
    title: "Privacy-safe reporting",
    description: "Aggregate engagement visibility for your team, never an individual student's activity.",
  },
];

const FEATURES = [
  {
    icon: Globe,
    title: "International student support",
    description: "The UK visa sponsor register is built into the toolkit, so international students can filter for realistic employers from day one.",
    href: "/visa-sponsors",
  },
  {
    icon: Layers,
    title: "One flat toolkit",
    description: "CV Builder, ATS Scanner, Interview Coach, and Cover Letters — no separate subscriptions for your students to juggle.",
    href: "/pricing",
  },
  {
    icon: FileText,
    title: "UK-first throughout",
    description: "UK CV formats, UK terminology, and UK visa routes — not a US product with the spelling changed.",
    href: "/features/cv",
  },
  {
    icon: ShieldCheck,
    title: "GDPR compliance built in",
    description: "Students can export or delete their own data at any time, right from their account settings.",
    href: "/privacy",
  },
];

const STEPS = [
  { title: "Request a demo", description: "Tell us about your institution and cohort size." },
  { title: "We confirm a seat block", description: "Sized to your student numbers, billed to your institution." },
  { title: "Share your access code", description: "One code for your students to redeem at signup." },
  { title: "Students sign up free", description: "Full toolkit, no card required, no individual billing." },
];

const FAQ_ITEMS = [
  {
    question: "How do students get access?",
    answer:
      "With an access code your institution provides — they enter it during signup instead of subscribing, and get the full toolkit free.",
  },
  {
    question: "Can you see individual student data?",
    answer:
      "No — a student's account stays private to them. Our model is aggregate reporting for your team, not visibility into individual activity.",
  },
  {
    question: "Is this live today?",
    answer:
      "We're onboarding institutions individually right now — request a demo and we'll walk you through exactly what's ready and what's still being built.",
  },
  {
    question: "What does it cost?",
    answer: "Seat-based pricing that scales with your cohort size — request a demo for a quote.",
  },
];

function CohortPreview() {
  return (
    <div className="relative mx-auto w-full max-w-md">
      <MockWindow title="Institution dashboard · illustrative">
        <div className="flex flex-col gap-5">
          <div className="flex items-center justify-between rounded-xl border bg-background p-3">
            <div className="flex items-center gap-3">
              <span className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <KeySquare className="size-4" />
              </span>
              <div>
                <p className="text-xs text-muted-foreground">Cohort access code</p>
                <p className="font-mono text-sm font-semibold tracking-widest">•••• ••••</p>
              </div>
            </div>
            <span className="rounded-full bg-success/10 px-2.5 py-1 text-[11px] font-medium text-success">Active</span>
          </div>

          <div className="flex flex-col gap-3">
            <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Aggregate engagement</p>
            {[
              { label: "CV Builder", value: 82 },
              { label: "ATS Scanner", value: 64 },
              { label: "Interview Coach", value: 48 },
            ].map((row) => (
              <div key={row.label} className="flex flex-col gap-1">
                <span className="text-xs">{row.label}</span>
                <AnimatedBar value={row.value} />
              </div>
            ))}
          </div>
        </div>
      </MockWindow>
      <FloatingChip className="-right-3 -bottom-5 sm:-right-8" delay={0.5}>
        <div className="flex items-center gap-2">
          <span className="flex size-7 items-center justify-center rounded-full bg-primary/10 text-primary">
            <LockKeyholeIcon className="size-3.5" />
          </span>
          <p className="text-xs font-medium">Never individual students</p>
        </div>
      </FloatingChip>
    </div>
  );
}

export default function ForUniversitiesPage() {
  return (
    <>
      <PageHero
        eyebrow="For Universities"
        title={
          <>
            Career tools for your <GradientText>entire cohort</GradientText>
          </>
        }
        description="One UK-first toolkit for CVs, applications, interviews, and visa sponsorship — licensed per institution, not per student."
        actions={
          <>
            <Button size="lg" variant="gradient" render={<Link href="/demo">Request a demo</Link>} />
            <Button size="lg" variant="outline" render={<Link href="/partners">Other partners</Link>} />
          </>
        }
        visual={<CohortPreview />}
      />

      <Section className="pt-0">
        <div className="mx-auto grid max-w-4xl gap-6 sm:grid-cols-3">
          {LICENSING_FACTS.map((fact, index) => (
            <FeatureCard key={fact.title} {...fact} index={index} />
          ))}
        </div>
      </Section>

      <Section tone="muted">
        <SectionHeading eyebrow="What's included" title="Everything your students need, in one place" />
        <div className="mt-12 grid gap-6 sm:grid-cols-2">
          {FEATURES.map((feature, index) => (
            <FeatureCard key={feature.title} {...feature} index={index} />
          ))}
        </div>
      </Section>

      <Section>
        <SectionHeading eyebrow="How it works" title="From first conversation to student access" />
        <div className="mt-14">
          <JourneySteps steps={STEPS} />
        </div>
      </Section>

      <Section tone="muted">
        <SectionHeading eyebrow="FAQ" title="Questions from careers teams" />
        <div className="mt-12">
          <Faq items={FAQ_ITEMS} />
        </div>
      </Section>

      <CtaSection title="Talk to us about your institution" description="Tell us about your cohort and we'll walk you through what's possible.">
        <Button size="lg" variant="secondary" render={<Link href="/demo">Request a demo</Link>} />
      </CtaSection>
    </>
  );
}
