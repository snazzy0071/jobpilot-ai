import Link from "next/link";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  ASSESSMENT_LABELS,
  ASSESSMENT_TYPES,
  GRADUATE_SCHEME_SECTOR_LABELS,
  GRADUATE_SCHEME_SECTORS,
  GRADUATE_SCHEME_SPONSORSHIP_STATUS_LABELS,
  GRADUATE_SCHEME_SPONSORSHIP_STATUSES,
  STUDY_STAGE_LABELS,
  STUDY_STAGES,
} from "@/lib/graduate-schemes/types";
import { SCHEME_SORT_LABELS, SCHEME_SORTS, type SchemeSort, STATUS_FILTER_LABELS, STATUS_FILTERS, hasActiveFilters, type SchemeFilters } from "@/lib/graduate-schemes/filter";

const SELECT_CLASS =
  "h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30";

function NativeSelect({ id, label, name, value, options }: { id: string; label: string; name: string; value: string; options: { value: string; label: string }[] }) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <select id={id} name={name} defaultValue={value} className={SELECT_CLASS}>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}

/**
 * A plain GET form: choosing filters and pressing "Apply" navigates to `/graduate-schemes?...`, which the server page reads.
 * So a filtered view has a shareable URL, the browser's back button works, and it needs no JavaScript.
 */
export function SchemeFiltersForm({
  filters,
  locations,
  action = "/graduate-schemes",
  label = "Search graduate schemes",
  extended = true,
  sorts = SCHEME_SORTS,
}: {
  filters: SchemeFilters;
  locations: string[];
  /** Where the form submits (the page it is on). */
  action?: string;
  label?: string;
  /** Study-stage and assessment filters (the deadlines page leaves them out). */
  extended?: boolean;
  sorts?: readonly SchemeSort[];
}) {
  const any = (label: string) => ({ value: "", label });
  return (
    <form action={action} method="get" role="search" aria-label={label} className="flex flex-col gap-4 rounded-xl border bg-card p-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="scheme-q">Employer, programme or keyword</Label>
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <Input id="scheme-q" name="q" defaultValue={filters.q} maxLength={100} placeholder="e.g. engineering, London" className="pl-8" />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <NativeSelect id="scheme-sector" label="Sector" name="sector" value={filters.sector ?? ""} options={[any("Any sector"), ...GRADUATE_SCHEME_SECTORS.map((s) => ({ value: s, label: GRADUATE_SCHEME_SECTOR_LABELS[s] }))]} />
        {extended && <NativeSelect id="scheme-stage" label="Study stage" name="stage" value={filters.stage ?? ""} options={[any("Any stage"), ...STUDY_STAGES.map((s) => ({ value: s, label: STUDY_STAGE_LABELS[s] }))]} />}
        <NativeSelect id="scheme-status" label="Applications" name="status" value={filters.status ?? ""} options={[any("Any status"), ...STATUS_FILTERS.map((s) => ({ value: s, label: STATUS_FILTER_LABELS[s] }))]} />
        <NativeSelect
          id="scheme-sponsorship"
          label="Visa sponsorship"
          name="sponsorship"
          value={filters.sponsorship ?? ""}
          options={[any("Any"), ...GRADUATE_SCHEME_SPONSORSHIP_STATUSES.map((s) => ({ value: s, label: GRADUATE_SCHEME_SPONSORSHIP_STATUS_LABELS[s] }))]}
        />
        <NativeSelect id="scheme-location" label="Location" name="location" value={filters.location} options={[any("Any location"), ...locations.map((l) => ({ value: l, label: l }))]} />
        {extended && <NativeSelect id="scheme-assessment" label="Assessment" name="assessment" value={filters.assessment ?? ""} options={[any("Any assessment"), ...ASSESSMENT_TYPES.map((s) => ({ value: s, label: ASSESSMENT_LABELS[s] }))]} />}
        <NativeSelect id="scheme-sort" label="Sort by" name="sort" value={filters.sort} options={sorts.map((s) => ({ value: s, label: SCHEME_SORT_LABELS[s] }))} />
      </div>

      <div className="flex flex-wrap gap-2">
        <Button type="submit">Apply</Button>
        {hasActiveFilters(filters) && <Button variant="outline" render={<Link href={action}>Clear filters</Link>} />}
      </div>
    </form>
  );
}
