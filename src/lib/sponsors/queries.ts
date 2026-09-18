import "server-only";
import { createClient } from "@/lib/supabase/server";
import { normalizeForMatch, escapeLikePattern } from "@/lib/sponsors/normalize";
import { SPONSOR_RATINGS } from "@/lib/sponsors/types";
import type {
  SponsorRating,
  SponsorSearchFilters,
  SponsorSearchResult,
  SponsorSearchResultItem,
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
// A company/alias-name search fetches a bounded candidate set and
// filters/paginates it in memory (see searchSponsors' own comment for
// why) rather than pushing the OR-across-two-tables logic into a raw
// PostgREST filter string, which would need hand-rolled escaping this
// file has no way to verify without a live database. 500 is generous
// for a *specific* search term (a real company/trading name) — only a
// single common word could plausibly exceed it, in which case
// `truncated: true` says so honestly rather than pretending totals are
// exact.
const CANDIDATE_LIMIT = 500;

const SPONSOR_SELECT_FIELDS = "id, company_name, town_city, town_city_normalized, county, rating, source_date";

type SponsorRow = {
  id: string;
  company_name: string;
  town_city: string | null;
  town_city_normalized: string | null;
  county: string | null;
  rating: SponsorRating;
  source_date: string;
};

function toSearchResultItem(row: SponsorRow, matchedAlias: string | null): SponsorSearchResultItem {
  return {
    id: row.id,
    companyName: row.company_name,
    townCity: row.town_city,
    county: row.county,
    rating: row.rating,
    matchedAlias,
  };
}

/**
 * Company/alias-name search: fetches every sponsor whose own name
 * matches (ilike, so partial/substring — "fuzzy" in the sense this
 * app's alias infrastructure was built for, migration 0053) plus every
 * sponsor reachable through a matching trading/legal-name alias, merges
 * and dedupes them (a sponsor can match both ways at once), then
 * applies city/route/rating and pagination *in memory*. Deliberately
 * not a single raw `.or()` filter string spanning both tables — that
 * would need hand-escaping user input for PostgREST's filter
 * mini-language (commas/parens have syntactic meaning there) with no
 * live database to verify it against; two separately parameterized
 * `.ilike()` calls carry no such risk.
 */
async function searchByCompanyTerm(companyTerm: string, filters: SponsorSearchFilters): Promise<SponsorSearchResult> {
  const supabase = await createClient();
  const normalized = normalizeForMatch(companyTerm);
  const pattern = `%${escapeLikePattern(normalized)}%`;

  const [{ data: directRows, error: directError }, { data: aliasRows, error: aliasError }] = await Promise.all([
    supabase.from("sponsors").select(SPONSOR_SELECT_FIELDS).ilike("company_name_normalized", pattern).limit(CANDIDATE_LIMIT),
    supabase.from("sponsor_aliases").select("sponsor_id, alias_name").ilike("alias_name_normalized", pattern).limit(CANDIDATE_LIMIT),
  ]);
  if (directError) console.error("searchByCompanyTerm: direct name search failed:", directError.message);
  if (aliasError) console.error("searchByCompanyTerm: alias search failed:", aliasError.message);

  const byId = new Map<string, { row: SponsorRow; matchedAlias: string | null }>();
  for (const row of directRows ?? []) byId.set(row.id, { row: row as SponsorRow, matchedAlias: null });

  const aliasSponsorIds = [...new Set((aliasRows ?? []).map((row) => row.sponsor_id))].filter((id) => !byId.has(id));
  if (aliasSponsorIds.length > 0) {
    const { data: aliasSponsorRows, error: aliasSponsorError } = await supabase
      .from("sponsors")
      .select(SPONSOR_SELECT_FIELDS)
      .in("id", aliasSponsorIds)
      .limit(CANDIDATE_LIMIT);
    if (aliasSponsorError) console.error("searchByCompanyTerm: fetching alias-matched sponsors failed:", aliasSponsorError.message);

    for (const row of aliasSponsorRows ?? []) {
      const matchedAlias = (aliasRows ?? []).find((a) => a.sponsor_id === row.id)?.alias_name ?? null;
      byId.set(row.id, { row: row as SponsorRow, matchedAlias });
    }
  }

  const truncated = (directRows?.length ?? 0) >= CANDIDATE_LIMIT || (aliasRows?.length ?? 0) >= CANDIDATE_LIMIT;

  let candidates = [...byId.values()];

  if (filters.city) {
    const cityNormalized = normalizeForMatch(filters.city);
    candidates = candidates.filter((c) => c.row.town_city_normalized === cityNormalized);
  }
  if (filters.rating) {
    candidates = candidates.filter((c) => c.row.rating === filters.rating);
  }
  if (filters.route) {
    const ids = candidates.map((c) => c.row.id);
    if (ids.length > 0) {
      const { data: routeRows, error: routeError } = await supabase
        .from("sponsor_routes")
        .select("sponsor_id")
        .in("sponsor_id", ids)
        .eq("route", filters.route);
      if (routeError) console.error("searchByCompanyTerm: route filter failed:", routeError.message);
      const matchingIds = new Set((routeRows ?? []).map((r) => r.sponsor_id));
      candidates = candidates.filter((c) => matchingIds.has(c.row.id));
    } else {
      candidates = [];
    }
  }

  candidates.sort((a, b) => a.row.company_name.localeCompare(b.row.company_name));

  const total = candidates.length;
  const page = Math.max(1, filters.page ?? 1);
  const start = (page - 1) * PAGE_SIZE;
  const pageRows = candidates.slice(start, start + PAGE_SIZE);

  return {
    results: pageRows.map((c) => toSearchResultItem(c.row, c.matchedAlias)),
    total,
    page,
    pageSize: PAGE_SIZE,
    totalPages: Math.max(1, Math.ceil(total / PAGE_SIZE)),
    truncated,
  };
}

/**
 * City/route/rating browsing with no company term — real database-side
 * filtering and pagination (`.range()`/`{count: "exact"}`), safe since
 * every value here goes through a parameterized filter method
 * (`.eq()`), never a hand-built string. Route filtering uses PostgREST's
 * embedded-resource inner-join filter (`sponsor_routes!inner(route)` +
 * `.eq("sponsor_routes.route", ...)`) rather than a subquery this file
 * would have to write by hand.
 */
/**
 * The route-filtered and unfiltered cases are deliberately two fully
 * separate query branches, not one `.select()` call built from a
 * ternary string — supabase-js parses a `.select()` argument as a
 * template-literal type to infer its exact return shape, which only
 * works for a literal string; a runtime-computed one (this used to be
 * `condition ? "a, b" : "a"`) type-checks as a `ParserError`, not real
 * data. Two literal `.select()` calls, each real, cost a little
 * duplication in exchange for that actually type-checking.
 */
async function browseWithoutCompanyTerm(filters: SponsorSearchFilters): Promise<SponsorSearchResult> {
  const supabase = await createClient();
  const page = Math.max(1, filters.page ?? 1);
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  let rows: SponsorRow[];
  let count: number | null;

  if (filters.route) {
    let query = supabase
      .from("sponsors")
      .select(`${SPONSOR_SELECT_FIELDS}, sponsor_routes!inner(route)`, { count: "exact" })
      .eq("sponsor_routes.route", filters.route);
    if (filters.city) query = query.eq("town_city_normalized", normalizeForMatch(filters.city));
    if (filters.rating) query = query.eq("rating", filters.rating);

    const { data, error, count: routeCount } = await query.order("company_name", { ascending: true }).range(from, to);
    if (error) {
      console.error("browseWithoutCompanyTerm (route-filtered) failed:", error.message);
      return { results: [], total: 0, page, pageSize: PAGE_SIZE, totalPages: 1, truncated: false };
    }
    rows = (data ?? []) as unknown as SponsorRow[];
    count = routeCount;
  } else {
    let query = supabase.from("sponsors").select(SPONSOR_SELECT_FIELDS, { count: "exact" });
    if (filters.city) query = query.eq("town_city_normalized", normalizeForMatch(filters.city));
    if (filters.rating) query = query.eq("rating", filters.rating);

    const { data, error, count: plainCount } = await query.order("company_name", { ascending: true }).range(from, to);
    if (error) {
      console.error("browseWithoutCompanyTerm failed:", error.message);
      return { results: [], total: 0, page, pageSize: PAGE_SIZE, totalPages: 1, truncated: false };
    }
    rows = (data ?? []) as SponsorRow[];
    count = plainCount;
  }

  // A sponsor could in principle have the same route logged twice under
  // different ratings (migration 0050's own unique key allows it),
  // which would duplicate the parent row once per matching child row
  // under an inner join — deduped defensively; real-world occurrence is
  // expected to be ~zero.
  const seen = new Set<string>();
  const deduped = rows.filter((row) => {
    if (seen.has(row.id)) return false;
    seen.add(row.id);
    return true;
  });

  return {
    results: deduped.map((row) => toSearchResultItem(row, null)),
    total: count ?? 0,
    page,
    pageSize: PAGE_SIZE,
    totalPages: Math.max(1, Math.ceil((count ?? 0) / PAGE_SIZE)),
    truncated: false,
  };
}

export async function searchSponsors(filters: SponsorSearchFilters): Promise<SponsorSearchResult> {
  const companyTerm = filters.company?.trim();
  if (companyTerm) return searchByCompanyTerm(companyTerm, filters);
  return browseWithoutCompanyTerm(filters);
}

/** The full detail for one sponsor's company profile page — real routes and aliases, not the search list's lighter row shape. Null if the id doesn't resolve to a currently-visible sponsor (RLS-filtered same as everywhere else — an inactive sponsor or one from an incomplete import 404s exactly like a nonexistent id would). */
export async function getSponsorById(id: string): Promise<SponsorListItem | null> {
  const supabase = await createClient();

  const { data: sponsor, error } = await supabase
    .from("sponsors")
    .select("id, company_name, town_city, county, rating, source_date")
    .eq("id", id)
    .maybeSingle();
  if (error) {
    console.error("getSponsorById failed:", error.message);
    return null;
  }
  if (!sponsor) return null;

  const [{ data: routeRows }, { data: aliasRows }] = await Promise.all([
    supabase.from("sponsor_routes").select("route").eq("sponsor_id", id).order("route", { ascending: true }),
    supabase.from("sponsor_aliases").select("alias_type, alias_name").eq("sponsor_id", id),
  ]);

  return {
    id: sponsor.id,
    companyName: sponsor.company_name,
    townCity: sponsor.town_city,
    county: sponsor.county,
    rating: sponsor.rating,
    routes: (routeRows ?? []).map((r) => r.route),
    aliases: (aliasRows ?? []).map((a): SponsorAlias => ({ aliasType: a.alias_type, aliasName: a.alias_name })),
    sourceDate: sponsor.source_date,
  };
}

/**
 * The real, current set of route values to populate the search filter's
 * dropdown from — never a hardcoded list. The Home Office's route
 * taxonomy has at least 17 distinct values today and can change between
 * register publications (migration 0050's own doc comment), so a fixed
 * list in this app's own code would drift out of sync with reality the
 * same way the pre-this-session marketing filter UI already had
 * (5 hardcoded values against 17+ real ones).
 */
export async function getDistinctSponsorRoutes(): Promise<string[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("sponsor_routes").select("route").order("route", { ascending: true });
  if (error) {
    console.error("getDistinctSponsorRoutes failed:", error.message);
    return [];
  }
  return [...new Set((data ?? []).map((row) => row.route))];
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

/** A cheap, head-only count of every currently-visible sponsor — the "search all N licensed sponsors" figure on the main search page and the statistics page's headline number. `head: true` skips fetching any rows, just the count RLS already scopes to active/completed-import sponsors. */
export async function getTotalSponsorCount(): Promise<number> {
  const supabase = await createClient();
  const { count, error } = await supabase.from("sponsors").select("id", { count: "exact", head: true });
  if (error) {
    console.error("getTotalSponsorCount failed:", error.message);
    return 0;
  }
  return count ?? 0;
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

  const [totalActive, { data: ratingRows, error: ratingError }, { data: routeRows, error: routeError }] = await Promise.all([
    getTotalSponsorCount(),
    supabase.from("sponsor_rating_counts").select("rating, sponsor_count"),
    supabase.from("sponsor_route_counts").select("route, sponsor_count").limit(topRoutesLimit),
  ]);
  if (ratingError) console.error("getSponsorStatistics: rating counts failed:", ratingError.message);
  if (routeError) console.error("getSponsorStatistics: route counts failed:", routeError.message);

  const byRating = Object.fromEntries(SPONSOR_RATINGS.map((rating) => [rating, 0])) as Record<SponsorRating, number>;
  for (const row of ratingRows ?? []) {
    byRating[row.rating as SponsorRating] = row.sponsor_count;
  }

  const topRoutes: SponsorRouteCount[] = (routeRows ?? []).map((row) => ({ route: row.route, count: row.sponsor_count }));

  return { totalActive, byRating, topRoutes };
}

/**
 * Real per-city counts for the fixed src/config/sponsor-cities.ts list —
 * the city list page's "N sponsors" figure and the city detail page's
 * "other cities" section. Matched against migration 0055's
 * sponsor_city_counts view by normalizing each configured city name the
 * same way sponsors.town_city_normalized already is
 * (src/lib/sponsors/normalize.ts) — a city with zero current sponsors
 * gets a real `0`, not an absent row.
 */
export async function getSponsorCityCounts(cities: { slug: string; name: string }[]): Promise<SponsorCityCount[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("sponsor_city_counts").select("town_city_normalized, sponsor_count");
  if (error) {
    console.error("getSponsorCityCounts failed:", error.message);
    return cities.map((city) => ({ ...city, count: 0 }));
  }

  const countsByNormalized = new Map((data ?? []).map((row) => [row.town_city_normalized as string, row.sponsor_count as number]));
  return cities.map((city) => ({ ...city, count: countsByNormalized.get(normalizeForMatch(city.name)) ?? 0 }));
}
