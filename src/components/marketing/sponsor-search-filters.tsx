"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SPONSOR_RATINGS, SPONSOR_RATING_LABELS, type SponsorRating } from "@/lib/sponsors/types";

const ALL_ROUTES_VALUE = "__all_routes__";
const ALL_RATINGS_VALUE = "__all_ratings__";

/**
 * Real, controlled fields that navigate (router.push, same pattern
 * every other filtered-list page in this app already uses) rather than
 * a form that just called an onSearch callback doing nothing — company/
 * city become `?company=`/`?city=` query params the search page's own
 * Server Component reads directly. `routes` is the real, current set of
 * distinct route values (src/lib/sponsors/queries.ts's
 * getDistinctSponsorRoutes) fetched server-side and passed in, never a
 * hardcoded list — the previous version of this component had exactly 5
 * hand-picked routes against 17+ real ones.
 *
 * No industry/sector filter: the real Home Office register has no such
 * column at all (Organisation Name, Town/City, County, Type & Rating,
 * Route — checked directly while building the importer), and inventing
 * a sector classification not actually in the source data would be
 * exactly the fabricated filter CLAUDE.md rules out. `Route` is the
 * closest real signal to an industry, and it's already a filter here.
 */
export function SponsorSearchFilters({
  basePath,
  cityPlaceholder = "e.g. Manchester",
  routes,
  defaultValues,
}: {
  basePath: string;
  cityPlaceholder?: string;
  routes: string[];
  defaultValues?: { company?: string; city?: string; route?: string; rating?: SponsorRating };
}) {
  const router = useRouter();
  const [company, setCompany] = useState(defaultValues?.company ?? "");
  const [city, setCity] = useState(defaultValues?.city ?? "");
  const [route, setRoute] = useState(defaultValues?.route ?? ALL_ROUTES_VALUE);
  const [rating, setRating] = useState<string>(defaultValues?.rating ?? ALL_RATINGS_VALUE);

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const params = new URLSearchParams();
    if (company.trim()) params.set("company", company.trim());
    if (city.trim()) params.set("city", city.trim());
    if (route !== ALL_ROUTES_VALUE) params.set("route", route);
    if (rating !== ALL_RATINGS_VALUE) params.set("rating", rating);
    // Deliberately no `page` param — a fresh search always starts over
    // at page 1, even if the previous search had paged further in.
    const query = params.toString();
    router.push(query ? `${basePath}?${query}` : basePath);
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5 lg:items-end">
      <div className="flex flex-col gap-2 lg:col-span-2">
        <Label htmlFor="sponsor-company">Company name</Label>
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            id="sponsor-company"
            value={company}
            onChange={(event) => setCompany(event.target.value)}
            placeholder="e.g. Deloitte, or a trading name"
            className="pl-8"
          />
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="sponsor-route">Visa route</Label>
        <Select value={route} onValueChange={(value) => value && setRoute(value)}>
          <SelectTrigger id="sponsor-route" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_ROUTES_VALUE}>All routes</SelectItem>
            {routes.map((option) => (
              <SelectItem key={option} value={option}>
                {option}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="sponsor-city">Town / city</Label>
        <Input id="sponsor-city" value={city} onChange={(event) => setCity(event.target.value)} placeholder={cityPlaceholder} />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="sponsor-rating">Rating</Label>
        <Select value={rating} onValueChange={(value) => value && setRating(value)}>
          <SelectTrigger id="sponsor-rating" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_RATINGS_VALUE}>All ratings</SelectItem>
            {SPONSOR_RATINGS.map((option) => (
              <SelectItem key={option} value={option}>
                {SPONSOR_RATING_LABELS[option]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Button type="submit" className="lg:col-span-5 lg:w-fit">
        Search
      </Button>
    </form>
  );
}
