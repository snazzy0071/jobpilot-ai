import "server-only";
import { createClient } from "@/lib/supabase/server";
import { normalizeForMatch } from "@/lib/sponsors/normalize";
import { SPONSOR_RATINGS } from "@/lib/sponsors/types";
import type {
  SponsorRating,
  SponsorSearchFilters,
  SponsorSearchResult,
  SponsorListItem,
  SponsorAlias,
  SponsorSyncStatus,
  SponsorStatistics,
  SponsorRouteCount,
  SponsorCityCount,
} from "@/lib/sponsors/types";

// Every function here runs through the request-scoped client
// (src/lib/supabase/server.ts), never the service-role admin client —
// this is a public, unauthenticated feature (no requireUser() anywhere
// in this file), so it must see exactly what an anonymous visitor's own
// RLS-governed request would see: active sponsors from a completed
// import only (migrations 0049/0050/0053's own select policies). Using
// the admin client here would silently leak deactivated sponsors or
// half-imported rows into a "is this employer a licensed sponsor"
// checker — the one place that would be actively misleading rather than
// just incomplete.

const PAGE_SIZE = 20;

type SearchRpcRow = {
  id: string;
  company_name: string;
  town_city: string | null;
  county: string | null;
  rating: SponsorRating;
  source_date: string;
  matched_alias: string | null;
  total_count: number | string;
};

/**
 * Company/city/route/rating search — one call to migration 0095's search_sponsors RPC, which does the matching,
 * ranking, every filter and the paging in the database. Matching is on a punctuation-insensitive search form of the
 * name with trigram indexes, so "rolls royce" finds "Rolls-Royce plc", a small typo still finds the company, and a
 * trading/legal-name alias hit reports which alias matched. It runs as the caller (no service-role client), so
 * row-level security still limits it to active sponsors. The previous version fetched 500 arbitrary rows and
 * filtered them in memory, which dropped genuine matches on the real 127k-sponsor register.
 */
export async function searchSponsors(filters: SponsorSearchFilters): Promise<SponsorSearchResult> {
  const supabase = await createClient();
  const page = Math.max(1, Math.floor(filters.page ?? 1));

  const args = {
    p_query: filters.company?.trim() || null,
    p_city: filters.city?.trim() || null,
    p_route: filters.route?.trim() || null,
    p_rating: filters.rating ?? null,
  };
  const { data, error } = await supabase.rpc("search_sponsors", { ...args, p_limit: PAGE_SIZE, p_offset: (page - 1) * PAGE_SIZE });
  if (error) {
    console.error("searchSponsors failed:", error.message);
    return { results: [], total: 0, page, pageSize: PAGE_SIZE, totalPages: 1, truncated: false };
  }

  let rows = (data ?? []) as SearchRpcRow[];
  let total = rows.length > 0 ? Number(rows[0].total_count) : 0;
  if (rows.length === 0 && page > 1) {
    // A page past the end has no rows to read the total from — ask for the first row of the first page instead.
    const { data: first } = await supabase.rpc("search_sponsors", { ...args, p_limit: 1, p_offset: 0 });
    total = first && first.length > 0 ? Number((first as SearchRpcRow[])[0].total_count) : 0;
    rows = [];
  }

  return {
    results: rows.map((row) => ({
      id: row.id,
      companyName: row.company_name,
      townCity: row.town_city,
      county: row.county,
      rating: row.rating,
      matchedAlias: row.matched_alias,
    })),
    total,
    page,
    pageSize: PAGE_SIZE,
    totalPages: Math.max(1, Math.ceil(total / PAGE_SIZE)),
    truncated: false,
  };
}

/**
 * One sponsor's company profile via migration 0095's get_sponsor_detail — including one that has since dropped off
 * the register (`isActive: false`, with the source date of the sync that removed it), so a saved link says "no
 * longer on the register" rather than 404ing as though the company never existed. Null only for an id that never
 * existed (or before any sync has completed).
 */
export async function getSponsorById(id: string): Promise<SponsorListItem | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_sponsor_detail", { p_id: id });
  if (error) {
    console.error("getSponsorById failed:", error.message);
    return null;
  }
  const row = data?.[0] as
    | {
        id: string;
        company_name: string;
        town_city: string | null;
        county: string | null;
        rating: SponsorRating;
        source_date: string;
        is_active: boolean;
        removed_on: string | null;
        routes: string[];
        aliases: SponsorAlias[];
      }
    | undefined;
  if (!row) return null;

  return {
    id: row.id,
    companyName: row.company_name,
    townCity: row.town_city,
    county: row.county,
    rating: row.rating,
    routes: row.routes ?? [],
    aliases: row.aliases ?? [],
    sourceDate: row.source_date,
    isActive: row.is_active,
    removedOn: row.removed_on,
  };
}

