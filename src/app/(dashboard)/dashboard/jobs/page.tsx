import { requireUser } from "@/lib/auth/session";
import { listCvs } from "@/lib/cvs/queries";
import {
  searchJobs,
  listJobSources,
  getSponsorMatchesForJobs,
  getJobMatchesForCv,
  getSavedJobIds,
  getTrackedApplicationIds,
  getJobFeedStatus,
} from "@/lib/jobs/queries";
import type { JobSponsorMatch } from "@/lib/jobs/sponsor-match";
import { JOB_SORTS, type JobSearchFilters, type JobSort } from "@/lib/jobs/types";
import { JobFeedFilters } from "@/components/jobs/job-feed-filters";
import { JobFeedResults } from "@/components/jobs/job-feed-results";
import { JobFeedStatusNotice } from "@/components/jobs/job-feed-status";
import { JobsSectionNav } from "@/components/jobs/jobs-section-nav";

export const dynamic = "force-dynamic";

type SearchParams = {
  q?: string;
  location?: string;
  source?: string;
  posted?: string;
  sort?: string;
  sponsorOnly?: string;
  cv?: string;
  minScore?: string;
  page?: string;
};

function isJobSort(value: string | undefined): value is JobSort {
  return !!value && (JOB_SORTS as readonly string[]).includes(value);
}

export default async function JobFeedPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const user = await requireUser();
  const params = await searchParams;

  const [cvs, sources, feedStatus] = await Promise.all([listCvs(user.id), listJobSources(), getJobFeedStatus()]);
  // Only a CV with a real current version can actually be matched against (src/lib/jobs/matching/actions.ts builds CV
  // text from a saved version) — an archived CV or one with no version yet isn't a valid pick here.
  const selectableCvs = cvs.filter((cv) => !cv.isArchived && cv.currentVersionId);
  const selectedCv = params.cv ? selectableCvs.find((cv) => cv.id === params.cv) : undefined;

  const sort = isJobSort(params.sort) ? params.sort : undefined;
  const postedWithinDays = params.posted ? Number(params.posted) || undefined : undefined;
  const minScore = selectedCv && params.minScore ? Number(params.minScore) || undefined : undefined;

  const filters: JobSearchFilters = {
    keywords: params.q,
    location: params.location,
    sourceId: params.source,
    postedWithinDays,
    sort,
    sponsorOnly: params.sponsorOnly === "1",
    cvVersionId: selectedCv?.currentVersionId ?? undefined,
    minMatchScore: minScore,
    page: params.page ? Number(params.page) || 1 : 1,
  };

  const result = await searchJobs(filters);

  const jobIds = result.results.map((job) => job.id);
  const [sponsorLookup, jobMatches, savedJobIds, trackedApplicationIds] = await Promise.all([
    getSponsorMatchesForJobs(result.results).then(
      (matches) => ({ matches, failed: false }),
      (err) => {
        console.error("Job feed sponsor cross-check failed:", err);
        return { matches: new Map<string, JobSponsorMatch>(), failed: true };
      },
    ),
    selectedCv?.currentVersionId ? getJobMatchesForCv(jobIds, selectedCv.currentVersionId) : Promise.resolve(new Map()),
    getSavedJobIds(jobIds),
    getTrackedApplicationIds(jobIds),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <JobsSectionNav active="feed" />

      <JobFeedStatusNotice status={feedStatus} />

      <JobFeedFilters
        sources={sources}
        cvs={selectableCvs.map((cv) => ({ id: cv.id, title: cv.title }))}
        defaultValues={{
          keywords: params.q,
          location: params.location,
          sourceId: params.source,
          postedWithinDays: params.posted,
          sort: params.sort,
          sponsorOnly: params.sponsorOnly === "1",
          cvId: selectedCv?.id,
          minScore: params.minScore,
        }}
      />

      <JobFeedResults
        result={result}
        sources={sources}
        sponsorMatches={sponsorLookup.matches}
        sponsorCheckFailed={sponsorLookup.failed}
        jobMatches={jobMatches}
        savedJobIds={savedJobIds}
        trackedApplicationIds={trackedApplicationIds}
        feedHasJobs={feedStatus.totalVisible > 0}
        cvId={selectedCv?.id ?? null}
        searchParams={params}
      />
    </div>
  );
}
