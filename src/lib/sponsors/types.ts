// Canonical source for the UK visa sponsor register domain — mirrors
// migrations 0049/0050's real Postgres shape. `SponsorRating` is a
// bucket *this app* defines over the Home Office's own much messier
// real "Type & Rating" text (confirmed against the live register while
// building scripts/import-sponsors.mjs — that file has its own doc
// comment on exactly what was checked), not a taxonomy gov.uk publishes
// directly; `route` is deliberately plain text everywhere in this
// domain, never an enum, since the Home Office's real route taxonomy
// has at least 17 distinct values today and can change between register
// publications without this app's schema changing (migration 0050's own
// doc comment goes through why).
//
// scripts/import-sponsors.mjs mirrors the rating-bucket/rank logic below
// in plain JS rather than importing this file directly — no TypeScript
// runner is set up for standalone scripts in this project yet (see that
// script's own header comment). Keep the two in sync by hand if this
// ever changes.

export const SPONSOR_RATINGS = ["a_rating", "a_rating_provisional", "b_rating", "other"] as const;
export type SponsorRating = (typeof SPONSOR_RATINGS)[number];

export const SPONSOR_RATING_LABELS: Record<SponsorRating, string> = {
  a_rating: "A rating",
  a_rating_provisional: "A rating (provisional)",
  b_rating: "B rating",
  other: "Other",
};

/** Best-to-worst (lower = better) — how scripts/import-sponsors.mjs picks one summary rating for `sponsors.rating` across a sponsor's individual `sponsor_routes` entries. */
export const SPONSOR_RATING_RANK: Record<SponsorRating, number> = {
  a_rating: 0,
  a_rating_provisional: 1,
  other: 2,
  b_rating: 3,
};

export const SPONSOR_IMPORT_STATUSES = ["pending", "processing", "completed", "failed"] as const;
export type SponsorImportStatus = (typeof SPONSOR_IMPORT_STATUSES)[number];

/**
 * One "also known as" name for a sponsor (migration 0053's
 * sponsor_aliases) — never a rewrite of `company_name`, only something
 * alongside it. `aliasType` is plain text, not a fixed union, matching
 * that migration's own reasoning: it's a small, app-defined
 * categorisation ('trading_as'/'legal_name' today), not a closed set
 * this type needs to police.
 */
export type SponsorAlias = {
  aliasType: string;
  aliasName: string;
};

/** The full detail for one sponsor — the company profile page's real shape (src/lib/sponsors/queries.ts's getSponsorById). */
export type SponsorListItem = {
  id: string;
  companyName: string;
  townCity: string | null;
  county: string | null;
  rating: SponsorRating;
  routes: string[];
  aliases: SponsorAlias[];
  sourceDate: string;
};

/** One row in the search/city results list — lighter than SponsorListItem (no routes/aliases fetched per row in a paginated list; the company page fetches those on demand). */
export type SponsorSearchResultItem = {
  id: string;
  companyName: string;
  townCity: string | null;
  county: string | null;
  rating: SponsorRating;
  /** The alias text this row actually matched on, when the search term hit a trading/legal-name alias rather than the primary company_name — null for a direct match or when no company term was searched. */
  matchedAlias: string | null;
};

export type SponsorSearchFilters = {
  company?: string;
  city?: string;
  route?: string;
  rating?: SponsorRating;
  page?: number;
};

export type SponsorSearchResult = {
  results: SponsorSearchResultItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  /**
   * True when a company-name search hit queries.ts's CANDIDATE_LIMIT —
   * the term matched more sponsors/aliases than were fetched to filter
   * and paginate in memory, so `total`/`totalPages` undercount the real
   * result set. Only ever true for a very broad term (a single common
   * word); city/route/rating-only browsing has no such cap.
   */
  truncated: boolean;
};

export const SPONSOR_CHANGE_TYPES = ["added", "reactivated", "deactivated"] as const;
export type SponsorChangeType = (typeof SPONSOR_CHANGE_TYPES)[number];

/** One migration 0054 sponsor_sync_changes row — a sponsor whose existence state changed in a given sync run. */
export type SponsorSyncChange = {
  id: string;
  importId: string;
  sponsorId: string;
  changeType: SponsorChangeType;
  companyName: string;
  createdAt: string;
};

/** Migration 0054's sponsor_sync_status view, as one row — "when did this last succeed, and what happened". Null when no import has ever completed yet. */
export type SponsorSyncStatus = {
  importId: string;
  sourceDate: string;
  sponsorCount: number;
  routeCount: number;
  aliasCount: number;
  addedCount: number;
  reactivatedCount: number;
  deactivatedCount: number;
  completedAt: string;
  /** Postgres interval, as PostgREST serializes it (e.g. "2 days 03:14:52") — parse client-side if a numeric staleness threshold is ever needed. */
  timeSinceLastSuccess: string;
};

/** One migration 0055 sponsor_route_counts row — a real route, with how many currently-visible sponsors hold it. */
export type SponsorRouteCount = {
  route: string;
  count: number;
};

/** migration 0055's sponsor_rating_counts view, reshaped into one entry per real rating bucket (0 for a bucket with no current sponsors, not an absent key). */
export type SponsorRatingCounts = Record<SponsorRating, number>;

/** The statistics page's real numbers (src/lib/sponsors/queries.ts's getSponsorStatistics) — every figure grouped by a column that actually exists (rating, route); no "region"/"nation"/"sector" breakdown, since the register has no such column to group by. */
export type SponsorStatistics = {
  totalActive: number;
  byRating: SponsorRatingCounts;
  topRoutes: SponsorRouteCount[];
};

/** One entry in the city list/nearby-cities sections — src/config/sponsor-cities.ts's fixed list, enriched with a real count from migration 0055's sponsor_city_counts view. */
export type SponsorCityCount = {
  slug: string;
  name: string;
  count: number;
};
