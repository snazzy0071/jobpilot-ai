"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, ExternalLink, MapPin, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion";
import {
  GRADUATE_SCHEME_SECTORS,
  GRADUATE_SCHEME_SECTOR_LABELS,
  GRADUATE_SCHEME_SPONSORSHIP_STATUSES,
  GRADUATE_SCHEME_SPONSORSHIP_STATUS_LABELS,
  type GraduateScheme,
  type GraduateSchemeSponsorshipStatus,
} from "@/lib/graduate-schemes/types";
import { isStale, STALE_AFTER_DAYS } from "@/lib/graduate-schemes/staleness";

const ALL_SECTORS = "All sectors";
const ALL_STATUSES = "All statuses";
const SECTOR_OPTIONS = [ALL_SECTORS, ...GRADUATE_SCHEME_SECTORS] as const;
const STATUS_OPTIONS = [ALL_STATUSES, ...GRADUATE_SCHEME_SPONSORSHIP_STATUSES] as const;
const SORT_OPTIONS = ["Employer (A–Z)", "Sector", "Sponsorship status"] as const;

function sectorLabel(value: (typeof SECTOR_OPTIONS)[number]): string {
  return value === ALL_SECTORS ? value : GRADUATE_SCHEME_SECTOR_LABELS[value];
}

function statusLabel(value: (typeof STATUS_OPTIONS)[number]): string {
  return value === ALL_STATUSES ? value : GRADUATE_SCHEME_SPONSORSHIP_STATUS_LABELS[value];
}

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" }).format(new Date(iso));
}

const STATUS_BADGE_VARIANT: Record<GraduateSchemeSponsorshipStatus, "default" | "secondary" | "destructive" | "outline"> = {
  sponsors: "default",
  some_tracks: "secondary",
  no: "destructive",
  not_published: "outline",
};

function StatusBadge({ status }: { status: GraduateSchemeSponsorshipStatus }) {
  return <Badge variant={STATUS_BADGE_VARIANT[status]}>{GRADUATE_SCHEME_SPONSORSHIP_STATUS_LABELS[status]}</Badge>;
}

/**
 * Real rows from src/lib/graduate-schemes/queries.ts's
 * getGraduateSchemes — fetched once server-side and filtered/sorted
 * entirely client-side here, same non-paginated approach the header
 * comment on that query file explains (a small curated table, not the
 * ~130k-row sponsor register).
 */
