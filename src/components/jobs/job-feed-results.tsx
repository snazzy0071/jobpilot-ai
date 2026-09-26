import { Building2, MapPin, ExternalLink, AlertTriangle, DatabaseZap } from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { JobSponsorBadge } from "@/components/jobs/job-sponsor-badge";
import { JobMatchPanel } from "@/components/jobs/job-match-panel";
import { JobSaveButton } from "@/components/jobs/job-save-button";
import { JobTrackerButton } from "@/components/jobs/job-tracker-button";
import { JobFeedPagination } from "@/components/jobs/job-feed-pagination";
import type { Job, JobMatch, JobSource, JobSearchResult } from "@/lib/jobs/types";
import type { JobSponsorMatch } from "@/lib/jobs/sponsor-match";

function formatPostedDate(iso: string | null): string {
  if (!iso) return "Date not given";
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" }).format(new Date(iso));
}

function JobCard({
  job,
  sourceName,
  sponsorMatch,
  cvId,
  jobMatch,
  saved,
  trackedApplicationId,
}: {
  job: Job;
  sourceName: string | undefined;
  sponsorMatch: JobSponsorMatch | undefined;
  cvId: string | null;
  jobMatch: JobMatch | null;
  saved: boolean;
  trackedApplicationId: string | null;
}) {
  return (
    <Card className="gap-3 p-5" data-testid="job-card">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 flex-1 basis-72">
          <CardHeader className="p-0">
            <CardTitle className="text-base">
              <a href={job.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 hover:underline">
                {job.title}
                <ExternalLink className="size-3 shrink-0 text-muted-foreground" aria-hidden="true" />
                <span className="sr-only"> (opens the original posting in a new tab)</span>
              </a>
            </CardTitle>
            <CardDescription className="flex flex-wrap items-center gap-1.5">
              <span className="inline-flex items-center gap-1">
                <Building2 className="size-3.5" aria-hidden="true" />
                {job.companyName}
              </span>
              {job.location && (
                <span className="inline-flex items-center gap-1">
                  <MapPin className="size-3.5" aria-hidden="true" />
                  {job.location}
                </span>
              )}
            </CardDescription>
          </CardHeader>
        </div>
        <div className="flex shrink-0 flex-wrap items-start justify-end gap-2">
          {sponsorMatch && <JobSponsorBadge match={sponsorMatch} />}
          <JobSaveButton jobId={job.id} cvId={cvId ?? undefined} initialSaved={saved} />
          <JobTrackerButton jobId={job.id} cvId={cvId ?? undefined} initialApplicationId={trackedApplicationId} />
        </div>
      </div>

      {job.description && <p className="line-clamp-3 text-sm text-muted-foreground">{job.description}</p>}

      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <span>Posted {formatPostedDate(job.postedAt)}</span>
        {sourceName && (
          <Badge variant="outline" className="text-xs">
            {sourceName}
          </Badge>
        )}
      </div>

      {cvId && <JobMatchPanel jobId={job.id} cvId={cvId} initialMatch={jobMatch} />}
    </Card>
  );
}

/** Real results from src/lib/jobs/queries.ts's searchJobs — sponsor badges, match panels, saved and tracker state come from data batched server-side for the whole page, never computed per card. */
export function JobFeedResults({
  result,
  sources,
  sponsorMatches,
  sponsorCheckFailed,
  jobMatches,
  savedJobIds,
  trackedApplicationIds,
  feedHasJobs,
  cvId,
  searchParams,
}: {
  result: JobSearchResult;
  sources: JobSource[];
  sponsorMatches: Map<string, JobSponsorMatch>;
  sponsorCheckFailed: boolean;
  jobMatches: Map<string, JobMatch>;
  savedJobIds: Set<string>;
  trackedApplicationIds: Map<string, string>;
  /** Whether the feed holds any live listing at all — tells "your filters found nothing" from "nothing has been synced yet". */
  feedHasJobs: boolean;
  cvId: string | null;
  searchParams: Record<string, string | undefined>;
}) {
  if (result.failed) {
    return (
      <Card className="items-center gap-3 p-10 text-center" role="alert">
        <AlertTriangle className="size-8 text-destructive" aria-hidden="true" />
        <p className="font-medium">Job search isn&apos;t available right now</p>
        <p className="max-w-md text-sm text-muted-foreground">Something went wrong reading the job listings. Nothing is wrong with your filters — try again in a moment.</p>
      </Card>
    );
  }

  if (result.results.length === 0) {
    if (!feedHasJobs) {
      return (
        <Card className="items-center gap-3 p-10 text-center">
          <DatabaseZap className="size-8 text-muted-foreground" aria-hidden="true" />
          <p className="font-medium">No jobs have been synced yet</p>
          <p className="max-w-md text-sm text-muted-foreground">
            The feed is filled by a scheduled sync from Adzuna and Reed. Until the first one completes there is nothing to search — no placeholder listings are shown.
          </p>
        </Card>
      );
    }
    return (
      <Card className="items-center gap-3 p-10 text-center">
        <p className="font-medium">No jobs found</p>
        <p className="max-w-md text-sm text-muted-foreground">
          Try a different keyword, clear a filter, or widen the date range. This only searches jobs already synced into the local database (never a live call to Adzuna or Reed).
        </p>
      </Card>
    );
  }

  const sourceNameById = new Map(sources.map((source) => [source.id, source.name]));

  return (
    <div className="flex flex-col gap-6">
      <p className="text-sm text-muted-foreground" data-testid="job-total">
        {result.total.toLocaleString("en-GB")} job{result.total === 1 ? "" : "s"} found
      </p>

      {sponsorCheckFailed && (
        <p className="flex items-center gap-1.5 text-sm text-muted-foreground" role="status">
          <AlertTriangle className="size-4" aria-hidden="true" /> The sponsor register couldn&apos;t be checked just now, so sponsor badges are hidden on this page.
        </p>
      )}

      <div className="flex flex-col gap-3">
        {result.results.map((job) => (
          <JobCard
            key={job.id}
            job={job}
            sourceName={sourceNameById.get(job.sourceId)}
            sponsorMatch={sponsorMatches.get(job.companyName)}
            cvId={cvId}
            jobMatch={jobMatches.get(job.id) ?? null}
            saved={savedJobIds.has(job.id)}
            trackedApplicationId={trackedApplicationIds.get(job.id) ?? null}
          />
        ))}
      </div>

      <JobFeedPagination currentPage={result.page} totalPages={result.totalPages} searchParams={searchParams} />
    </div>
  );
}
