"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const ALL_SOURCES = "__all_sources__";
const ANY_TIME = "__any_time__";
const NO_CV = "__no_cv__";
const ANY_SCORE = "__any_score__";

const POSTED_WITHIN_OPTIONS = [
  { value: ANY_TIME, label: "Any time", days: undefined },
  { value: "1", label: "Last 24 hours", days: 1 },
  { value: "3", label: "Last 3 days", days: 3 },
  { value: "7", label: "Last 7 days", days: 7 },
  { value: "14", label: "Last 14 days", days: 14 },
  { value: "30", label: "Last 30 days", days: 30 },
] as const;

const SORT_OPTIONS = [
  { value: "relevance", label: "Most relevant" },
  { value: "newest", label: "Newest first" },
  { value: "oldest", label: "Oldest first" },
  { value: "company_az", label: "Company (A–Z)" },
  { value: "match_desc", label: "Best match first" },
] as const;

const MATCH_THRESHOLD_OPTIONS = [
  { value: ANY_SCORE, label: "Any score" },
  { value: "90", label: "90+" },
  { value: "70", label: "70+" },
  { value: "50", label: "50+" },
] as const;

export type SelectableCv = { id: string; title: string };

/**
 * Real, controlled fields that navigate (router.push, same pattern
 * every other filtered-list page in this app already uses) — every
 * value becomes a query param src/app/(dashboard)/dashboard/jobs/
 * page.tsx reads directly and passes into
 * src/lib/jobs/queries.ts#searchJobs.
 *
 * The match-threshold select only does anything once a CV is picked
 * (searchJobs ignores minMatchScore without a matching cvVersionId) —
 * left visible-but-inert rather than hidden, so it's clear *why* it
 * has no effect yet rather than the option silently vanishing.
 */
export function JobFeedFilters({
  sources,
  cvs,
  defaultValues,
}: {
  sources: { id: string; name: string }[];
  cvs: SelectableCv[];
  defaultValues?: {
    keywords?: string;
    location?: string;
    sourceId?: string;
    postedWithinDays?: string;
    sort?: string;
    sponsorOnly?: boolean;
    cvId?: string;
    minScore?: string;
  };
}) {
  // Base UI's <Select.Value> only resolves a label from its popup's mounted <Select.Item>s, which
  // are portal-rendered and don't exist in the DOM until the popup has been opened at least once —
  // without an explicit `items` map, the trigger shows the raw stored value (e.g. "__all_sources__")
  // on first paint instead of its label. Every other filter Select in this app already passes one;
  // this file was the one still missing it.
  const sourceItems: Record<string, React.ReactNode> = { [ALL_SOURCES]: "All sources", ...Object.fromEntries(sources.map((source) => [source.id, source.name])) };
  const postedWithinItems: Record<string, React.ReactNode> = Object.fromEntries(POSTED_WITHIN_OPTIONS.map((option) => [option.value, option.label]));
  const sortItems: Record<string, React.ReactNode> = Object.fromEntries(SORT_OPTIONS.map((option) => [option.value, option.label]));
  const cvItems: Record<string, React.ReactNode> = { [NO_CV]: "Don't score matches", ...Object.fromEntries(cvs.map((cv) => [cv.id, cv.title])) };
  const minScoreItems: Record<string, React.ReactNode> = Object.fromEntries(MATCH_THRESHOLD_OPTIONS.map((option) => [option.value, option.label]));

  const router = useRouter();
  const [keywords, setKeywords] = useState(defaultValues?.keywords ?? "");
  const [location, setLocation] = useState(defaultValues?.location ?? "");
  const [sourceId, setSourceId] = useState(defaultValues?.sourceId ?? ALL_SOURCES);
  const [postedWithin, setPostedWithin] = useState(defaultValues?.postedWithinDays ?? ANY_TIME);
  const [sort, setSort] = useState(defaultValues?.sort ?? "relevance");
  const [sponsorOnly, setSponsorOnly] = useState(defaultValues?.sponsorOnly ?? false);
  const [cvId, setCvId] = useState(defaultValues?.cvId ?? NO_CV);
  const [minScore, setMinScore] = useState(defaultValues?.minScore ?? ANY_SCORE);

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const params = new URLSearchParams();
    if (keywords.trim()) params.set("q", keywords.trim());
    if (location.trim()) params.set("location", location.trim());
    if (sourceId !== ALL_SOURCES) params.set("source", sourceId);
    if (postedWithin !== ANY_TIME) params.set("posted", postedWithin);
    if (sort !== "relevance") params.set("sort", sort);
    if (sponsorOnly) params.set("sponsorOnly", "1");
    if (cvId !== NO_CV) {
      params.set("cv", cvId);
      if (minScore !== ANY_SCORE) params.set("minScore", minScore);
    }
    // Deliberately no `page` param — a fresh search always starts over
    // at page 1.
    const query = params.toString();
    router.push(query ? `/dashboard/jobs?${query}` : "/dashboard/jobs");
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="flex flex-col gap-2 lg:col-span-2">
          <Label htmlFor="job-keywords">Keywords</Label>
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="job-keywords"
              value={keywords}
              onChange={(event) => setKeywords(event.target.value)}
              placeholder="e.g. Product Manager"
              className="pl-8"
            />
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="job-location">Location</Label>
          <Input id="job-location" value={location} onChange={(event) => setLocation(event.target.value)} placeholder="e.g. Manchester" />
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="job-source">Source</Label>
          <Select items={sourceItems} value={sourceId} onValueChange={(value) => value && setSourceId(value)}>
            <SelectTrigger id="job-source" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_SOURCES}>All sources</SelectItem>
              {sources.map((source) => (
                <SelectItem key={source.id} value={source.id}>
                  {source.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor="job-posted">Date posted</Label>
          <Select items={postedWithinItems} value={postedWithin} onValueChange={(value) => value && setPostedWithin(value)}>
            <SelectTrigger id="job-posted" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {POSTED_WITHIN_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="job-sort">Sort by</Label>
          <Select items={sortItems} value={sort} onValueChange={(value) => value && setSort(value)}>
            <SelectTrigger id="job-sort" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SORT_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="job-cv">Match against</Label>
          <Select items={cvItems} value={cvId} onValueChange={(value) => value && setCvId(value)}>
            <SelectTrigger id="job-cv" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NO_CV}>Don&apos;t score matches</SelectItem>
              {cvs.map((cv) => (
                <SelectItem key={cv.id} value={cv.id}>
                  {cv.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="job-min-score">Match threshold</Label>
          <Select items={minScoreItems} value={minScore} onValueChange={(value) => value && setMinScore(value)} disabled={cvId === NO_CV}>
            <SelectTrigger id="job-min-score" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MATCH_THRESHOLD_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {cvId === NO_CV && <p className="text-xs text-muted-foreground">Pick a CV above to filter by match score.</p>}
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <Checkbox id="job-sponsor-only" checked={sponsorOnly} onCheckedChange={(checked) => setSponsorOnly(checked === true)} />
          <Label htmlFor="job-sponsor-only" className="text-sm font-normal">
            Licensed sponsors only
          </Label>
        </div>
        <Button type="submit">Search</Button>
      </div>
    </form>
  );
}
