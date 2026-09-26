"use client";

import { LayoutGrid, Search, Table2, XIcon } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { APPLICATION_STATUSES, APPLICATION_STATUS_LABELS } from "@/lib/applications/types";
import {
  APPLICATION_SORTS,
  DEADLINE_FILTER_VALUES,
  SPONSOR_FILTER_VALUES,
  hasActiveFilters,
  type ApplicationSort,
  type DeadlineFilterValue,
  type SponsorFilterValue,
  type TrackerFilterState,
  type TrackerView,
} from "@/lib/applications/view";

// Base UI's Select shows the raw value unless it is given the value -> label map, so every select below has one.
const SPONSOR_FILTER_LABELS: Record<SponsorFilterValue, string> = {
  all: "All",
  confirmed_sponsor: "Licensed sponsor",
  unconfirmed: "Unconfirmed",
  not_found: "Not on register",
  none: "Not checked yet",
};

const DEADLINE_FILTER_LABELS: Record<DeadlineFilterValue, string> = {
  all: "Any deadline",
  overdue: "Overdue",
  next_7_days: "Due in the next 7 days",
  has_deadline: "Has a deadline",
  no_deadline: "No deadline",
};

const SORT_LABELS: Record<ApplicationSort, string> = {
  updated_desc: "Last updated",
  created_desc: "Recently added",
  applied_desc: "Date applied (latest)",
  deadline_asc: "Deadline (soonest)",
  company_az: "Company (A–Z)",
  match_desc: "Match score (highest)",
  status: "Status (Wishlist → Withdrawn)",
};

const STATUS_ITEMS: Record<string, string> = { all: "All statuses", ...APPLICATION_STATUS_LABELS };

/**
 * One filter bar, shared by both views (application-tracker-board.tsx renders it once, above whichever view is active):
 * there is only ever one TrackerFilterState, so switching views can never show a different filtered/sorted set than the
 * one you were just looking at.
 */
export function ApplicationTrackerFilters({
  filters,
  onFiltersChange,
  onReset,
  cvs,
  coverLetters,
  view,
  onViewChange,
  resultCount,
}: {
  filters: TrackerFilterState;
  onFiltersChange: (filters: TrackerFilterState) => void;
  onReset: () => void;
  cvs: { id: string; title: string }[];
  coverLetters: { id: string; companyName: string; jobTitle: string }[];
  view: TrackerView;
  onViewChange: (view: TrackerView) => void;
  resultCount: number;
}) {
  function update<K extends keyof TrackerFilterState>(key: K, value: TrackerFilterState[K]) {
    onFiltersChange({ ...filters, [key]: value });
  }

  const cvItems: Record<string, string> = { all: "All", none: "No CV linked", ...Object.fromEntries(cvs.map((cv) => [cv.id, cv.title])) };
  const letterItems: Record<string, string> = {
    all: "All",
    none: "No cover letter linked",
    ...Object.fromEntries(coverLetters.map((letter) => [letter.id, `${letter.companyName} — ${letter.jobTitle}`])),
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-6">
        <div className="flex flex-col gap-2 sm:col-span-2">
          <Label htmlFor="tracker-search">Search</Label>
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
            <Input
              id="tracker-search"
              value={filters.search}
              onChange={(event) => update("search", event.target.value)}
              placeholder="Company, role, location, salary, notes"
              className="pl-8"
            />
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="tracker-status">Status</Label>
          <Select items={STATUS_ITEMS} value={filters.status} onValueChange={(value) => value && update("status", value as TrackerFilterState["status"])}>
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
          <Select items={SPONSOR_FILTER_LABELS} value={filters.sponsor} onValueChange={(value) => value && update("sponsor", value as SponsorFilterValue)}>
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
          <Label htmlFor="tracker-deadline">Deadline</Label>
          <Select items={DEADLINE_FILTER_LABELS} value={filters.deadline} onValueChange={(value) => value && update("deadline", value as DeadlineFilterValue)}>
            <SelectTrigger id="tracker-deadline" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {DEADLINE_FILTER_VALUES.map((value) => (
                <SelectItem key={value} value={value}>
                  {DEADLINE_FILTER_LABELS[value]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="tracker-cv">CV used</Label>
          <Select items={cvItems} value={filters.cvId} onValueChange={(value) => value && update("cvId", value)}>
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

        <div className="flex flex-col gap-2 lg:col-span-2">
          <Label htmlFor="tracker-letter">Cover letter</Label>
          <Select items={letterItems} value={filters.coverLetterId} onValueChange={(value) => value && update("coverLetterId", value)}>
            <SelectTrigger id="tracker-letter" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="none">No cover letter linked</SelectItem>
              {coverLetters.map((letter) => (
                <SelectItem key={letter.id} value={letter.id}>
                  {letter.companyName} — {letter.jobTitle}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-end gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="tracker-sort">Sort by</Label>
            <Select items={SORT_LABELS} value={filters.sort} onValueChange={(value) => value && update("sort", value as ApplicationSort)}>
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
          <p className="pb-2 text-sm text-muted-foreground" data-testid="tracker-result-count" aria-live="polite">
            {resultCount} match{resultCount === 1 ? "" : "es"}
          </p>
          {hasActiveFilters(filters) && (
            <Button type="button" variant="ghost" size="sm" onClick={onReset} className="mb-1">
              <XIcon className="size-3.5" /> Clear filters
            </Button>
          )}
        </div>

        <div className="flex items-center gap-1 rounded-lg border p-1">
          <Button type="button" variant={view === "kanban" ? "secondary" : "ghost"} size="sm" aria-pressed={view === "kanban"} onClick={() => onViewChange("kanban")}>
            <LayoutGrid className="size-3.5" /> Board
          </Button>
          <Button type="button" variant={view === "table" ? "secondary" : "ghost"} size="sm" aria-pressed={view === "table"} onClick={() => onViewChange("table")}>
            <Table2 className="size-3.5" /> Table
          </Button>
        </div>
      </div>
    </div>
  );
}
