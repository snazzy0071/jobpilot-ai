import Link from "next/link";
import { Building2, MapPinned, RefreshCw } from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Eyebrow } from "@/components/marketing/eyebrow";
import { Section } from "@/components/marketing/section";
import { SectionHeading } from "@/components/marketing/section-heading";
import { Faq } from "@/components/marketing/faq";
import { SponsorSearchFilters } from "@/components/marketing/sponsor-search-filters";
import { SponsorSearchResults } from "@/components/marketing/sponsor-search-results";
import { SponsorSyncDisclaimer } from "@/components/marketing/sponsor-sync-disclaimer";
import { Breadcrumbs } from "@/components/marketing/breadcrumbs";
import {
  searchSponsors,
  getDistinctSponsorRoutes,
  getSponsorSyncStatus,
  getTotalSponsorCount,
} from "@/lib/sponsors/queries";
import { SPONSOR_RATINGS, type SponsorRating } from "@/lib/sponsors/types";
import { siteConfig } from "@/config/site";
import { buildMetadata } from "@/lib/seo/metadata";
import { consumeIpRateLimit } from "@/lib/rate-limit/ip-limit";

export const dynamic = "force-dynamic";

export const metadata = buildMetadata({
  title: "UK Visa Sponsors",
  description: "Search the UK Home Office's public register of licensed visa sponsors before you apply.",
  path: "/visa-sponsors",
});

function buildFacts(totalActive: number) {
  return [
    {
      icon: Building2,
      title: "Every licensed sponsor",
      description:
        totalActive > 0
          ? `${totalActive.toLocaleString()} active sponsors, the full public register — not a partial sample.`
          : "The full public register, not a partial sample.",
    },
    {
      icon: RefreshCw,
      title: "Synced from gov.uk",
      description: "Kept in step with the Home Office's published register.",
    },
    {
      icon: MapPinned,
      title: "Every UK route",
      description: "Search by town, city or sponsorship route.",
    },
  ];
}

const FAQ_ITEMS = [
  {
    question: "Where does this data come from?",
    answer:
      "The UK Home Office's public register of licensed sponsors, published under the Open Government Licence.",
  },
  {
    question: "Does a licence guarantee a company will sponsor me?",
    answer:
      "No — it means the employer is legally able to sponsor a visa. Whether a specific role is sponsored is always down to that employer.",
  },
  {
    question: "Is this immigration advice?",
    answer:
      "No. Always verify a sponsor's current status on the official gov.uk register before relying on it.",
  },
  {
    question: "Can I search by city instead?",
    answer: "Yes — see the city list below, or use the Town / city filter above.",
  },
];

type SearchParams = {
  company?: string;
  city?: string;
  route?: string;
  rating?: string;
  page?: string;
};

function isSponsorRating(value: string | undefined): value is SponsorRating {
  return !!value && (SPONSOR_RATINGS as readonly string[]).includes(value);
}

export default async function VisaSponsorsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const rating = isSponsorRating(params.rating) ? params.rating : undefined;
  const filters = {
    company: params.company,
    city: params.city,
    route: params.route,
    rating,
    page: params.page ? Number(params.page) || 1 : 1,
  };

  // The public sponsor checker — unauthenticated, so an IP-scoped limit
  // is the only kind available, same as every other anonymous surface
  // (src/lib/rate-limit/ip-limit.ts). Generous enough for genuine
  // pagination/browsing, tight enough to blunt a scraper hammering the
  // full register through this search. Checked before the real queries
  // run below, not after — a request over the limit skips them
  // entirely rather than paying the query cost anyway.
  const withinRateLimit = await consumeIpRateLimit("visa_sponsors_search", { windowSeconds: 60, maxRequests: 30 });

  const [result, routes, syncStatus, totalActive] = withinRateLimit
    ? await Promise.all([searchSponsors(filters), getDistinctSponsorRoutes(), getSponsorSyncStatus(), getTotalSponsorCount()])
    : [
        { results: [], total: 0, page: filters.page, pageSize: 0, totalPages: 0, truncated: false },
        [] as string[],
        null,
        0,
      ];
  const facts = buildFacts(totalActive);

  return (
    <>
      <Section className="bg-gradient-to-b from-primary/5 via-background to-background pt-24 pb-12 sm:pt-32">
        <div className="mx-auto flex max-w-2xl flex-col items-center gap-4 text-center">
          <div className="w-full max-w-none self-start">
            <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "Visa Sponsors" }]} />
          </div>
          <Eyebrow>UK Visa Sponsors</Eyebrow>
          <h1 className="font-heading text-4xl font-semibold tracking-tight sm:text-5xl">
            Search the UK sponsor register
          </h1>
          <p className="max-w-xl text-lg text-muted-foreground">
            Check whether an employer holds a UK sponsor licence before you spend time on an
            application.
          </p>
        </div>
      </Section>

      <Section className="pt-0">
        <div className="mx-auto grid max-w-4xl gap-4 sm:grid-cols-3">
          {facts.map((fact) => (
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
        <div className="mx-auto flex max-w-5xl flex-col gap-8">
          {withinRateLimit ? (
            <>
              <SponsorSyncDisclaimer status={syncStatus} />
              <SponsorSearchFilters
                basePath="/visa-sponsors"
                routes={routes}
                defaultValues={{ company: params.company, city: params.city, route: params.route, rating }}
              />
              <SponsorSearchResults result={result} basePath="/visa-sponsors" searchParams={params} />
            </>
          ) : (
            <Card className="items-center gap-2 p-10 text-center">
              <p className="font-medium">You&apos;re searching too quickly</p>
              <p className="max-w-md text-sm text-muted-foreground">
                Wait a moment and try again.
              </p>
            </Card>
          )}
        </div>
      </Section>

      <Section>
        <div className="mx-auto flex max-w-2xl flex-col items-center gap-4 text-center">
          <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            Prefer to browse by city?
          </h2>
          <p className="text-muted-foreground">
            See sponsors grouped by the UK&apos;s major towns and cities.
          </p>
          <Button variant="outline" render={<Link href="/visa-sponsors/cities">Browse by city</Link>} />
        </div>
      </Section>

      <Section tone="muted">
        <SectionHeading eyebrow="FAQ" title="Questions about the sponsor register" />
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