export function GradSchemeResults({ schemes }: { schemes: GraduateScheme[] }) {
  const [search, setSearch] = useState("");
  const [sector, setSector] = useState<(typeof SECTOR_OPTIONS)[number]>(ALL_SECTORS);
  const [status, setStatus] = useState<(typeof STATUS_OPTIONS)[number]>(ALL_STATUSES);
  const [sort, setSort] = useState<(typeof SORT_OPTIONS)[number]>(SORT_OPTIONS[0]);

  const results = useMemo(() => {
    const term = search.trim().toLowerCase();
    const filtered = schemes.filter((scheme) => {
      const matchesSearch =
        term === "" ||
        scheme.employer.toLowerCase().includes(term) ||
        scheme.schemeName.toLowerCase().includes(term);
      const matchesSector = sector === ALL_SECTORS || scheme.sector === sector;
      const matchesStatus = status === ALL_STATUSES || scheme.sponsorshipStatus === status;
      return matchesSearch && matchesSector && matchesStatus;
    });

    return [...filtered].sort((a, b) => {
      if (sort === "Sector") {
        return (
          GRADUATE_SCHEME_SECTOR_LABELS[a.sector].localeCompare(GRADUATE_SCHEME_SECTOR_LABELS[b.sector]) ||
          a.employer.localeCompare(b.employer)
        );
      }
      if (sort === "Sponsorship status") {
        return (
          GRADUATE_SCHEME_SPONSORSHIP_STATUS_LABELS[a.sponsorshipStatus].localeCompare(
            GRADUATE_SCHEME_SPONSORSHIP_STATUS_LABELS[b.sponsorshipStatus],
          ) || a.employer.localeCompare(b.employer)
        );
      }
      return a.employer.localeCompare(b.employer) || a.schemeName.localeCompare(b.schemeName);
    });
  }, [schemes, search, sector, status, sort]);

  return (
    <div className="flex flex-col gap-6">
      <form
        onSubmit={(event) => event.preventDefault()}
        className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 lg:items-end"
      >
        <div className="flex flex-col gap-2">
          <Label htmlFor="schemeSearch">Scheme or employer</Label>
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="schemeSearch"
              placeholder="e.g. Deloitte"
              className="pl-8"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="sponsorshipStatus">Sponsorship status</Label>
          <Select value={status} onValueChange={(value) => setStatus((value as typeof status) ?? ALL_STATUSES)}>
            <SelectTrigger id="sponsorshipStatus" className="w-full">
              <SelectValue>{statusLabel(status)}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {STATUS_OPTIONS.map((option) => (
                <SelectItem key={option} value={option}>
                  {statusLabel(option)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="sector">Sector</Label>
          <Select value={sector} onValueChange={(value) => setSector((value as typeof sector) ?? ALL_SECTORS)}>
            <SelectTrigger id="sector" className="w-full">
              <SelectValue>{sectorLabel(sector)}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {SECTOR_OPTIONS.map((option) => (
                <SelectItem key={option} value={option}>
                  {sectorLabel(option)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="sortBy">Sort by</Label>
          <Select
            value={sort}
            onValueChange={(value) => setSort((value ?? SORT_OPTIONS[0]) as (typeof SORT_OPTIONS)[number])}
          >
            <SelectTrigger id="sortBy" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SORT_OPTIONS.map((option) => (
                <SelectItem key={option} value={option}>
                  {option}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </form>

      <p className="text-sm text-muted-foreground">
        {results.length} scheme{results.length === 1 ? "" : "s"} found
      </p>

      {results.length === 0 ? (
        <Card className="items-center gap-2 p-10 text-center">
          <p className="font-medium">No schemes match those filters</p>
          <p className="text-sm text-muted-foreground">
            Try a different sector, status, or search term.
          </p>
        </Card>
      ) : (
        <div className="flex flex-col gap-3">
          {results.map((scheme) => (
            <Card key={scheme.id} className="gap-2 p-5">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-medium">{scheme.schemeName}</p>
                  <p className="text-sm text-muted-foreground">
                    {scheme.employer} · {GRADUATE_SCHEME_SECTOR_LABELS[scheme.sector]}
                  </p>
                </div>
                <StatusBadge status={scheme.sponsorshipStatus} />
              </div>

              <Accordion>
                <AccordionItem value="details">
                  <AccordionTrigger className="text-xs text-muted-foreground">
                    Details &amp; source evidence
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className="flex flex-col gap-3 text-sm">
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div>
                          <p className="text-xs text-muted-foreground">Salary</p>
                          <p>{scheme.salary ?? "Not disclosed"}</p>
                        </div>
                        <div>
                          <p className="mb-1 text-xs text-muted-foreground">Locations</p>
                          {scheme.locations.length > 0 ? (
                            <div className="flex flex-wrap gap-1.5">
                              {scheme.locations.map((location) => (
                                <Badge key={location} variant="outline" className="gap-1">
                                  <MapPin className="size-3" />
                                  {location}
                                </Badge>
                              ))}
                            </div>
                          ) : (
                            <p>Not given</p>
                          )}
                        </div>
                      </div>

                      {scheme.notes && (
                        <div>
                          <p className="text-xs text-muted-foreground">Notes</p>
                          <p>{scheme.notes}</p>
                        </div>
                      )}

                      <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-3 text-xs text-muted-foreground">
                        <a
                          href={scheme.sourceUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 font-medium text-foreground hover:underline"
                        >
                          View source
                          <ExternalLink className="size-3" />
                        </a>
                        <span className="inline-flex items-center gap-1">
                          Source dated {formatDate(scheme.sourceDate)} · Verified {formatDate(scheme.verifiedAt)}
                          {isStale(scheme.verifiedAt) && (
                            <span
                              title={`Not rechecked in over ${STALE_AFTER_DAYS} days`}
                              className="inline-flex items-center gap-1 text-amber-600 dark:text-amber-500"
                            >
                              <AlertTriangle className="size-3" />
                              Needs review
                            </span>
                          )}
                        </span>
                      </div>
                    </div>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