/**
 * The real, current set of routes for the search filter's dropdown — never a hardcoded list (the Home Office's
 * taxonomy has 17+ values and changes between publications). Read from the sponsor_route_counts view, one row per
 * route. It used to select every sponsor_routes row and de-duplicate in JS, which PostgREST silently caps at 1,000
 * rows — on the real 142k-row table that returned only the first few routes alphabetically.
 */
export async function getDistinctSponsorRoutes(): Promise<string[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("sponsor_route_counts").select("route").order("route", { ascending: true });
  if (error) {
    console.error("getDistinctSponsorRoutes failed:", error.message);
    return [];
  }
  return (data ?? []).map((row) => row.route as string);
}

/** "Data as of..." for the source-date disclaimer — migration 0054's sponsor_sync_status view, one ready row. Null if no import has ever completed (a freshly-migrated, never-synced project). */
export async function getSponsorSyncStatus(): Promise<SponsorSyncStatus | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("sponsor_sync_status").select("*").maybeSingle();
  if (error) {
    console.error("getSponsorSyncStatus failed:", error.message);
    return null;
  }
  if (!data) return null;

  return {
    importId: data.import_id,
    sourceDate: data.source_date,
    sponsorCount: data.sponsor_count,
    routeCount: data.route_count,
    aliasCount: data.alias_count,
    addedCount: data.added_count,
    reactivatedCount: data.reactivated_count,
    deactivatedCount: data.deactivated_count,
    completedAt: data.completed_at,
    timeSinceLastSuccess: data.time_since_last_success,
  };
}

/**
 * Every currently-listed sponsor — the "search all N licensed sponsors" figure and the statistics page's headline
 * number. Summed from the rating-count view (one row per rating) instead of `count(*)` over 127k RLS-filtered rows,
 * which is the slow way to get a number that only changes when the register does.
 */
export async function getTotalSponsorCount(): Promise<number> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("sponsor_rating_counts").select("sponsor_count");
  if (error) {
    console.error("getTotalSponsorCount failed:", error.message);
    return 0;
  }
  return (data ?? []).reduce((sum, row) => sum + (row.sponsor_count as number), 0);
}

/**
 * The statistics page's real numbers — migration 0055's
 * sponsor_rating_counts/sponsor_route_counts views, reshaped into one
 * object. No "region"/"nation"/"sector" breakdown: the register has no
 * such column to group by (see that migration's own doc comment), so
 * this only ever reports what's actually groupable — rating and route.
 */
export async function getSponsorStatistics(topRoutesLimit = 10): Promise<SponsorStatistics> {
  const supabase = await createClient();

  const [{ data: ratingRows, error: ratingError }, { data: routeRows, error: routeError }] = await Promise.all([
    supabase.from("sponsor_rating_counts").select("rating, sponsor_count"),
    supabase.from("sponsor_route_counts").select("route, sponsor_count").order("sponsor_count", { ascending: false }).limit(topRoutesLimit),
  ]);
  if (ratingError) console.error("getSponsorStatistics: rating counts failed:", ratingError.message);
  if (routeError) console.error("getSponsorStatistics: route counts failed:", routeError.message);

  const byRating = Object.fromEntries(SPONSOR_RATINGS.map((rating) => [rating, 0])) as Record<SponsorRating, number>;
  for (const row of ratingRows ?? []) {
    byRating[row.rating as SponsorRating] = row.sponsor_count;
  }

  const topRoutes: SponsorRouteCount[] = (routeRows ?? []).map((row) => ({ route: row.route, count: row.sponsor_count }));

  const totalActive = Object.values(byRating).reduce((sum, count) => sum + count, 0);

  return { totalActive, byRating, topRoutes };
}

/**
 * Real per-city counts for the fixed src/config/sponsor-cities.ts list — the city list page's "N sponsors" figure
 * and the city detail page's "other cities" section. Asks the sponsor_city_counts view for just the configured
 * cities, by the same normalization sponsors.town_city_normalized uses (src/lib/sponsors/normalize.ts): the view has
 * a row for every town on the register, far past PostgREST's 1,000-row cap, so reading it whole and looking cities up
 * in the result could silently return 0 for a real city. A city with no current sponsors gets a real `0`.
 */
export async function getSponsorCityCounts(cities: { slug: string; name: string }[]): Promise<SponsorCityCount[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("sponsor_city_counts")
    .select("town_city_normalized, sponsor_count")
    .in(
      "town_city_normalized",
      cities.map((city) => normalizeForMatch(city.name)),
    );
  if (error) {
    console.error("getSponsorCityCounts failed:", error.message);
    return cities.map((city) => ({ ...city, count: 0 }));
  }

  const countsByNormalized = new Map((data ?? []).map((row) => [row.town_city_normalized as string, row.sponsor_count as number]));
  return cities.map((city) => ({ ...city, count: countsByNormalized.get(normalizeForMatch(city.name)) ?? 0 }));
}
