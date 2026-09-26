// The pure half of the sponsor importer: turning the Home Office's CSV into one entry per (company, town/city) with
// its routes, per-route ratings and trading-name aliases. No network and no database — kept apart from
// import-sponsors.mjs so it can be unit-tested against real register rows (src/lib/sponsors/register-parser.test.ts).

export const EXPECTED_HEADER = ["Organisation Name", "Town/City", "County", "Type & Rating", "Route"];

// ---------------------------------------------------------------------
// RFC4180 CSV parsing — quoted fields (organisation names routinely
// contain commas, e.g. "PINAL DAYA, T/A LONDIS", always properly
// quoted in the real file), doubled-quote escaping, \r\n and \n line
// endings. Verified directly against the real register, not assumed.
// ---------------------------------------------------------------------

export function parseCsv(input) {
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;
  let i = 0;
  const len = input.length;

  while (i < len) {
    const ch = input[i];
    if (inQuotes) {
      if (ch === '"') {
        if (input[i + 1] === '"') {
          field += '"';
          i += 2;
        } else {
          inQuotes = false;
          i++;
        }
      } else {
        field += ch;
        i++;
      }
      continue;
    }

    if (ch === '"') {
      inQuotes = true;
      i++;
    } else if (ch === ",") {
      row.push(field);
      field = "";
      i++;
    } else if (ch === "\r") {
      i++;
    } else if (ch === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
      i++;
    } else {
      field += ch;
      i++;
    }
  }

  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  // A trailing blank line parses as one empty-string field — not a real
  // data row.
  return rows.filter((r) => !(r.length === 1 && r[0] === ""));
}

// ---------------------------------------------------------------------
// Normalization
// ---------------------------------------------------------------------

export function collapseWhitespace(value) {
  return value.replace(/\s+/g, " ").trim();
}

export function normalizeForMatch(value) {
  return collapseWhitespace(value).toLowerCase();
}

/**
 * Buckets a real "Type & Rating" cell (e.g. "Worker (A rating)",
 * "Temporary Worker (A (SME+))", "Worker (UK Expansion Worker:
 * Provisional )") into migration 0050's four sponsor_rating values.
 * Deliberately simple, deterministic substring rules, checked in a
 * specific order — "B rating" is checked first since a value could in
 * principle contain both "B" and "A"-looking substrings, and
 * "provisional" is checked before the generic "A rating" case since
 * every real provisional variant seen also contains "rating" or "A".
 * Anything unrecognised falls back to 'other' rather than throwing —
 * gov.uk can introduce a new variant between register publications, and
 * a single unrecognised label should never abort an otherwise-good
 * import.
 */
export function bucketRating(raw) {
  const value = raw.toLowerCase();
  if (value.includes("b rating")) return "b_rating";
  if (value.includes("provisional")) return "a_rating_provisional";
  if (value.includes("a rating") || value.includes("(a ") || value.includes("(a(")) return "a_rating";
  return "other";
}

const RATING_RANK = { a_rating: 0, a_rating_provisional: 1, other: 2, b_rating: 3 };

/**
 * Splits a real "legal T/A trading" cell into its two halves — e.g.
 * " PINAL DAYA, T/A LONDIS" -> { legalName: "PINAL DAYA", tradingName:
 * "LONDIS" }, "HAH Hospitality Limited t/a Indian Affair Ancoats" ->
 * { legalName: "HAH Hospitality Limited", tradingName: "Indian Affair
 * Ancoats" } — both real rows checked in the live register. Trailing/
 * leading punctuation left over from the split (the comma before "T/A"
 * in the first real example above) is trimmed off each half. Returns
 * null for the common case (no "T/A"/"trading as" found) — most
 * organisation names don't need splitting, and this never invents a
 * trading name that isn't actually printed in the cell.
 */
export function splitLegalAndTradingName(companyName) {
  const match = companyName.match(/^(.+?)\s+(?:t\/as?|trading\s+as)\s+(.+)$/i);
  if (!match) return null;

  const legalName = match[1].replace(/[,;:\-–]+$/, "").trim();
  const tradingName = match[2].replace(/^[,;:\-–]+/, "").trim();
  if (!legalName || !tradingName) return null;

  return { legalName, tradingName };
}

/** Picks the best (lowest-rank) rating across a sponsor's own route entries — see this file's header comment for why rating is per-route, not per-company. */
export function bestRating(entries) {
  return entries.reduce((best, entry) => (RATING_RANK[entry.rating] < RATING_RANK[best.rating] ? entry : best));
}

