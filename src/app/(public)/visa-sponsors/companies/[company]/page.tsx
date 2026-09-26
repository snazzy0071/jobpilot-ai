import Link from "next/link";
import { notFound } from "next/navigation";
import { Building2 } from "lucide-react";
import { Eyebrow } from "@/components/marketing/eyebrow";
import { Section } from "@/components/marketing/section";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Breadcrumbs } from "@/components/marketing/breadcrumbs";
import { getSponsorById } from "@/lib/sponsors/queries";
import { SPONSOR_RATING_LABELS, type SponsorRating } from "@/lib/sponsors/types";
import { buildMetadata } from "@/lib/seo/metadata";

export const dynamic = "force-dynamic";

const RATING_BADGE_VARIANT: Record<SponsorRating, "default" | "secondary" | "outline"> = {
  a_rating: "default",
  a_rating_provisional: "secondary",
  other: "outline",
  b_rating: "outline",
};

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", year: "numeric" }).format(new Date(iso));
}

// Indexed with the real company's name in the title/description once
// there's a real one to show; the `[company]` segment is the sponsor's
// UUID (src/lib/sponsors/queries.ts's getSponsorById) rather than a
// name-derived slug — the register has no stable per-company id of its
// own, and multiple sponsors can share a normalized name at different
// locations, so a slug built from the name alone couldn't be trusted to
// be unique. Human-readable slugs are real, separate follow-up work.
export async function generateMetadata({
  params,
}: {
  params: Promise<{ company: string }>;
}) {
  const { company: id } = await params;
  const sponsor = await getSponsorById(id);
  if (!sponsor) {
    return buildMetadata({
      title: "Sponsor not found",
      description: "This sponsor couldn't be found on the register.",
      path: `/visa-sponsors/companies/${id}`,
      noIndex: true,
    });
  }

  return buildMetadata({
    title: sponsor.companyName,
    description: sponsor.isActive
      ? `${sponsor.companyName} — a UK visa sponsor licence from the Home Office's public register, as of ${formatDate(sponsor.sourceDate)}.`
      : `${sponsor.companyName} no longer appears on the Home Office's register of licensed sponsors.`,
    path: `/visa-sponsors/companies/${id}`,
    // A removed sponsor's page exists so an old link explains itself — it shouldn't be indexed as a current sponsor.
    noIndex: !sponsor.isActive,
  });
}

export default async function SponsorCompanyPage({ params }: { params: Promise<{ company: string }> }) {
  const { company: id } = await params;
  const sponsor = await getSponsorById(id);
  if (!sponsor) notFound();

  // Real, gov.uk-sourced facts only (name, location as given by the
  // register) — no fabricated address components or identifiers, same
  // discipline as the visible page itself, which already says "always
  // verify... a licence can change between updates" rather than
  // asserting more than the register actually gives it.
  const organizationJsonLd = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: sponsor.companyName,
    ...((sponsor.townCity || sponsor.county) && {
      address: {
        "@type": "PostalAddress",
        ...(sponsor.townCity && { addressLocality: sponsor.townCity }),
        ...(sponsor.county && { addressRegion: sponsor.county }),
        addressCountry: "GB",
      },
    }),
  };

  return (
    <Section className="hero-glow pt-24 pb-24 sm:pt-32">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd).replace(/</g, "\\u003c") }}
      />
      <div className="mx-auto flex max-w-2xl flex-col gap-8">
        <Breadcrumbs
          items={[
            { label: "Home", href: "/" },
            { label: "Visa Sponsors", href: "/visa-sponsors" },
            { label: sponsor.companyName },
          ]}
        />
        <div className="flex flex-col items-center gap-4 text-center">
          <Eyebrow>
            <Link href="/visa-sponsors" className="hover:underline">
              Visa Sponsors
            </Link>
          </Eyebrow>
          <div className="gradient-brand flex size-16 items-center justify-center rounded-2xl text-white shadow-floating">
            <Building2 className="size-8" />
          </div>
          <h1 className="font-heading text-3xl font-semibold tracking-tight text-balance sm:text-4xl">{sponsor.companyName}</h1>
          <p className="max-w-md text-muted-foreground">
            {[sponsor.townCity, sponsor.county].filter(Boolean).join(", ") || "Location not given"}
          </p>
        </div>

        {!sponsor.isActive && (
          <div role="status" className="rounded-xl border border-destructive/40 bg-destructive/5 p-4 text-sm">
            <p className="font-medium text-destructive">No longer on the register</p>
            <p className="mt-1 text-muted-foreground">
              {sponsor.companyName} was on the Home Office&apos;s register of licensed sponsors
              {sponsor.removedOn ? ` but was removed in the sync of ${formatDate(sponsor.removedOn)}` : " but no longer appears on the latest sync"}.
              Don&apos;t assume this employer can currently sponsor a visa — the details below are what it held when it was last listed
              (verified {formatDate(sponsor.sourceDate)}).
            </p>
          </div>
        )}

        <Card className="shadow-floating">
          <CardHeader>
            <CardTitle className="text-sm text-muted-foreground">Sponsor details</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="flex items-center justify-between gap-4">
              <span className="text-sm text-muted-foreground">Registered name</span>
              <span className="text-sm font-medium">{sponsor.companyName}</span>
            </div>
            <div className="flex items-center justify-between gap-4">
              <span className="text-sm text-muted-foreground">Town / city</span>
              <span className="text-sm font-medium">{sponsor.townCity ?? "Not given"}</span>
            </div>
            <div className="flex items-center justify-between gap-4">
              <span className="text-sm text-muted-foreground">County</span>
              <span className="text-sm font-medium">{sponsor.county ?? "Not given"}</span>
            </div>
            <div className="flex items-start justify-between gap-4">
              <span className="text-sm text-muted-foreground">Visa routes held</span>
              <div className="flex flex-wrap justify-end gap-1.5">
                {sponsor.routes.length > 0 ? (
                  sponsor.routes.map((route) => (
                    <Badge key={route} variant="secondary">
                      {route}
                    </Badge>
                  ))
                ) : (
                  <span className="text-sm font-medium">Not given</span>
                )}
              </div>
            </div>
            {sponsor.aliases.length > 0 && (
              <div className="flex items-start justify-between gap-4">
                <span className="text-sm text-muted-foreground">Also known as</span>
                <div className="flex flex-col items-end gap-1">
                  {sponsor.aliases.map((alias) => (
                    <span key={`${alias.aliasType}-${alias.aliasName}`} className="text-sm font-medium">
                      {alias.aliasName}
                    </span>
                  ))}
                </div>
              </div>
            )}
            <div className="flex items-center justify-between gap-4">
              <span className="text-sm text-muted-foreground">Rating</span>
              <Badge variant={RATING_BADGE_VARIANT[sponsor.rating]}>{SPONSOR_RATING_LABELS[sponsor.rating]}</Badge>
            </div>
            <div className="flex items-center justify-between gap-4">
              <span className="text-sm text-muted-foreground">{sponsor.isActive ? "Last verified" : "Last listed"}</span>
              <span className="text-sm font-medium">{formatDate(sponsor.sourceDate)}</span>
            </div>
          </CardContent>
        </Card>

        <p className="text-center text-xs text-muted-foreground">
          Always verify current status on the official{" "}
          <a
            href="https://www.gov.uk/government/publications/register-of-licensed-sponsors-workers"
            target="_blank"
            rel="noopener noreferrer"
            className="underline"
          >
            gov.uk register
          </a>{" "}
          before relying on it — a licence can change between updates.
        </p>
      </div>
    </Section>
  );
}
