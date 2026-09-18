import { Eyebrow } from "@/components/marketing/eyebrow";
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
      <Section className="bg-gradient-to-b from-primary/5 via-background to-background pt-24 pb-12 sm:pt-32">
        <div className="mx-auto flex max-w-2xl flex-col items-center gap-4 text-center">
          <Eyebrow>Free tool</Eyebrow>
          <h1 className="font-heading text-4xl font-semibold tracking-tight sm:text-5xl">
            Check a sponsor licence
          </h1>
          <p className="max-w-xl text-lg text-muted-foreground">
            Look up a specific employer against the UK Home Office&apos;s public register before
            you apply.
          </p>
        </div>
      </Section>

      <Section className="pt-0">
        <SponsorLicenceCheckForm />
      </Section>

      <Section tone="muted">
        <SectionHeading eyebrow="FAQ" title="Questions about this check" />
        <div className="mt-8">
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
    </>
  );
}
