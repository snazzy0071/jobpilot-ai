import Link from "next/link";
import { Building2, RefreshCw, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHero } from "@/components/marketing/page-hero";
import { GradientText } from "@/components/marketing/gradient-text";
import { MockWindow } from "@/components/marketing/mock-window";
import { FeatureCard } from "@/components/marketing/feature-card";
import { CtaSection } from "@/components/marketing/cta-section";
import { cn } from "@/lib/utils";
import { Section } from "@/components/marketing/section";
import { SectionHeading } from "@/components/marketing/section-heading";
import { Capabilities } from "@/components/marketing/bullet-list";
import { Faq } from "@/components/marketing/faq";
import { GradSchemeResults } from "@/components/marketing/grad-scheme-results";
import { getGraduateSchemes } from "@/lib/graduate-schemes/queries";
import { siteConfig } from "@/config/site";
import { buildMetadata } from "@/lib/seo/metadata";

export const dynamic = "force-dynamic";

export const metadata = buildMetadata({
  title: "Graduate Visa Sponsorship",
  description: "A sourced breakdown of major UK graduate schemes and which ones can sponsor a visa.",
  path: "/graduate-visa-sponsorship",
});

const FACTS = [
  {
    icon: ShieldCheck,
    title: "Evidence-based",
    description: "Every status cross-checked, never guessed.",
  },
  {
    icon: Building2,
    title: "Five major sectors",
    description: "Consulting, banking & finance, law, technology, and public sector.",
  },
  {
    icon: RefreshCw,
    title: "Kept current",
    description: "Rechecked as schemes and evidence change.",
  },
];

const FAQ_ITEMS = [
  {
    question: "How is a scheme's sponsorship status decided?",
    answer:
      "Cross-checked against the employer's own graduate recruitment or visa guidance page and the UK Home Office sponsor register — not inferred or guessed. Every entry links to its source.",
  },
  {
    question: "What does \"Some tracks\" mean?",
    answer:
      "The employer sponsors on some streams or locations within the scheme but not others — shown as its own status rather than folded into a plain yes or no.",
  },
  {
    question: "What does \"Not published\" mean?",
    answer:
      "The employer hasn't published anything on sponsorship for this scheme either way. We show that honestly rather than guessing which way it goes.",
  },
  {
    question: "Is this the same as the sponsor register?",
    answer:
      "No — this is scheme-level, focused on graduate programmes specifically. The full company-by-company register is under Visa Sponsors.",
  },
  {
    question: "A scheme sponsors visas — does that guarantee me a visa?",
    answer:
      "No — it means the employer can sponsor. You'd still need to be offered a place and meet the visa route's own requirements.",
  },
];

const STATUS_EXAMPLES = [
  { sector: "Consulting", label: "Sponsors", tone: "bg-success/10 text-success" },
  { sector: "Banking & finance", label: "Some tracks", tone: "bg-brand-accent/25 text-foreground" },
  { sector: "Law", label: "Sponsors", tone: "bg-success/10 text-success" },
  { sector: "Public sector", label: "Not published", tone: "bg-muted text-muted-foreground" },
];

function SchemeStatusPreview() {
  return (
    <MockWindow title="Graduate schemes · illustrative">
      <div className="flex flex-col gap-2.5">
        {STATUS_EXAMPLES.map((row) => (
          <div key={row.sector} className="flex items-center justify-between gap-3 rounded-xl border bg-background p-3">
            <div className="flex items-center gap-3">
              <span className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Building2 className="size-4" />
              </span>
              <span className="text-sm font-medium">{row.sector}</span>
            </div>
            <span className={cn("rounded-full px-2.5 py-1 text-[11px] font-medium", row.tone)}>{row.label}</span>
          </div>
        ))}
        <p className="pt-1 text-center text-[11px] text-muted-foreground">Every real entry links to its source</p>
      </div>
    </MockWindow>
  );
}

export default async function GraduateVisaSponsorshipPage() {
  const schemes = await getGraduateSchemes();

  return (
    <>
      <PageHero
        eyebrow="Graduate Schemes"
        title={
          <>
            Which graduate schemes <GradientText>sponsor visas?</GradientText>
          </>
        }
        description="A sourced breakdown of major UK graduate schemes, so you can focus on programmes that can actually sponsor you."
        actions={<Button size="lg" variant="gradient" render={<a href="#schemes">See the schemes</a>} />}
        visual={<SchemeStatusPreview />}
        footer={
          <div className="mx-auto grid max-w-4xl gap-6 sm:grid-cols-3">
            {FACTS.map((fact, index) => (
              <FeatureCard key={fact.title} {...fact} index={index} />
            ))}
          </div>
        }
      />

      <Section tone="muted" decorative>
        <div id="schemes" className="mx-auto max-w-5xl scroll-mt-20">
          <GradSchemeResults schemes={schemes} />
        </div>
      </Section>

      <Section>
        <SectionHeading eyebrow="Methodology" title="Evidence and sources" />
        <div className="mt-12">
          <Capabilities
            items={[
              "Checked against the employer's own graduate recruitment or visa guidance page",
              "Cross-referenced with the UK Home Office's public sponsor register",
              "Marked \"Unconfirmed\" when evidence is unclear or conflicting, instead of guessed",
              "Rechecked periodically rather than published once and left to go stale",
            ]}
          />
        </div>
      </Section>

      <Section tone="muted">
        <SectionHeading eyebrow="FAQ" title="Questions about this list" />
        <div className="mt-12">
          <Faq items={FAQ_ITEMS} />
        </div>
        <p className="mx-auto mt-8 max-w-2xl text-center text-xs text-muted-foreground">
          Not immigration advice. See{" "}
          <Link href="/visa-sponsors" className="underline">
            Visa Sponsors
          </Link>{" "}
          to check a specific employer&apos;s licence directly. Questions?{" "}
          <a href={`mailto:${siteConfig.supportEmail}`} className="underline">
            Get in touch
          </a>
          .
        </p>
      </Section>

      <CtaSection title="Prepare for the application itself" description="Practise the tests and interviews these schemes use.">
        <Button size="lg" variant="secondary" render={<Link href="/features/gradprep">Grad Scheme Prep</Link>} />
      </CtaSection>
    </>
  );
}
