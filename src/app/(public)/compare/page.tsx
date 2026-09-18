import Link from "next/link";
import { FileText, ScanSearch, MessagesSquare, Handshake, Puzzle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Eyebrow } from "@/components/marketing/eyebrow";
import { Section } from "@/components/marketing/section";
import { SectionHeading } from "@/components/marketing/section-heading";
import { FeatureCard } from "@/components/marketing/feature-card";
import { ComparisonTable, type ComparisonColumn, type ComparisonRow } from "@/components/marketing/comparison-table";
import { Faq } from "@/components/marketing/faq";
import { CtaSection } from "@/components/marketing/cta-section";
import { buildMetadata } from "@/lib/seo/metadata";

export const metadata = buildMetadata({
  title: "Compare",
  description:
    "How JobPilot AI compares to general resume builders, ATS-checker-only tools, AI chatbots, human CV writers, and doing it all yourself.",
  path: "/compare",
});

const COLUMNS: ComparisonColumn[] = [
  { id: "alt", label: "A typical alternative" },
  { id: "jobpilot", label: "JobPilot AI", highlighted: true },
];

const ROWS: ComparisonRow[] = [
  { label: "UK CV formats and terminology", values: { alt: false, jobpilot: true } },
  { label: "Scored against your exact job description", values: { alt: "Sometimes", jobpilot: true } },
  { label: "Interview practice included", values: { alt: false, jobpilot: true } },
  { label: "UK visa sponsor data included", values: { alt: false, jobpilot: true } },
  { label: "Everything in one toolkit", values: { alt: false, jobpilot: true } },
  { label: "Ongoing iteration, not a one-off", values: { alt: "Depends", jobpilot: true } },
];

const ALTERNATIVES = [
  {
    icon: FileText,
    title: "vs. general resume builders",
    description: "Generic templates aren't built for UK formats or how UK recruiters actually read a CV.",
    href: "/features/cv",
  },
  {
    icon: ScanSearch,
    title: "vs. ATS-checker-only tools",
    description: "A score with no fix list tells you something's wrong, not what to do about it.",
    href: "/features/ats",
  },
  {
    icon: MessagesSquare,
    title: "vs. a general AI chatbot",
    description: "A chatbot doesn't know how ATS software parses your file or what UK recruiters expect.",
    href: "/features/interview",
  },
  {
    icon: Handshake,
    title: "vs. a human CV writer",
    description: "One good draft, then you're on your own. JobPilot AI keeps improving with every application.",
    href: "/features/cv",
  },
  {
    icon: Puzzle,
    title: "vs. doing it all yourself",
    description: "Checking formatting, sponsor status, and interview prep separately takes hours you don't have.",
    href: "/pricing",
  },
];

const FAQ_ITEMS = [
  {
    question: "Is this comparison biased?",
    answer:
      "We built JobPilot AI, so we're not neutral — but every claim above is about what's included, not invented weaknesses in anything else.",
  },
  {
    question: "Why compare against categories instead of naming specific tools?",
    answer:
      "Named competitors change pricing and features often. Comparing against what a category of tool typically offers keeps this accurate instead of out of date.",
  },
  {
    question: "Can I use JobPilot AI alongside another tool?",
    answer: "Of course — nothing here locks you in.",
  },
];

export default function ComparePage() {
  return (
    <>
      <Section className="bg-gradient-to-b from-primary/5 via-background to-background pt-24 pb-12 sm:pt-32">
        <div className="mx-auto flex max-w-2xl flex-col items-center gap-4 text-center">
          <Eyebrow>Compare</Eyebrow>
          <h1 className="font-heading text-4xl font-semibold tracking-tight sm:text-5xl">
            How JobPilot AI stacks up
          </h1>
          <p className="max-w-xl text-lg text-muted-foreground">
            Honest comparisons against the kinds of tools people usually try first — not
            invented weaknesses, just what&apos;s actually included.
          </p>
        </div>
      </Section>

      <Section className="pt-0">
        <ComparisonTable columns={COLUMNS} rows={ROWS} />
      </Section>

      <Section tone="muted">
        <SectionHeading eyebrow="By alternative" title="Where JobPilot AI fits" align="left" />
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {ALTERNATIVES.map((alt) => (
            <FeatureCard key={alt.title} {...alt} />
          ))}
        </div>
      </Section>

      <Section>
        <SectionHeading eyebrow="FAQ" title="Questions about this comparison" />
        <div className="mt-8">
          <Faq items={FAQ_ITEMS} />
        </div>
      </Section>

      <CtaSection title="See it for yourself" description="Create a free account, or try the ATS scanner with no signup at all.">
        <Button size="lg" variant="secondary" render={<Link href="/signup">Get started free</Link>} />
        <Button
          size="lg"
          variant="outline"
          className="border-primary-foreground/30 bg-transparent text-primary-foreground hover:bg-primary-foreground/10 hover:text-primary-foreground"
          render={<Link href="/free-ats-checker">Score my CV free</Link>}
        />
      </CtaSection>
    </>
  );
}