/** Extracts the source date embedded in every real filename seen (e.g. "..._Web_Register_-_2026-09-14.csv") — the Home Office's own "as of" date, not whenever this script happens to run. Falls back to today (UTC) with a loud warning if a future filename ever stops following this pattern, rather than failing the whole import over a cosmetic detail. */
export function extractSourceDate(url) {
  const match = url.match(/(\d{4}-\d{2}-\d{2})\.csv(?:[?#]|$)/i);
  if (match) return match[1];

  const today = new Date().toISOString().slice(0, 10);
  console.warn(`Warning: couldn't find a YYYY-MM-DD date in the filename (${url}) — using today's date (${today}) instead.`);
  return today;
}

// ---------------------------------------------------------------------
// Parsing + aggregation
// ---------------------------------------------------------------------

export function validateHeader(headerRow) {
  const normalized = headerRow.map((cell) => cell.trim());
  const matches = normalized.length === EXPECTED_HEADER.length && normalized.every((cell, i) => cell === EXPECTED_HEADER[i]);
  if (!matches) {
    throw new Error(
      `Unexpected CSV header — expected [${EXPECTED_HEADER.join(", ")}], got [${normalized.join(", ")}]. The register's format may have changed; this importer needs updating before it can trust the data.`,
    );
  }
}

/**
 * Parses and aggregates every row into one entry per (company, town/
 * city) — the same identity migration 0049's unique constraint uses —
 * with each entry's own deduplicated set of (route, rating) pairs, plus
 * any legal-vs-trading-name aliases splitLegalAndTradingName finds in
 * the organisation name (migration 0053) — never rewriting the name
 * itself, only adding to it. Rows with no organisation name are skipped
 * (none existed in the real file checked, but a blank name can't
 * identify a company either way).
 */
export function aggregateRows(rows) {
  const sponsors = new Map();
  let skippedBlankName = 0;

  for (const row of rows) {
    if (row.length < 5) continue;
    const [orgRaw, townRaw, countyRaw, ratingRawCell, routeRaw] = row;

    const companyName = collapseWhitespace(orgRaw);
    if (!companyName) {
      skippedBlankName++;
      continue;
    }
    const townCity = collapseWhitespace(townRaw) || null;
    const county = collapseWhitespace(countyRaw) || null;
    const route = collapseWhitespace(routeRaw);
    const ratingRaw = collapseWhitespace(ratingRawCell);
    const rating = bucketRating(ratingRaw);

    const companyNameNormalized = normalizeForMatch(companyName);
    const townCityNormalized = townCity ? normalizeForMatch(townCity) : null;
    const key = `${companyNameNormalized}||${townCityNormalized ?? ""}`;

    let sponsor = sponsors.get(key);
    if (!sponsor) {
      sponsor = { companyName, companyNameNormalized, townCity, townCityNormalized, county, routes: new Map(), aliases: new Map() };
      sponsors.set(key, sponsor);
    }
    // A later row's original casing/county wins — later rows in a real
    // gov.uk file are no more or less authoritative than earlier ones,
    // this just needs a deterministic rule and "last one wins" is the
    // simplest that doesn't silently prefer stale-looking data.
    sponsor.companyName = companyName;
    if (county) sponsor.county = county;

    if (route) {
      const routeKey = `${route}||${rating}`;
      sponsor.routes.set(routeKey, { route, rating, ratingRaw });
    }

    // Never touches companyName/companyNameNormalized themselves — this
    // only ever *adds* alias entries alongside the untouched original,
    // recomputed from whichever row's name just won above so the split
    // stays in sync with it.
    const split = splitLegalAndTradingName(sponsor.companyName);
    sponsor.aliases.clear();
    if (split) {
      const legalNormalized = normalizeForMatch(split.legalName);
      const tradingNormalized = normalizeForMatch(split.tradingName);
      sponsor.aliases.set(`legal_name||${legalNormalized}`, { aliasType: "legal_name", aliasName: split.legalName, aliasNameNormalized: legalNormalized });
      sponsor.aliases.set(`trading_as||${tradingNormalized}`, { aliasType: "trading_as", aliasName: split.tradingName, aliasNameNormalized: tradingNormalized });
    }
  }

  // A sponsor whose every raw row had a blank Route cell has no route
  // to compute a summary rating from at all (bestRating requires at
  // least one) — none existed in the real file checked, but dropping
  // these here (rather than crashing on an empty reduce, or inventing a
  // fake rating) keeps that a graceful, counted skip instead of an
  // importer-wide failure over a handful of unusable rows.
  let skippedNoRoute = 0;
  for (const [key, sponsor] of sponsors) {
    if (sponsor.routes.size === 0) {
      sponsors.delete(key);
      skippedNoRoute++;
    }
  }

  return { sponsors, skippedBlankName, skippedNoRoute };
}
