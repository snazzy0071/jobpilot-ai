import "server-only";
import { createClient } from "@/lib/supabase/server";
import { normalizeForMatch } from "@/lib/sponsors/normalize";
import { SPONSOR_RATING_RANK, type SponsorRating } from "@/lib/sponsors/types";

// Cross-references a job's employer name against the UK visa sponsor
// register (src/lib/sponsors/) — reuses that domain's own
// normalizeForMatch (not src/lib/jobs/normalize.ts's copy) *on purpose*:
// correctness here depends on normalizing a job's company name exactly
// the way the register's own company_name_normalized/
// alias_name_normalized columns were normalized, so drift between two
// independently-maintained copies would silently break matches. Reads
// through the anon-respecting client (public register data, same rule
// src/lib/sponsors/queries.ts documents), never the admin client.
//
// The one rule this whole file exists to enforce: a job is only ever
// shown as a confirmed sponsor when the match is completely
// unambiguous. Multiple distinct companies matching, or a match that
// only holds after stripping a legal-entity suffix (so it's plausible
// but not a confirmed identity), both stay "unconfirmed" — never
// "Sponsors" and never "Not a sponsor". The register itself can also be
// stale or a job's employer name can differ from its registered name
// for reasons that have nothing to do with sponsorship status, so even
// "not_found" is phrased as an absence from the register, not a claim
// that the employer definitely can't sponsor.

export const JOB_SPONSOR_MATCH_STATUSES = ["confirmed_sponsor", "unconfirmed", "not_found"] as const;
export type JobSponsorMatchStatus = (typeof JOB_SPONSOR_MATCH_STATUSES)[number];

export const JOB_SPONSOR_MATCH_CONFIDENCES = ["exact", "likely", "ambiguous", "none"] as const;
export type JobSponsorMatchConfidence = (typeof JOB_SPONSOR_MATCH_CONFIDENCES)[number];

export type JobSponsorMatchCandidate = {
  sponsorId: string;
  companyName: string;
  townCity: string | null;
  rating: SponsorRating;
  matchedVia: "name" | "alias";
};

export type JobSponsorMatch = {
  status: JobSponsorMatchStatus;
  confidence: JobSponsorMatchConfidence;
  /**
   * One or more sponsor register rows. When status is
   * 'confirmed_sponsor', every entry here is the *same* real company
   * (it can legitimately hold more than one register row — one per
   * office location, see sponsors' own unique(company_name_normalized,
   * town_city_normalized) key). When confidence is 'ambiguous', these
   * are the *distinct*, unresolved candidates found — shown for
   * transparency about what was found, without asserting which (if
   * any) is the real employer. Always empty for 'not_found'.
   */
  sponsors: JobSponsorMatchCandidate[];
};

const NO_MATCH: JobSponsorMatch = { status: "not_found", confidence: "none", sponsors: [] };

type SponsorRow = {
  id: string;
  company_name: string;
  town_city: string | null;
  rating: SponsorRating;
  company_name_normalized: string;
};

/** Best-rated row first — mirrors scripts/import-sponsors.mjs's own bestRating() tie-break for showing one representative rating when a company has more than one register row. */
function sortByBestRating(rows: SponsorRow[]): SponsorRow[] {
  return [...rows].sort((a, b) => SPONSOR_RATING_RANK[a.rating] - SPONSOR_RATING_RANK[b.rating]);
}

function toCandidate(row: SponsorRow, matchedVia: "name" | "alias"): JobSponsorMatchCandidate {
  return {
    sponsorId: row.id,
    companyName: row.company_name,
    townCity: row.town_city,
    rating: row.rating,
    matchedVia,
  };
}

// UK company legal-entity suffixes — stripped (repeatedly, from the
// end) before a "likely" (not exact) comparison. Deliberately not used
// to *confirm* a match on its own: two genuinely different companies
// can share a stripped stem (e.g. "Bright Path" vs "Bright Path
// Consulting"), so a stem match only ever downgrades to 'likely'/
// 'unconfirmed', never 'exact'.
const LEGAL_SUFFIXES = new Set([
  "limited",
  "ltd",
  "plc",
  "llp",
  "llc",
  "inc",
  "incorporated",
  "corp",
  "corporation",
  "co",
  "company",
  "group",
  "holdings",
  "uk",
]);

export function stripLegalSuffixes(normalized: string): string {
  const words = normalized.split(" ").filter(Boolean);
  while (words.length > 1) {
    const last = words[words.length - 1].replace(/[.,]+$/, "");
    if (!LEGAL_SUFFIXES.has(last)) break;
    words.pop();
  }
  return words.join(" ");
}

/**
 * Cross-references a batch of job employer names against the sponsor
 * register in a small, fixed number of queries — never one query per
 * company — same "batch it" discipline as
 * src/lib/jobs/dedupe.ts#buildDuplicateLookup.
 */
