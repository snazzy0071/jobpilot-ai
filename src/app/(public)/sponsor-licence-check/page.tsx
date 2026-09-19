import Link from "next/link";
import { BadgeCheckIcon, BuildingIcon, SearchIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHero } from "@/components/marketing/page-hero";
import { GradientText } from "@/components/marketing/gradient-text";
import { FloatingCardStack } from "@/components/marketing/floating-card-stack";
import { CtaSection } from "@/components/marketing/cta-section";
import { Reveal } from "@/components/motion/reveal";
import { Section } from "@/components/marketing/section";
import { SectionHeading } from "@/components/marketing/section-heading";
import { Faq } from "@/components/marketing/faq";
import { SponsorLicenceCheckForm } from "@/components/marketing/sponsor-licence-check-form";
import { siteConfig } from "@/config/site";
import { buildMetadata } from "@/lib/seo/metadata";

export const metadata = buildMetadata({
  title: "Sponsor Licence Check",
  description: "Look up a specific employer against the UK Home Office's public sponsor register before you apply.",
  path: "/sponsor-licence-check",
});

const FAQ_ITEMS = [
  {
    question: "What does this check?",
    answer:
      "Whether a specific employer holds a valid UK sponsor licence, using the Home Office's public register.",
  },
  {
    question: "Does a licence mean I'll be sponsored?",
    answer:
      "No — it means the employer is able to sponsor a visa. Whether a given role is sponsored is still down to that employer.",
  },
  {
    question: "How is this different from the sponsor directory?",
    answer:
      "This is a quick check for one company by name. The directory lets you search and filter across the whole register.",
  },
];

export default function SponsorLicenceCheckPage() {
  return (
    <>
      <PageHero
        eyebrow="Free tool"
        title={
          <>
            Check a <GradientText>sponsor licence</GradientText>
          </>
        }
        description="Look up a specific employer against the UK Home Office's public register before you apply."
        actions={<Button size="lg" variant="gradient" render={<a href="#check">Check an employer</a>} />}
        visual={
          <FloatingCardStack
            items={[
              { icon: BuildingIcon, title: "Name the employer", caption: "Type the company you're eyeing", tone: "primary" },
              { icon: SearchIcon, title: "We look at the register", caption: "Home Office public data", tone: "coral" },
              { icon: BadgeCheckIcon, title: "Apply with confidence", caption: "Know before you spend the time", tone: "success" },
            ]}
          />
        }
      />

      <Section className="pt-0">
        <div id="check" className="scroll-mt-20"><Reveal className="relative">
          <div
            className="pointer-events-none absolute -inset-4 -z-10 mx-auto max-w-xl rounded-[2rem] bg-gradient-to-br from-primary/15 via-transparent to-brand-secondary/15 blur-2xl"
            aria-hidden="true"
          />
          <SponsorLicenceCheckForm />
        </Reveal></div>
      </Section>

      <Section tone="muted">
        <SectionHeading eyebrow="FAQ" title="Questions about this check" />
        <div className="mt-12">
          <Faq items={FAQ_ITEMS} />
        </div>
        <p className="mx-auto mt-8 max-w-2xl text-center text-xs text-muted-foreground">
          Not immigration advice — always verify current sponsor status on the official{" "}
          <a
            href="https://www.gov.uk/government/publications/register-of-licensed-sponsors-workers"
            target="_blank"
            rel="noopener noreferrer"
            className="underline"
          >
            gov.uk register
          </a>
          . Questions?{" "}
          <a href={`mailto:${siteConfig.supportEmail}`} className="underline">
            Get in touch
          </a>
          .
        </p>
      </Section>

      <CtaSection title="Want the whole register?" description="Search and filter every licensed sponsor by name, city and route.">
        <Button size="lg" variant="secondary" render={<Link href="/visa-sponsors">Search the directory</Link>} />
      </CtaSection>
    </>
  );
}
