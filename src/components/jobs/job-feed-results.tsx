import { Building2, MapPin, ExternalLink } from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { JobSponsorBadge } from "@/components/jobs/job-sponsor-badge";
import { JobMatchPanel } from "@/components/jobs/job-match-panel";
import { JobSaveButton } from "@/components/jobs/job-save-button";
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
}: {
  job: Job;
  sourceName: string | undefined;
  sponsorMatch: JobSponsorMatch | undefined;
  cvId: string | null;
  jobMatch: JobMatch | null;
  saved: boolean;
}) {
  return (
    <Card className="gap-3 p-5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <CardHeader className="p-0">
            <CardTitle className="text-base">
              <a href={job.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 hover:underline">
                {job.title}
                <ExternalLink className="size-3 shrink-0 text-muted-foreground" />
              </a>
            </CardTitle>
            <CardDescription className="flex flex-wrap items-center gap-1.5">
              <span className="inline-flex items-center gap-1">
                <Building2 className="size-3.5" />
                {job.companyName}
              </span>
              {job.location && (
                <span className="inline-flex items-center gap-1">
                  <MapPin className="size-3.5" />
                  {job.location}
                </span>
              )}
            </CardDescription>
          </CardHeader>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {sponsorMatch && <JobSponsorBadge match={sponsorMatch} />}
          <JobSaveButton jobId={job.id} cvId={cvId ?? undefined} initialSaved={saved} />
        </div>
      </div>

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

/** Real results from src/lib/jobs/queries.ts's searchJobs — sponsor badges and match panels come from data batched server-side for the whole page, never computed per-card. */
export function JobFeedResults({
  result,
  sources,
  sponsorMatches,
  jobMatches,
  savedJobIds,
  cvId,
  searchParams,
}: {
  result: JobSearchResult;
  sources: JobSource[];
  sponsorMatches: Map<string, JobSponsorMatch>;
  jobMatches: Map<string, JobMatch>;
  savedJobIds: Set<string>;
  cvId: string | null;
  searchParams: Record<string, string | undefined>;
}) {
  if (result.results.length === 0) {
    return (
      <Card className="items-center gap-3 p-10 text-center">
        <p className="font-medium">No jobs found</p>
        <p className="max-w-md text-sm text-muted-foreground">
          Try a different keyword, clear a filter, or widen the date range — this only searches jobs already synced into
          the local database (never a live call to Adzuna or Reed).
        </p>
      </Card>
    );
  }

  const sourceNameById = new Map(sources.map((source) => [source.id, source.name]));

  return (
    <div className="flex flex-col gap-6">
      <p className="text-sm text-muted-foreground">
        {result.total} job{result.total === 1 ? "" : "s"} found
        {result.truncated ? " — showing the closest matches; narrow your filters for the rest" : ""}
      </p>

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
          />
        ))}
      </div>

      <JobFeedPagination currentPage={result.page} totalPages={result.totalPages} searchParams={searchParams} />
    </div>
  );
}