export async function matchJobsToSponsors(companyNames: string[]): Promise<Map<string, JobSponsorMatch>> {
  const results = new Map<string, JobSponsorMatch>();
  const uniqueNames = [...new Set(companyNames.map((name) => name.trim()).filter(Boolean))];
  if (uniqueNames.length === 0) return results;

  const normalizedByName = new Map(uniqueNames.map((name) => [name, normalizeForMatch(name)]));
  const normalizedKeys = [...new Set(normalizedByName.values())];

  const supabase = await createClient();

  // --- Tier 1: exact match, on the sponsor's own registered name or a
  // known trading/legal-name alias.
  const [{ data: nameRows, error: nameError }, { data: aliasRows, error: aliasError }] = await Promise.all([
    supabase
      .from("sponsors")
      .select("id, company_name, town_city, rating, company_name_normalized")
      .in("company_name_normalized", normalizedKeys),
    supabase.from("sponsor_aliases").select("sponsor_id, alias_name_normalized").in("alias_name_normalized", normalizedKeys),
  ]);

  if (nameError || aliasError) throw new Error(`Sponsor cross-check failed: ${(nameError ?? aliasError)?.message}`);

  const exactByKey = new Map<string, { row: SponsorRow; via: "name" | "alias" }[]>();
  for (const row of (nameRows ?? []) as SponsorRow[]) {
    const list = exactByKey.get(row.company_name_normalized) ?? [];
    list.push({ row, via: "name" });
    exactByKey.set(row.company_name_normalized, list);
  }

  const aliasSponsorIds = [...new Set((aliasRows ?? []).map((row) => row.sponsor_id))];
  if (aliasSponsorIds.length > 0) {
    const { data: aliasSponsors } = await supabase
      .from("sponsors")
      .select("id, company_name, town_city, rating, company_name_normalized")
      .in("id", aliasSponsorIds);
    const sponsorsById = new Map(((aliasSponsors ?? []) as SponsorRow[]).map((row) => [row.id, row]));
    for (const aliasRow of aliasRows ?? []) {
      const sponsor = sponsorsById.get(aliasRow.sponsor_id);
      if (!sponsor) continue;
      const list = exactByKey.get(aliasRow.alias_name_normalized) ?? [];
      list.push({ row: sponsor, via: "alias" });
      exactByKey.set(aliasRow.alias_name_normalized, list);
    }
  }

  // --- Tier 2 (only for names Tier 1 found nothing for): a single,
  // unambiguous match after stripping a legal-entity suffix.
  const unresolvedNames = uniqueNames.filter((name) => !exactByKey.has(normalizedByName.get(name)!));
  const stemByName = new Map(unresolvedNames.map((name) => [name, stripLegalSuffixes(normalizedByName.get(name)!)]));
  const uniqueStems = [...new Set(stemByName.values())].filter((stem) => stem.length >= 3);

  const stemCandidates = new Map<string, SponsorRow[]>();
  if (uniqueStems.length > 0) {
    // One set-based call for every stem (migration 0101's sponsor_stem_candidates, prefix-indexed): as the anon role the
    // register's row-level security makes a per-stem `ilike` a full scan of 127k rows each (~1.5s), which timed out
    // and read as "not found". Only a definite "no rows" may mean no match — a failed lookup must not.
    const { data, error } = await supabase.rpc("sponsor_stem_candidates", { p_stems: uniqueStems });
    if (error) throw new Error(`Sponsor cross-check failed: ${error.message}`);
    const rowsByStem = new Map<string, SponsorRow[]>();
    for (const row of (data ?? []) as (SponsorRow & { stem: string })[]) {
      const list = rowsByStem.get(row.stem) ?? [];
      list.push(row);
      rowsByStem.set(row.stem, list);
    }
    for (const [stem, rows] of rowsByStem) {
      // Confirm the full stripped name matches, not just the prefix — the prefix is a candidate filter, not the check.
      const matches = rows.filter((row) => stripLegalSuffixes(row.company_name_normalized) === stem);
      if (matches.length > 0) stemCandidates.set(stem, matches);
    }
  }

  // --- Assemble one result per input name.
  for (const name of uniqueNames) {
    const normalized = normalizedByName.get(name)!;
    const exactMatches = exactByKey.get(normalized);

    if (exactMatches && exactMatches.length > 0) {
      const distinctCompanies = new Set(exactMatches.map((m) => m.row.company_name_normalized));
      if (distinctCompanies.size === 1) {
        const rows = sortByBestRating(exactMatches.map((m) => m.row));
        const via = exactMatches[0].via;
        results.set(name, {
          status: "confirmed_sponsor",
          confidence: "exact",
          sponsors: rows.map((row) => toCandidate(row, via)),
        });
      } else {
        // Same normalized search key resolved to more than one real
        // company (e.g. it matched one sponsor's own name and a
        // different sponsor's alias) — a genuine identity ambiguity,
        // not just multiple locations of the same company.
        const oneRowPerCompany = [...distinctCompanies].map(
          (key) => exactMatches.find((m) => m.row.company_name_normalized === key)!.row,
        );
        results.set(name, {
          status: "unconfirmed",
          confidence: "ambiguous",
          sponsors: oneRowPerCompany.map((row) => toCandidate(row, "name")),
        });
      }
      continue;
    }

    const stem = stemByName.get(name);
    const stemRows = stem ? stemCandidates.get(stem) : undefined;
    if (stemRows && stemRows.length > 0) {
      const distinctCompanies = [...new Set(stemRows.map((row) => row.company_name_normalized))];
      results.set(name, {
        status: "unconfirmed",
        confidence: distinctCompanies.length === 1 ? "likely" : "ambiguous",
        sponsors: distinctCompanies.map(
          (key) => toCandidate(sortByBestRating(stemRows.filter((row) => row.company_name_normalized === key))[0], "name"),
        ),
      });
      continue;
    }

    results.set(name, NO_MATCH);
  }

  return results;
}

/** Single-company convenience wrapper over matchJobsToSponsors — for a job detail page scoring exactly one employer, not a search-results page. */
export async function matchJobToSponsor(companyName: string): Promise<JobSponsorMatch> {
  const results = await matchJobsToSponsors([companyName]);
  return results.get(companyName.trim()) ?? NO_MATCH;
}
