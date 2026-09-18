import Link from "next/link";
import { Eyebrow } from "@/components/marketing/eyebrow";
import { Section } from "@/components/marketing/section";
import { SectionHeading } from "@/components/marketing/section-heading";
import { Capabilities } from "@/components/marketing/bullet-list";
import { Faq } from "@/components/marketing/faq";
import { Breadcrumbs } from "@/components/marketing/breadcrumbs";
import { SponsorStatisticsBreakdown } from "@/components/marketing/sponsor-statistics-breakdown";
import { getSponsorStatistics } from "@/lib/sponsors/queries";
import { buildMetadata } from "@/lib/seo/metadata";

export const dynamic = "force-dynamic";

export const metadata = buildMetadata({
  title: "Sponsorship Statistics",
  description: "A real breakdown of UK sponsor licences by rating and visa route, synced from the Home Office register.",
  path: "/visa-sponsors/statistics",
});

const FAQ_ITEMS = [
  {
    question: "Where do these figures come from?",
    answer: "The same UK Home Office public sponsor register used across the rest of this tool.",
  },
  {
    question: "How often do they update?",
    answer: "In step with the daily register sync — not a one-off snapshot.",
  },
  {
    question: "Can I see stats for a specific city?",
    answer: "Not yet a full breakdown — but the city pages under Visa Sponsors show a real sponsor count per city.",
  },
];

export default async function VisaSponsorStatisticsPage() {
  const statistics = await getSponsorStatistics();

  return (
    <>
      <Section className="bg-gradient-to-b from-primary/5 via-background to-background pt-24 pb-12 sm:pt-32">
        <div className="mx-auto flex max-w-2xl flex-col items-center gap-4 text-center">
          <div className="w-full self-start">
            <Breadcrumbs
              items={[
                { label: "Home", href: "/" },
                { label: "Visa Sponsors", href: "/visa-sponsors" },
                { label: "Statistics" },
              ]}
            />
          </div>
          <Eyebrow>Visa Sponsors</Eyebrow>
          <h1 className="font-heading text-4xl font-semibold tracking-tight sm:text-5xl">
            Sponsorship statistics
          </h1>
          <p className="max-w-xl text-lg text-muted-foreground">
            {statistics.totalActive.toLocaleString()} active UK sponsor licences, broken down by
            rating and visa route.
          </p>
        </div>
      </Section>

      <Section className="pt-0">
        <SponsorStatisticsBreakdown statistics={statistics} />
      </Section>

      <Section tone="muted">
        <SectionHeading eyebrow="What this shows" title="What's in these numbers" align="left" />
        <div className="mt-8">
          <Capabilities
            items={[
              "The total number of currently active, licensed sponsors",
              "The split between A rating, A rating (provisional), and B rating",
              "The most common visa routes sponsors are licensed for",
              "Per-city sponsor counts, matching the city pages",
            ]}
          />
        </div>
      </Section>

      <Section>
        <div className="mx-auto flex max-w-2xl flex-col items-center gap-2 text-center">
          <p className="text-muted-foreground">
            Looking for a specific city instead?{" "}
            <Link href="/visa-sponsors/cities" className="underline">
              Browse by city
            </Link>
            .
          </p>
        </div>
      </Section>

      <Section>
        <SectionHeading eyebrow="FAQ" title="Questions about these statistics" />
        <div className="mt-8">
          <Faq items={FAQ_ITEMS} />
        </div>
      </Section>
    </>
  );
}
