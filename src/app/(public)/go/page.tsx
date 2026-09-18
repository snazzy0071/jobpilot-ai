import Link from "next/link";
import { CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Eyebrow } from "@/components/marketing/eyebrow";
import { Section } from "@/components/marketing/section";
import { SectionHeading } from "@/components/marketing/section-heading";
import { CtaSection } from "@/components/marketing/cta-section";
import { Faq } from "@/components/marketing/faq";
import { SituationPicker } from "@/components/marketing/situation-picker";
import { buildMetadata } from "@/lib/seo/metadata";

export const metadata = buildMetadata({
  title: "Not Sure Where to Start?",
  description:
    "Tell us what's going wrong with your job search and we'll point you to the right tool — the ATS Scanner, Interview Coach, or Visa Sponsors.",
  path: "/go",
});

const HIGHLIGHTS = ["Free to start", "One toolkit, not five separate ones", "Built for the UK job market"];

const FAQ_ITEMS = [
  {
    question: "Is it really free to start?",
    answer:
      "Yes — the ATS Scanner, CV Builder, Job Tracker, and Visa Sponsor search are all free on the Free plan, no card required.",
  },
  {
    question: "What if none of these match my situation exactly?",
    answer: "Pick the closest one — every tool above is also reachable from the main features menu.",
  },
  {
    question: "Do I have to commit to a paid plan to try this?",
    answer: "No. Create a free account, or try the ATS checker with no account at all.",
  },
];

export default function GoPage() {
  return (
    <>
      <Section className="bg-gradient-to-b from-primary/5 via-background to-background pt-24 pb-12 sm:pt-32">
        <div className="mx-auto flex max-w-2xl flex-col items-center gap-4 text-center">
          <Eyebrow>Not sure where to start?</Eyebrow>
          <h1 className="font-heading text-4xl font-semibold tracking-tight sm:text-5xl">
            Tell us what&apos;s going wrong
          </h1>
          <p className="max-w-xl text-lg text-muted-foreground">
            Rejections rarely come with a reason. Pick what sounds most like your situation and
            we&apos;ll point you to the right tool.
          </p>
        </div>
      </Section>

      <Section className="pt-0">
        <SituationPicker />
      </Section>

      <Section tone="muted">
        <div className="mx-auto flex max-w-2xl flex-col items-center gap-6 text-center">
          <SectionHeading title="Why start here instead of guessing" />
          <ul className="flex flex-wrap justify-center gap-x-6 gap-y-3">
            {HIGHLIGHTS.map((highlight) => (
              <li key={highlight} className="flex items-center gap-2 text-sm text-muted-foreground">
                <CheckCircle2 className="size-4 text-primary" />
                {highlight}
              </li>
            ))}
          </ul>
          <Button variant="outline" render={<Link href="/pricing">See full pricing</Link>} />
        </div>
      </Section>

      <Section>
        <SectionHeading eyebrow="FAQ" title="Quick questions" />
        <div className="mt-8">
          <Faq items={FAQ_ITEMS} />
        </div>
      </Section>

      <CtaSection title="Get started free" description="No card required — start with whichever tool fits.">
        <Button size="lg" variant="secondary" render={<Link href="/signup">Create a free account</Link>} />
      </CtaSection>
    </>
  );
}
