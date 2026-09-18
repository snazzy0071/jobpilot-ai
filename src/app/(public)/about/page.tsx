import { Section } from "@/components/marketing/section";
import { Eyebrow } from "@/components/marketing/eyebrow";
import { siteConfig } from "@/config/site";
import { buildMetadata } from "@/lib/seo/metadata";

export const metadata = buildMetadata({
  title: "About",
  description:
    "JobPilot AI puts UK CV formatting, ATS checking, interview practice, and visa sponsor data in one place, instead of five separate tools.",
  path: "/about",
});

export default function AboutPage() {
  return (
    <Section className="bg-gradient-to-b from-primary/5 via-background to-background pt-24 sm:pt-32">
      <div className="mx-auto flex max-w-2xl flex-col gap-6">
        <div className="flex flex-col items-center gap-3 text-center">
          <Eyebrow>About</Eyebrow>
          <h1 className="font-heading text-4xl font-semibold tracking-tight sm:text-5xl">
            {siteConfig.name}
          </h1>
        </div>
        <div className="flex flex-col gap-4 text-muted-foreground">
          <p>
            Job hunting in the UK involves more separate tools than it should — a CV builder
            here, an ATS checker there, and a visa sponsor list you have to dig for on gov.uk.
            {siteConfig.name} puts the parts that actually matter in one place.
          </p>
          <p>
            We&apos;re building this for anyone applying for work in the UK, with particular
            attention to the parts that are hardest to get right from outside the system:
            UK-standard CV formatting, applicant tracking systems, and knowing which employers
            can genuinely sponsor a visa before you spend time applying.
          </p>
          <p>
            {siteConfig.name} is an independent product, not affiliated with any recruiter,
            employer, or visa sponsor. Our visa sponsor data comes from the UK Home Office&apos;s
            public register — always verify sponsorship directly with an employer before relying
            on it.
          </p>
        </div>
      </div>
    </Section>
  );
}
