import { requireUser } from "@/lib/auth/session";
import { listCvs } from "@/lib/cvs/queries";
import {
  searchJobs,
  listJobSources,
  getSponsorMatchesForJobs,
  getJobMatchesForCv,
  getSavedJobIds,
} from "@/lib/jobs/queries";
import { JOB_SORTS, type JobSearchFilters, type JobSort } from "@/lib/jobs/types";
import { JobFeedFilters } from "@/components/jobs/job-feed-filters";
import { JobFeedResults } from "@/components/jobs/job-feed-results";

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

  const [cvs, sources] = await Promise.all([listCvs(user.id), listJobSources()]);
  // Only a CV with a real current version can actually be matched
  // against (src/lib/jobs/matching/actions.ts needs a saved version to
  // build CV text from) — an archived CV or one with no version yet
  // isn't a valid pick here.
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
  const [sponsorMatches, jobMatches, savedJobIds] = await Promise.all([
    getSponsorMatchesForJobs(result.results),
    selectedCv?.currentVersionId ? getJobMatchesForCv(jobIds, selectedCv.currentVersionId) : Promise.resolve(new Map()),
    getSavedJobIds(jobIds),
  ]);

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="font-heading text-2xl font-semibold tracking-tight">Job Feed</h1>
        <p className="mt-1 text-muted-foreground">
          Jobs synced from Adzuna and Reed, searched locally — no live call to either happens while you browse.
        </p>
      </div>

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
        sponsorMatches={sponsorMatches}
        jobMatches={jobMatches}
        savedJobIds={savedJobIds}
        cvId={selectedCv?.id ?? null}
        searchParams={params}
      />
    </div>
  );
}
