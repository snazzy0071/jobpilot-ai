import Link from "next/link";
import { ExternalLink, MapPin } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ApplicationStatusBadge, FreshnessNote, SponsorshipBadge, formatSchemeDate } from "@/components/graduate-schemes/scheme-parts";
import { GRADUATE_SCHEME_SECTOR_LABELS, type GraduateScheme } from "@/lib/graduate-schemes/types";
import { deadlineGroup, isClosingSoon, timelineSummary } from "@/lib/graduate-schemes/status";

/**
 * One scheme on the deadlines page: the closing date up front, the opening date, a plain-words countdown, and the evidence
 * (source link, source date, verification date) beside it. A missing date reads "Not published" — never an estimate.
 */
export function DeadlineRow({ scheme }: { scheme: GraduateScheme }) {
  const group = deadlineGroup(scheme);
  const soon = isClosingSoon(scheme);
  return (
    <li className="rounded-xl border bg-card p-4" data-testid="deadline-row" data-group={group}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:gap-5">
        <div className="flex w-full shrink-0 flex-col rounded-lg bg-muted/60 p-3 sm:w-44" data-testid="deadline-date">
          <span className="text-xs font-medium text-muted-foreground">Closes</span>
          <span className={soon ? "font-semibold text-destructive" : "font-semibold"}>
            {scheme.deadlineOn ? formatSchemeDate(scheme.deadlineOn) : scheme.isRolling ? "Rolling — no deadline" : "No published deadline"}
          </span>
          <span className="mt-1 text-xs font-medium text-muted-foreground">Opens</span>
          <span className="text-sm">{scheme.opensOn ? formatSchemeDate(scheme.opensOn) : "Not published"}</span>
        </div>

        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0">
              <h3 className="text-base font-semibold">
                <Link href={`/graduate-schemes/${scheme.slug}`} className="hover:underline focus-visible:underline">
                  {scheme.schemeName}
                </Link>
              </h3>
              <p className="text-sm text-muted-foreground">
                {scheme.employer} · {GRADUATE_SCHEME_SECTOR_LABELS[scheme.sector]}
              </p>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {soon && (
                <Badge variant="destructive" data-testid="closing-soon-badge">
                  Closing soon
                </Badge>
              )}
              <ApplicationStatusBadge scheme={scheme} />
            </div>
          </div>

          <p className="text-sm" data-testid="countdown">
            {timelineSummary(scheme)}
          </p>

          {scheme.locations.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {scheme.locations.slice(0, 4).map((location) => (
                <Badge key={location} variant="outline">
                  <MapPin aria-hidden="true" /> {location}
                </Badge>
              ))}
              {scheme.locations.length > 4 && <Badge variant="outline">+{scheme.locations.length - 4} more</Badge>}
            </div>
          )}

          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <SponsorshipBadge status={scheme.sponsorshipStatus} />
          </div>

          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t pt-2 text-xs text-muted-foreground" data-testid="evidence">
            <a href={scheme.sourceUrl} target="_blank" rel="noopener noreferrer nofollow" className="inline-flex items-center gap-1 font-medium text-foreground underline">
              Source: {new URL(scheme.sourceUrl).hostname.replace(/^www\./, "")} <ExternalLink className="size-3" aria-hidden="true" />
            </a>
            <span>Source dated {formatSchemeDate(scheme.sourceDate)}</span>
            <span>Dates verified {formatSchemeDate(scheme.verifiedAt)}</span>
            <FreshnessNote scheme={scheme} />
          </div>
        </div>
      </div>
    </li>
  );
}
