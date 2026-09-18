"use client";

import { LayoutGrid, Search, Table2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { APPLICATION_STATUSES, APPLICATION_STATUS_LABELS, type ApplicationStatus } from "@/lib/applications/types";

export const SPONSOR_FILTER_VALUES = ["all", "confirmed_sponsor", "unconfirmed", "not_found", "none"] as const;
export type SponsorFilterValue = (typeof SPONSOR_FILTER_VALUES)[number];

const SPONSOR_FILTER_LABELS: Record<SponsorFilterValue, string> = {
  all: "All",
  confirmed_sponsor: "Licensed sponsor",
  unconfirmed: "Unconfirmed",
  not_found: "Not on register",
  none: "Not checked yet",
};

export const APPLICATION_SORTS = ["updated_desc", "deadline_asc", "company_az", "match_desc", "status"] as const;
export type ApplicationSort = (typeof APPLICATION_SORTS)[number];

const SORT_LABELS: Record<ApplicationSort, string> = {
  updated_desc: "Last updated",
  deadline_asc: "Deadline (soonest)",
  company_az: "Company (A–Z)",
  match_desc: "Match score (highest)",
  status: "Status (Wishlist → Withdrawn)",
};

export type TrackerView = "kanban" | "table";

export type TrackerFilterState = {
  search: string;
  status: ApplicationStatus | "all";
  sponsor: SponsorFilterValue;
  cvId: string | "all";
  sort: ApplicationSort;
};

export const DEFAULT_TRACKER_FILTERS: TrackerFilterState = {
  search: "",
  status: "all",
  sponsor: "all",
  cvId: "all",
  sort: "updated_desc",
};

/**
 * One filter bar, shared by both views (src/components/applications/
 * application-tracker-board.tsx renders this once, above whichever
 * view is active) — the actual mechanism behind "keep Kanban/Table
 * state consistent": there's only ever one `TrackerFilterState`, so
 * switching views can never show a different filtered/sorted set than
 * the one you were just looking at.
 */
export function ApplicationTrackerFilters({
  filters,
  onFiltersChange,
  cvs,
  view,
  onViewChange,
  resultCount,
}: {
  filters: TrackerFilterState;
  onFiltersChange: (filters: TrackerFilterState) => void;
  cvs: { id: string; title: string }[];
  view: TrackerView;
  onViewChange: (view: TrackerView) => void;
  resultCount: number;
}) {
  function update<K extends keyof TrackerFilterState>(key: K, value: TrackerFilterState[K]) {
    onFiltersChange({ ...filters, [key]: value });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <div className="flex flex-col gap-2 lg:col-span-2">
          <Label htmlFor="tracker-search">Search</Label>
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="tracker-search"
              value={filters.search}
              onChange={(event) => update("search", event.target.value)}
              placeholder="Company or role"
              className="pl-8"
            />
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="tracker-status">Status</Label>
          <Select value={filters.status} onValueChange={(value) => value && update("status", value as TrackerFilterState["status"])}>
            <SelectTrigger id="tracker-status" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              {APPLICATION_STATUSES.map((status) => (
                <SelectItem key={status} value={status}>
                  {APPLICATION_STATUS_LABELS[status]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="tracker-sponsor">Sponsor state</Label>
          <Select value={filters.sponsor} onValueChange={(value) => value && update("sponsor", value as SponsorFilterValue)}>
            <SelectTrigger id="tracker-sponsor" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SPONSOR_FILTER_VALUES.map((value) => (
                <SelectItem key={value} value={value}>
                  {SPONSOR_FILTER_LABELS[value]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="tracker-cv">CV used</Label>
          <Select value={filters.cvId} onValueChange={(value) => value && update("cvId", value)}>
            <SelectTrigger id="tracker-cv" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="none">No CV linked</SelectItem>
              {cvs.map((cv) => (
                <SelectItem key={cv.id} value={cv.id}>
                  {cv.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-end gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="tracker-sort">Sort by</Label>
            <Select value={filters.sort} onValueChange={(value) => value && update("sort", value as ApplicationSort)}>
              <SelectTrigger id="tracker-sort" className="w-[220px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {APPLICATION_SORTS.map((sort) => (
                  <SelectItem key={sort} value={sort}>
                    {SORT_LABELS[sort]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <p className="pb-2 text-sm text-muted-foreground">
            {resultCount} match{resultCount === 1 ? "" : "es"}
          </p>
        </div>

        <div className="flex items-center gap-1 rounded-lg border p-1">
          <Button
            type="button"
            variant={view === "kanban" ? "secondary" : "ghost"}
            size="sm"
            aria-pressed={view === "kanban"}
            onClick={() => onViewChange("kanban")}
          >
            <LayoutGrid className="size-3.5" /> Board
          </Button>
          <Button
            type="button"
            variant={view === "table" ? "secondary" : "ghost"}
            size="sm"
            aria-pressed={view === "table"}
            onClick={() => onViewChange("table")}
          >
            <Table2 className="size-3.5" /> Table
          </Button>
        </div>
      </div>
    </div>
  );
}
