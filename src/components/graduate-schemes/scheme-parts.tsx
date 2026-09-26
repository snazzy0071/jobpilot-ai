import Link from "next/link";
import { AlertTriangle, CalendarClock, MapPin, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  ASSESSMENT_SHORT_LABELS,
  GRADUATE_SCHEME_SECTOR_LABELS,
  GRADUATE_SCHEME_SPONSORSHIP_STATUS_LABELS,
  STUDY_STAGE_LABELS,
  type ApplicationStatus,
  type GraduateScheme,
  type GraduateSchemeSponsorshipStatus,
} from "@/lib/graduate-schemes/types";
import { APPLICATION_STATUS_LABELS, applicationStatus, timelineSummary } from "@/lib/graduate-schemes/status";
import { isStale, STALE_AFTER_DAYS } from "@/lib/graduate-schemes/staleness";

export function formatSchemeDate(iso: string): string {
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${iso}T00:00:00Z`));
}

const SPONSORSHIP_VARIANT: Record<GraduateSchemeSponsorshipStatus, "default" | "secondary" | "destructive" | "outline"> = {
  sponsors: "default",
  some_tracks: "secondary",
  no: "destructive",
  not_published: "outline",
};

/** Says "Visa sponsorship: …" in words, not just a coloured pill. */
export function SponsorshipBadge({ status }: { status: GraduateSchemeSponsorshipStatus }) {
  return (
    <Badge variant={SPONSORSHIP_VARIANT[status]} data-testid="sponsorship-badge">
      <ShieldCheck aria-hidden="true" /> Visa sponsorship: {GRADUATE_SCHEME_SPONSORSHIP_STATUS_LABELS[status]}
    </Badge>
  );
}

const STATUS_VARIANT: Record<ApplicationStatus, "default" | "secondary" | "destructive" | "outline"> = {
  open: "default",
  upcoming: "secondary",
  closed: "destructive",
  dates_not_published: "outline",
};

export function ApplicationStatusBadge({ scheme }: { scheme: GraduateScheme }) {
  const status = applicationStatus(scheme);
  return (
    <Badge variant={STATUS_VARIANT[status]} data-testid="application-status">
      {APPLICATION_STATUS_LABELS[status]}
    </Badge>
  );
}

/** "Not rechecked for over 180 days" — a stale claim is flagged, never silently presented as current. */
export function FreshnessNote({ scheme }: { scheme: Pick<GraduateScheme, "verifiedAt"> }) {
  if (!isStale(scheme.verifiedAt)) return null;
  return (
    <span className="inline-flex items-center gap-1 text-warning" data-testid="stale-warning">
      <AlertTriangle className="size-3.5" aria-hidden="true" /> Not rechecked in over {STALE_AFTER_DAYS} days — confirm with the employer
    </span>
  );
}

export function SchemeCard({ scheme }: { scheme: GraduateScheme }) {
  return (
    <Card className="gap-3 p-5" data-testid="scheme-card">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h2 className="text-base font-semibold">
            <Link href={`/graduate-schemes/${scheme.slug}`} className="hover:underline focus-visible:underline">
              {scheme.schemeName}
            </Link>
          </h2>
          <p className="text-sm text-muted-foreground">
            {scheme.employer} · {GRADUATE_SCHEME_SECTOR_LABELS[scheme.sector]}
          </p>
        </div>
        <ApplicationStatusBadge scheme={scheme} />
      </div>

      <p className="flex items-center gap-1.5 text-sm" data-testid="timeline">
        <CalendarClock className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        {timelineSummary(scheme)}
        {scheme.deadlineOn && <span className="text-muted-foreground"> · deadline {formatSchemeDate(scheme.deadlineOn)}</span>}
      </p>

      <dl className="grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
        <div className="flex gap-1.5">
          <dt className="text-muted-foreground">Salary:</dt>
          <dd>{scheme.salary ?? "Not published"}</dd>
        </div>
        <div className="flex gap-1.5">
          <dt className="text-muted-foreground">For:</dt>
          <dd>{scheme.studyStages.length > 0 ? scheme.studyStages.map((stage) => STUDY_STAGE_LABELS[stage]).join(", ") : "Not published"}</dd>
        </div>
      </dl>

      {scheme.locations.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {scheme.locations.slice(0, 5).map((location) => (
            <Badge key={location} variant="outline">
              <MapPin aria-hidden="true" /> {location}
            </Badge>
          ))}
          {scheme.locations.length > 5 && <Badge variant="outline">+{scheme.locations.length - 5} more</Badge>}
        </div>
      )}

      {scheme.assessments.length > 0 && (
        <p className="flex flex-wrap items-center gap-1.5 text-sm" data-testid="card-assessments">
          <span className="text-muted-foreground">Assessments:</span>
          {scheme.assessments.map((assessment) => (
            <Badge key={assessment.id} variant={assessment.isRequired ? "secondary" : "outline"} data-type={assessment.type}>
              {assessment.type === "other" && assessment.label ? assessment.label : ASSESSMENT_SHORT_LABELS[assessment.type]}
            </Badge>
          ))}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <SponsorshipBadge status={scheme.sponsorshipStatus} />
        <FreshnessNote scheme={scheme} />
      </div>
    </Card>
  );
}
