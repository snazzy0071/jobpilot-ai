import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageHero } from "@/components/marketing/page-hero";
import { GradientText } from "@/components/marketing/gradient-text";
import { AtsScorePreview } from "@/components/marketing/ats-score-preview";
import { CtaSection } from "@/components/marketing/cta-section";
import { Reveal } from "@/components/motion/reveal";
import { Section } from "@/components/marketing/section";
import { SectionHeading } from "@/components/marketing/section-heading";
import { Capabilities } from "@/components/marketing/bullet-list";
import {
  ComparisonTable,
  type ComparisonColumn,
  type ComparisonRow,
} from "@/components/marketing/comparison-table";
import { Faq } from "@/components/marketing/faq";
import { FreeAtsCheckerForm } from "@/components/marketing/free-ats-checker-form";
import { buildMetadata } from "@/lib/seo/metadata";
import { siteConfig } from "@/config/site";

export const metadata = buildMetadata({
  title: "Free ATS Checker",
  description:
    "Upload your CV and a job description to see exactly what's missing before you apply — no account, no card required.",
  path: "/free-ats-checker",
});

const COLUMNS: ComparisonColumn[] = [
  { id: "free", label: "This free tool" },
  { id: "pro", label: "Full account", highlighted: true },
];

const ROWS: ComparisonRow[] = [
  { label: "ATS scans", values: { free: "2 per month, no signup", pro: "Unlimited on paid plans, saved to your account" } },
  { label: "Top 10 matched and missing keywords", values: { free: true, pro: true } },
  { label: "Every keyword, mapped to the CV section it belongs in", values: { free: false, pro: true } },
  { label: "Top 3 fixes", values: { free: true, pro: true } },
  { label: "Full, section-by-section fix list", values: { free: false, pro: true } },
  { label: "Emailed PDF report + private link", values: { free: true, pro: true } },
  { label: "Apply fixes directly in the CV Builder", values: { free: false, pro: true } },
  { label: "Scan history saved", values: { free: false, pro: true } },
  { label: "Cover Letter Generator", values: { free: false, pro: true } },
  { label: "LinkedIn Optimiser", values: { free: false, pro: true } },
];

const FAQ_ITEMS = [
  {
    question: "Do I need to create an account?",
    answer: "No — this checker works without signing up. We just ask for an email to keep the free tool fair to use.",
  },
  {
    question: "How many times can I use it?",
    answer:
      "2 free scans a month without an account. A paid plan adds unlimited scans saved to your account, with history and the full breakdown.",
  },
  {
    question: "What happens to my CV after I submit it?",
    answer:
      "Your CV file and the job description are used only to generate your report and are never kept. The report itself — your score, top keywords, and fixes — is saved for 90 days behind a private link so you can reopen it or download it as a PDF, but anyone with that link could view it, so don't share it unless you mean to.",
  },
  {
    question: "Can I save or download my result?",
    answer:
      "Yes — every scan emails you a PDF copy straight away, and also gives you a private link on this page to reopen the same result or download the PDF again later, no account needed.",
  },
  {
    question: "What's the difference from the ATS Scanner in my account?",
    answer:
      "Same scan, same scoring. An account removes the monthly cap and adds saved history, a full score breakdown, and the ability to apply suggested fixes straight in the CV Builder.",
  },
  {
    question: "Will you email me anything?",
    answer:
      "We'll always email you a copy of your report as a PDF, since that's what you asked for by running the scan — separate from the optional box for hearing about new features and career tips, which only sends anything if you tick it.",
  },
];

// Real facts only: this specific scan tool is genuinely free (no
// account, no card, per the page's own copy) — no fabricated
// ratings/review counts, since none exist.
const APPLICATION_JSON_LD = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  name: `${siteConfig.name} Free ATS Checker`,
  applicationCategory: "BusinessApplication",
  operatingSystem: "Any (web-based)",
  offers: { "@type": "Offer", price: "0", priceCurrency: "GBP" },
};

export default function FreeAtsCheckerPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(APPLICATION_JSON_LD).replace(/</g, "\\u003c") }}
      />
      <PageHero
        badge={<Badge variant="secondary">No signup needed</Badge>}
        eyebrow="Free tool"
        title={
          <>
            Score your CV <GradientText>in seconds</GradientText>
          </>
        }
        description="Upload your CV and paste a job description to see exactly what's missing before you apply — no account, no card required."
        actions={<Button size="lg" variant="gradient" render={<a href="#checker">Score my CV</a>} />}
        visual={<AtsScorePreview />}
      />

      <Section className="pt-0">
        <div id="checker" className="scroll-mt-20"><Reveal className="relative">
          <div
            className="pointer-events-none absolute -inset-4 -z-10 rounded-[2rem] bg-gradient-to-br from-primary/10 via-transparent to-brand-secondary/10 blur-2xl"
            aria-hidden="true"
          />
          <FreeAtsCheckerForm />
        </Reveal></div>
      </Section>

      <Section tone="muted">
        <SectionHeading
          eyebrow="What you get"
          title="Free means free — here's what's included"
        />
        <div className="mt-12">
          <Capabilities
            items={[
              "2 free scans a month, with no account required",
              "A match score against the exact job description you paste in",
              "Your top 10 matched and top 10 missing keywords",
              "Your top 3 fixes, ranked by priority",
              "Your PDF report emailed straight away, plus a private link to reopen or re-download it later",
            ]}
          />
        </div>
      </Section>

      <Section>
        <SectionHeading
          eyebrow="Free vs. full account"
          title="What a free account adds"
          lead="The scan itself is the same either way — an account adds saving, editing, and the rest of the toolkit."
        />
        <div className="mt-12">
          <ComparisonTable columns={COLUMNS} rows={ROWS} />
        </div>
      </Section>

      <Section>
        <SectionHeading eyebrow="FAQ" title="Questions about the free checker" />
        <div className="mt-12">
          <Faq items={FAQ_ITEMS} />
        </div>
      </Section>

      <CtaSection
        title="Want to fix what it finds?"
        description="Create a free account to save your scans and apply the suggested fixes straight in the CV Builder."
      >
        <Button size="lg" variant="secondary" render={<Link href="/signup">Create a free account</Link>} />
      </CtaSection>
    </>
  );
}
