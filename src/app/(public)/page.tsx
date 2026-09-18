import Link from "next/link";
import { Building2, CheckCircle2, GraduationCap, MapPin, MessagesSquare, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Section } from "@/components/marketing/section";
import { SectionHeading } from "@/components/marketing/section-heading";
import { Eyebrow } from "@/components/marketing/eyebrow";
import { FeatureCard } from "@/components/marketing/feature-card";
import { CtaSection } from "@/components/marketing/cta-section";
import { TrustBar } from "@/components/marketing/trust-bar";
import { CvPreview } from "@/components/marketing/cv-preview";
import { JourneySteps } from "@/components/marketing/journey-steps";
import { Reveal } from "@/components/motion/reveal";
import { siteConfig } from "@/config/site";
import { TOOLS } from "@/config/tools";
import { buildMetadata } from "@/lib/seo/metadata";

export const metadata = buildMetadata({
  description:
    "The UK career toolkit: a UK-standard CV builder, ATS scanner, interview coach, and a searchable UK visa sponsor register.",
  path: "/",
});

// The homepage grid also covers two sponsor-related pages that aren't
// part of the FeaturePage/TOOLS system (they use ComingSoon, not
// FeaturePage), so they're appended here rather than living in the
// shared tools registry.
const GRID_TOOLS = [
  ...TOOLS.map((tool) => ({
    icon: tool.icon,
    title: tool.title,
    description: tool.shortDescription,
    href: tool.href,
  })),
  {
    icon: ShieldCheck,
    title: "Visa Sponsors",
    description: "Search the UK Home Office's licensed sponsor register.",
    href: "/visa-sponsors",
  },
  {
    icon: Building2,
    title: "Sponsor Licence Check",
    description: "Check a specific employer's sponsor status.",
    href: "/sponsor-licence-check",
  },
];

const JOURNEY = [
  { title: "Build your CV", description: "Start from a UK-standard template and fill in what matters." },
  { title: "Check it against the job", description: "Scan your CV against a specific listing before you apply." },
  { title: "Find roles worth applying to", description: "See matched jobs and sponsor status side by side." },
  { title: "Practise the interview", description: "Work through competency-style questions and get feedback." },
  { title: "Track it to an offer", description: "Follow every application from wishlist to offer." },
];

const BENEFITS = [
  {
    icon: CheckCircle2,
    title: "UK CV conventions",
    description: "A4, two pages, no photo — the format UK recruiters expect, not a US resume.",
  },
  {
    icon: MessagesSquare,
    title: "British-style interviews",
    description: "Competency-based practice, not US-style behavioural formats.",
  },
  {
    icon: ShieldCheck,
    title: "Real sponsor data",
    description: "Sourced from the UK Home Office's public register, not guesswork.",
  },
  {
    icon: MapPin,
    title: "UK-only focus",
    description: "Built specifically for the UK job market, not adapted from somewhere else.",
  },
];

