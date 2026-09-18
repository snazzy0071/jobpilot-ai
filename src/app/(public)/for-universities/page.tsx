import Link from "next/link";
import { KeySquare, Users, BarChart3, Globe, Layers, FileText, ShieldCheck } from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Eyebrow } from "@/components/marketing/eyebrow";
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

export default function ForUniversitiesPage() {
  return (
    <>
      <Section className="bg-gradient-to-b from-primary/5 via-background to-background pt-24 pb-12 sm:pt-32">
        <div className="mx-auto flex max-w-2xl flex-col items-center gap-4 text-center">
          <Eyebrow>For Universities</Eyebrow>
          <h1 className="font-heading text-4xl font-semibold tracking-tight sm:text-5xl">
            Career tools for your entire cohort
          </h1>
          <p className="max-w-xl text-lg text-muted-foreground">
            One UK-first toolkit for CVs, applications, interviews, and visa sponsorship —
            licensed per institution, not per student.
          </p>
          <Button size="lg" render={<Link href="/demo">Request a demo</Link>} />
        </div>
      </Section>

      <Section className="pt-0">
        <div className="mx-auto grid max-w-4xl gap-4 sm:grid-cols-3">
          {LICENSING_FACTS.map((fact) => (
            <Card key={fact.title}>
              <CardHeader>
                <div className="mb-2 flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <fact.icon className="size-5" />
                </div>
                <CardTitle className="text-sm">{fact.title}</CardTitle>
                <CardDescription>{fact.description}</CardDescription>
              </CardHeader>
            </Card>
          ))}
        </div>
      </Section>

      <Section tone="muted">
        <SectionHeading eyebrow="What's included" title="Everything your students need, in one place" align="left" />
        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          {FEATURES.map((feature) => (
            <FeatureCard key={feature.title} {...feature} />
          ))}
        </div>
      </Section>

      <Section>
        <SectionHeading eyebrow="How it works" title="From first conversation to student access" align="left" />
        <div className="mt-10">
          <JourneySteps steps={STEPS} />
        </div>
      </Section>

      <Section tone="muted">
        <SectionHeading eyebrow="FAQ" title="Questions from careers teams" />
        <div className="mt-8">
          <Faq items={FAQ_ITEMS} />
        </div>
      </Section>

      <CtaSection title="Talk to us about your institution" description="Tell us about your cohort and we'll walk you through what's possible.">
        <Button size="lg" variant="secondary" render={<Link href="/demo">Request a demo</Link>} />
      </CtaSection>
    </>
  );
}
