import Link from "next/link";
import { Building2, RefreshCw, ShieldCheck } from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Eyebrow } from "@/components/marketing/eyebrow";
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

export default async function GraduateVisaSponsorshipPage() {
  const schemes = await getGraduateSchemes();

  return (
    <>
      <Section className="bg-gradient-to-b from-primary/5 via-background to-background pt-24 pb-12 sm:pt-32">
        <div className="mx-auto flex max-w-2xl flex-col items-center gap-4 text-center">
          <Eyebrow>Graduate Schemes</Eyebrow>
          <h1 className="font-heading text-4xl font-semibold tracking-tight sm:text-5xl">
            Which graduate schemes sponsor visas?
          </h1>
          <p className="max-w-xl text-lg text-muted-foreground">
            A sourced breakdown of major UK graduate schemes, so you can focus on programmes
            that can actually sponsor you.
          </p>
        </div>
      </Section>

      <Section className="pt-0">
        <div className="mx-auto grid max-w-4xl gap-4 sm:grid-cols-3">
          {FACTS.map((fact) => (
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
        <div className="mx-auto max-w-5xl">
          <GradSchemeResults schemes={schemes} />
        </div>
      </Section>

      <Section>
        <SectionHeading eyebrow="Methodology" title="Evidence and sources" align="left" />
        <div className="mt-8">
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
        <div className="mt-8">
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
    </>
  );
}
