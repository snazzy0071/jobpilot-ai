import Link from "next/link";
import { Check, FileText, Handshake, MessagesSquare, Minus, Puzzle, ScanSearch } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHero } from "@/components/marketing/page-hero";
import { GradientText } from "@/components/marketing/gradient-text";
import { MockWindow } from "@/components/marketing/mock-window";
import { FloatingChip } from "@/components/marketing/floating-chip";
import { Reveal } from "@/components/motion/reveal";
import { Section } from "@/components/marketing/section";
import { SectionHeading } from "@/components/marketing/section-heading";
import { FeatureCard } from "@/components/marketing/feature-card";
import { ComparisonTable, type ComparisonColumn, type ComparisonRow } from "@/components/marketing/comparison-table";
import { Faq } from "@/components/marketing/faq";
import { CtaSection } from "@/components/marketing/cta-section";
import { buildMetadata } from "@/lib/seo/metadata";
import { getLiveComparisons } from "@/lib/comparisons/queries";
import { formatCheckedDate } from "@/components/comparisons/comparison-view";

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

function VersusPreview() {
  const rows = ROWS.slice(0, 4);
  return (
    <div className="relative mx-auto w-full max-w-md">
      <MockWindow title="At a glance">
        <div className="grid grid-cols-[1fr_auto_auto] items-center gap-x-4 gap-y-3 text-sm">
          <span />
          <span className="text-center text-xs font-medium text-muted-foreground">Typical</span>
          <span className="gradient-brand rounded-full px-3 py-1 text-center text-xs font-medium text-white">
            JobPilot AI
          </span>
          {rows.map((row) => (
            <div key={row.label} className="contents">
              <span className="text-xs">{row.label}</span>
              <span className="flex justify-center">
                <Minus className="size-4 text-muted-foreground/50" aria-label="Not typically included" />
              </span>
              <span className="flex justify-center">
                <span className="flex size-6 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <Check className="size-3.5" aria-label="Included" />
                </span>
              </span>
            </div>
          ))}
        </div>
      </MockWindow>
      <FloatingChip className="-right-3 -bottom-5 sm:-right-8" delay={0.5}>
        <p className="text-xs font-medium">Categories, not named rivals</p>
      </FloatingChip>
    </div>
  );
}

// getLiveComparisons() reads through createPublicClient() (no cookies), so this can be ISR instead of fully dynamic
// — the "by name" section doesn't need sub-5-minute freshness on which comparisons are published.
export const revalidate = 300;

export default async function ComparePage() {
  // A failure here only hides the by-name list; the rest of the page never depends on the database.
  const named = await getLiveComparisons().catch(() => []);

  return (
    <>
      <PageHero
        eyebrow="Compare"
        title={
          <>
            How JobPilot AI <GradientText>stacks up</GradientText>
          </>
        }
        description="Honest comparisons against the kinds of tools people usually try first — not invented weaknesses, just what's actually included."
        actions={
          <>
            <Button size="lg" variant="gradient" render={<Link href="/signup">Get started free</Link>} />
            <Button size="lg" variant="outline" render={<Link href="/pricing">See pricing</Link>} />
          </>
        }
        visual={<VersusPreview />}
      />

      <Section className="pt-0">
        <Reveal>
          <ComparisonTable columns={COLUMNS} rows={ROWS} />
        </Reveal>
      </Section>

      {named.length > 0 && (
        <Section className="pt-0">
          <SectionHeading eyebrow="By name" title="Compare JobPilot AI with a specific tool" />
          <ul className="mx-auto mt-10 grid max-w-4xl gap-4 sm:grid-cols-2 lg:grid-cols-3" data-testid="named-comparisons">
            {named.map((page) => (
              <li key={page.id}>
                <Link href={`/compare/${page.slug}`} className="block rounded-xl border bg-card p-5 transition-colors hover:bg-muted/40 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none">
                  <span className="block font-medium">JobPilot AI vs {page.competitorName}</span>
                  <span className="mt-1 block text-xs text-muted-foreground">Sourced · checked {formatCheckedDate(page.updatedOn)}</span>
                </Link>
              </li>
            ))}
          </ul>
        </Section>
      )}

      <Section tone="muted">
        <SectionHeading eyebrow="By alternative" title="Where JobPilot AI fits" />
        <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {ALTERNATIVES.map((alt, index) => (
            <FeatureCard key={alt.title} {...alt} index={index} />
          ))}
        </div>
      </Section>

      <Section>
        <SectionHeading eyebrow="FAQ" title="Questions about this comparison" />
        <div className="mt-12">
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
