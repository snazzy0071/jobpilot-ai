import Link from "next/link";
import { DatabaseZap } from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { SponsorPagination } from "@/components/marketing/sponsor-pagination";
import { SPONSOR_RATING_LABELS, type SponsorRating, type SponsorSearchResult } from "@/lib/sponsors/types";

const RATING_BADGE_VARIANT: Record<SponsorRating, "default" | "secondary" | "outline"> = {
  a_rating: "default",
  a_rating_provisional: "secondary",
  other: "outline",
  b_rating: "outline",
};

/** Real results from src/lib/sponsors/queries.ts's searchSponsors — no placeholder state left here, only an honest empty state when a real search genuinely finds nothing. */
export function SponsorSearchResults({
  result,
  basePath,
  searchParams,
}: {
  result: SponsorSearchResult;
  basePath: string;
  searchParams: Record<string, string | undefined>;
}) {
  if (result.results.length === 0) {
    return (
      <Card className="items-center gap-3 p-10 text-center">
        <DatabaseZap className="size-8 text-muted-foreground" />
        <p className="font-medium">No sponsors found</p>
        <p className="max-w-md text-sm text-muted-foreground">
          Try a different spelling, a shorter company name, or clear a filter — this checks the real Home Office
          register, so a genuine licensed sponsor under a different name than what you searched won&apos;t show up.
        </p>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <p className="text-sm text-muted-foreground">
        {result.total} sponsor{result.total === 1 ? "" : "s"} found
        {result.truncated ? " — showing the closest matches; try a more specific search for the rest" : ""}
      </p>

      <div className="flex flex-col gap-3">
        {result.results.map((sponsor) => (
          <Link key={sponsor.id} href={`/visa-sponsors/companies/${sponsor.id}`}>
            <Card className="transition-colors hover:bg-muted/40">
              <CardHeader className="flex-row items-center justify-between gap-4">
                <div className="min-w-0">
                  <CardTitle className="text-base">{sponsor.companyName}</CardTitle>
                  <CardDescription>
                    {[sponsor.townCity, sponsor.county].filter(Boolean).join(", ") || "Location not given"}
                  </CardDescription>
                  {sponsor.matchedAlias && (
                    <p className="mt-1 text-xs text-muted-foreground">Matched via trading/legal name: {sponsor.matchedAlias}</p>
                  )}
                </div>
                <Badge variant={RATING_BADGE_VARIANT[sponsor.rating]} className="shrink-0">
                  {SPONSOR_RATING_LABELS[sponsor.rating]}
                </Badge>
              </CardHeader>
            </Card>
          </Link>
        ))}
      </div>

      <SponsorPagination basePath={basePath} currentPage={result.page} totalPages={result.totalPages} searchParams={searchParams} />
    </div>
  );
}