export default function HomePage() {
  return (
    <>
      {/* Hero */}
      <Section className="bg-gradient-to-b from-primary/5 via-background to-background pt-24 sm:pt-32">
        <Reveal className="mx-auto flex max-w-3xl flex-col items-center gap-6 text-center">
          <Eyebrow>UK career toolkit</Eyebrow>
          <h1 className="font-heading text-4xl font-semibold tracking-tight sm:text-5xl">
            Your career toolkit, built right.
          </h1>
          <p className="max-w-xl text-lg text-muted-foreground">
            {siteConfig.name} helps you build a UK-standard CV, check it against ATS filters,
            practise interviews, and find employers who can actually sponsor you.
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <Button size="lg" render={<Link href="/signup">Get started</Link>} />
            <Button
              size="lg"
              variant="outline"
              render={<Link href="/free-ats-checker">Score my CV free</Link>}
            />
          </div>
        </Reveal>
      </Section>

      {/* Trust bar */}
      <Section className="py-8 sm:py-10">
        <TrustBar />
      </Section>

      {/* CV preview */}
      <Section tone="muted">
        <div className="grid items-center gap-12 lg:grid-cols-2">
          <Reveal className="flex flex-col gap-4">
            <Eyebrow>CV Builder</Eyebrow>
            <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">
              A CV built for UK recruiters
            </h2>
            <p className="text-lg text-muted-foreground">
              UK-standard templates — A4, two pages, no photo — with guided sections so nothing
              important gets left out.
            </p>
            <div>
              <Button render={<Link href="/features/cv">See CV Builder</Link>} />
            </div>
          </Reveal>
          <Reveal delay={0.1}>
            <CvPreview />
          </Reveal>
        </div>
      </Section>

      {/* Free ATS CTA */}
      <Section>
        <Reveal className="mx-auto flex max-w-2xl flex-col items-center gap-4 rounded-2xl border p-10 text-center">
          <Eyebrow>Free tool</Eyebrow>
          <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            Score your CV in seconds
          </h2>
          <p className="text-muted-foreground">
            No account needed. Upload your CV and a job description to see exactly what&apos;s
            missing before you apply.
          </p>
          <Button
            size="lg"
            render={<Link href="/free-ats-checker">Score my CV free</Link>}
          />
        </Reveal>
      </Section>

      {/* Sponsor section */}
      <Section tone="muted">
        <Reveal className="mx-auto flex max-w-2xl flex-col items-center gap-4 text-center">
          <Eyebrow>Visa sponsorship</Eyebrow>
          <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">
            Only apply where you can actually be hired
          </h2>
          <p className="text-lg text-muted-foreground">
            Search the UK Home Office&apos;s public register of licensed sponsors before you
            spend time on an application. Holding a licence doesn&apos;t guarantee a specific
            role is sponsored — but it tells you who&apos;s worth asking.
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <Button render={<Link href="/visa-sponsors">Search sponsors</Link>} />
            <Button
              variant="outline"
              render={<Link href="/sponsor-licence-check">Check an employer</Link>}
            />
          </div>
        </Reveal>
      </Section>

      {/* Ten-tool grid */}
      <Section>
        <SectionHeading
          eyebrow="Everything included"
          title="One workspace, ten tools"
          lead="Built to work together, not as ten separate apps to juggle."
        />
        <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-5">
          {GRID_TOOLS.map((tool, index) => (
            <FeatureCard key={tool.title} {...tool} index={index} />
          ))}
        </div>
      </Section>

      {/* Grad-prep spotlight */}
      <Section tone="muted">
        <div className="grid items-center gap-12 lg:grid-cols-2">
          <Reveal className="flex flex-col gap-4">
            <Eyebrow>Graduate schemes</Eyebrow>
            <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">
              Practise the tests, not just the interview
            </h2>
            <p className="text-lg text-muted-foreground">
              Numerical, verbal, and situational judgement practice in the formats graduate
              schemes actually use — original questions, real formats.
            </p>
            <div>
              <Button render={<Link href="/features/gradprep">See Grad Scheme Prep</Link>} />
            </div>
          </Reveal>
          <Reveal delay={0.1}>
            <Card className="mx-auto flex w-full max-w-sm flex-col items-center gap-4 p-8 text-center">
              <div className="flex size-14 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <GraduationCap className="size-7" />
              </div>
              <p className="text-sm font-medium">Formats covered</p>
              <p className="text-sm text-muted-foreground">
                Numerical &middot; Verbal &middot; Situational Judgement &middot; Diagrammatic
                Reasoning — original questions, real formats
              </p>
            </Card>
          </Reveal>
        </div>
      </Section>

      {/* Five-step journey */}
      <Section>
        <SectionHeading eyebrow="How it works" title="From CV to offer" />
        <div className="mt-12">
          <JourneySteps steps={JOURNEY} />
        </div>
      </Section>

      {/* UK-first benefits */}
      <Section tone="muted">
        <SectionHeading eyebrow="Built for the UK" title="Built around how UK hiring actually works" />
        <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {BENEFITS.map((benefit, index) => (
            <FeatureCard key={benefit.title} {...benefit} index={index} />
          ))}
        </div>
      </Section>

      {/* Closing CTA */}
      <CtaSection
        title="Ready to get started?"
        description="Create a free account — no card required."
      >
        <Button
          size="lg"
          variant="secondary"
          render={<Link href="/signup">Create free account</Link>}
        />
      </CtaSection>
    </>
  );
}
