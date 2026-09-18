// Canonical source for the graduate schemes domain — mirrors migration
// 0056/0057's real Postgres shape (public.graduate_schemes). Enum values
// here are the DB's own snake_case labels; a display label lives
// alongside each, same split as src/lib/sponsors/types.ts's
// SponsorRating/SPONSOR_RATING_LABELS.

export const GRADUATE_SCHEME_SECTORS = [
  "consulting",
  "banking_and_finance",
  "law",
  "technology",
  "public_sector",
] as const;
export type GraduateSchemeSector = (typeof GRADUATE_SCHEME_SECTORS)[number];

export const GRADUATE_SCHEME_SECTOR_LABELS: Record<GraduateSchemeSector, string> = {
  consulting: "Consulting",
  banking_and_finance: "Banking & Finance",
  law: "Law",
  technology: "Technology",
  public_sector: "Public Sector",
};

// Matches migration 0057's relabelled enum exactly.
export const GRADUATE_SCHEME_SPONSORSHIP_STATUSES = ["sponsors", "some_tracks", "no", "not_published"] as const;
export type GraduateSchemeSponsorshipStatus = (typeof GRADUATE_SCHEME_SPONSORSHIP_STATUSES)[number];

export const GRADUATE_SCHEME_SPONSORSHIP_STATUS_LABELS: Record<GraduateSchemeSponsorshipStatus, string> = {
  sponsors: "Sponsors",
  some_tracks: "Some tracks",
  no: "No",
  not_published: "Not published",
};

/** One public.graduate_schemes row, as the page/results component consume it. */
export type GraduateScheme = {
  id: string;
  employer: string;
  schemeName: string;
  sector: GraduateSchemeSector;
  /** Free text — published figures are a single number, a band, or "Not disclosed"; null when nothing's given at all. */
  salary: string | null;
  locations: string[];
  sponsorshipStatus: GraduateSchemeSponsorshipStatus;
  notes: string | null;
  sourceUrl: string;
  sourceDate: string;
  verifiedAt: string;
};
