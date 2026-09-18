// Server importer for the UK Home Office's "Register of licensed
// sponsors: workers" — the real, current source, checked directly
// (not assumed) while building this: downloaded and parsed the live
// CSV from
// https://www.gov.uk/government/publications/register-of-licensed-sponsors-workers
// on 2026-09-14 (143,149 data rows). What that check actually found,
// and why this file is shaped the way it is:
//
//   - Header is exactly: Organisation Name,Town/City,County,Type &
//     Rating,Route — five columns, always, no exceptions found. This
//     script refuses to proceed if that's no longer true (see
//     validateHeader below) rather than silently misreading a changed
//     format.
//   - "Type & Rating" is one of at least 9 distinct real values —
//     "Worker (A rating)", "Temporary Worker (A rating)", "Worker (B
//     rating)", "Worker (A (Premium))", "Worker (A (SME+))", "Worker
//     (UK Expansion Worker: Provisional )", and Temporary Worker
//     variants of several of those — not the two ("A rating"/"A rating
//     (provisional)") this app's own search filter UI assumes. This is
//     bucketed into the four values migration 0050's sponsor_rating enum
//     actually has (bucketRating, below), with the verbatim original
//     text always kept alongside as rating_raw.
//   - "Route" has at least 17 distinct real values — five separate
//     Global Business Mobility *sub*-routes alone ("Global Business
//     Mobility" bare never appears), plus Tier 2 Ministers of Religion,
//     Creative Worker, Charity Worker, International Sportsperson,
//     Religious Worker, Government Authorised Exchange, Scale-up,
//     Seasonal Worker, and more. Stored as free text (migration 0050),
//     never forced into a fixed list this script would need updating
//     for every time the Home Office adds or renames a route.
//   - Rating is a property of each individual route *entry*, not of a
//     company as a whole: the same organisation, at the same location,
//     can hold routes with genuinely different ratings (confirmed —
//     Rolls-Royce plc, Derby holds both an A-rated Skilled Worker
//     licence and an A-rated-but-differently-typed Global Business
//     Mobility: Graduate Trainee licence as two separate register rows;
//     real B-rated entries exist elsewhere at ~0.05% of rows). So this
//     script computes `sponsors.rating` as the *best* rating across a
//     company's own routes, and writes the authoritative per-route
//     rating onto sponsor_routes itself.
//   - Whitespace is rampant and inconsistent — leading/trailing spaces
//     on almost every field, occasional double spaces. Every field is
//     trimmed and internal whitespace collapsed before anything else
//     happens to it.
//   - The register contains genuine duplicate and near-duplicate rows —
//     the exact same (org, town, rating, route) tuple appearing 2-6
//     times is common (15,431 of 143,149 rows share an (org, town) key
//     with at least one other row). This script aggregates every row
//     for the same (company, town/city) in memory before writing
//     anything, so true duplicates collapse naturally rather than
//     racing each other as separate upserts.
//   - Organisation Name routinely bundles a legal name and a trading
//     name in one cell — " PINAL DAYA, T/A LONDIS", "HAH Hospitality
//     Limited t/a Indian Affair Ancoats", "Ian Tappin t/a Lovat House
//     Residential Care Home", all real rows. splitLegalAndTradingName
//     (below) pulls both halves out and writes them as sponsor_aliases
//     rows (migration 0053) — company_name/company_name_normalized
//     themselves are never rewritten or split, only added to, so a
//     "Londis"-style trading-name search has something real to match
//     without the source record losing its original, verbatim form.
//
// Scheduling: .github/workflows/sponsors-sync.yml runs this once a day
// (and on manual dispatch) — a GitHub Actions job, not a Vercel Cron ->
// Next.js route, deliberately: a real run does hundreds of sequential
// batched upserts against ~130k rows, which comfortably fits a CI job's
// runtime but risks a serverless function's execution-time limit for no
// real benefit. Already idempotent for this: the "same source_date
// already completed" guard below means running it twice in one day (the
// schedule firing plus a manual retry, say) just finds nothing new to
// do, never double-applies anything.
//
// Change logging: migration 0054's sponsor_sync_changes gets one row
// per sponsor whose *existence* changed this run — newly seen,
// reactivated after having dropped off, or dropped off now —
// distinguished from "already active, unchanged" via
// snapshotExistingSponsors' pre-upsert read (the upsert itself always
// overwrites is_active to true, so there's no other way to tell "new"
// from "already there" after the fact). sponsor_imports itself gained
// matching added_count/reactivated_count/deactivated_count columns, and
// a new sponsor_sync_status view answers "when did this last succeed,
// and what happened" as one ready row — none of this ever deletes a
// sponsor_imports/sponsor_sync_changes row; both are exactly as
// append-only as they were before this.
//
// Usage:
//   node --env-file=.env.local scripts/import-sponsors.mjs [options]
//
// Options:
//   --url <url>     Fetch this CSV URL directly instead of discovering
//                    the current one from the gov.uk publication page.
//   --file <path>   Read a local CSV file instead of fetching anything
//                    (offline testing, or re-processing an already-
//                    downloaded file).
//   --dry-run       Parse, validate, and aggregate as normal, but never
//                    write to the database — prints what would have
//                    happened. No sponsor_imports row is created.
//   --force         Import even if a *completed* import already exists
//                    for the resolved source date (the rare case where
//                    gov.uk republishes a corrected file under the same
//                    date). Without this flag, that case exits early
//                    rather than doing ~140k rows of work for nothing —
//                    migration 0050's own partial unique index would
//                    reject it at the very end regardless, this just
//                    fails fast instead.
//
// No scheduler is wired up here — this is the importer itself; running
// it on a schedule (a weekly cron, a GitHub Action, a Vercel Cron job)
// is a deployment decision for whoever operates this, not something a
// script file can set up on its own.

import { createClient } from "@supabase/supabase-js";

const PUBLICATION_PAGE_URL = "https://www.gov.uk/government/publications/register-of-licensed-sponsors-workers";
const EXPECTED_HEADER = ["Organisation Name", "Town/City", "County", "Type & Rating", "Route"];
const FETCH_TIMEOUT_MS = 120_000;
const UPSERT_BATCH_SIZE = 1000;
// Real files run ~140k rows. Anything drastically smaller is far more
// likely to be a truncated download, an HTML error page saved as .csv,
// or gov.uk having changed format, than a genuine register — refuse to
// treat it as a real import (and never deactivate the sponsors an
// earlier good import already recorded) rather than trusting it blindly.
const MIN_EXPECTED_ROWS = 50_000;

// ---------------------------------------------------------------------
// CLI args
// ---------------------------------------------------------------------

function parseArgs(argv) {
  const args = { url: null, file: null, dryRun: false, force: false };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--url") args.url = argv[++i];
    else if (arg === "--file") args.file = argv[++i];
    else if (arg === "--dry-run") args.dryRun = true;
    else if (arg === "--force") args.force = true;
    else {
      console.error(`Unrecognised argument: ${arg}`);
      process.exit(1);
    }
  }
  return args;
}

// ---------------------------------------------------------------------
// RFC4180 CSV parsing — quoted fields (organisation names routinely
// contain commas, e.g. "PINAL DAYA, T/A LONDIS", always properly
// quoted in the real file), doubled-quote escaping, \r\n and \n line
// endings. Verified directly against the real register, not assumed.
// ---------------------------------------------------------------------

function parseCsv(input) {
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

function collapseWhitespace(value) {
  return value.replace(/\s+/g, " ").trim();
}

function normalizeForMatch(value) {
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
function bucketRating(raw) {
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
function splitLegalAndTradingName(companyName) {
  const match = companyName.match(/^(.+?)\s+(?:t\/a|trading\s+as)\s+(.+)$/i);
  if (!match) return null;

  const legalName = match[1].replace(/[,;:\-–]+$/, "").trim();
  const tradingName = match[2].replace(/^[,;:\-–]+/, "").trim();
  if (!legalName || !tradingName) return null;

  return { legalName, tradingName };
}

/** Picks the best (lowest-rank) rating across a sponsor's own route entries — see this file's header comment for why rating is per-route, not per-company. */
function bestRating(entries) {
  return entries.reduce((best, entry) => (RATING_RANK[entry.rating] < RATING_RANK[best.rating] ? entry : best));
}

// ---------------------------------------------------------------------
// Source discovery
// ---------------------------------------------------------------------

/** Extracts the source date embedded in every real filename seen (e.g. "..._Web_Register_-_2026-09-14.csv") — the Home Office's own "as of" date, not whenever this script happens to run. Falls back to today (UTC) with a loud warning if a future filename ever stops following this pattern, rather than failing the whole import over a cosmetic detail. */
function extractSourceDate(url) {
  const match = url.match(/(\d{4}-\d{2}-\d{2})\.csv(?:[?#]|$)/i);
  if (match) return match[1];

  const today = new Date().toISOString().slice(0, 10);
  console.warn(`Warning: couldn't find a YYYY-MM-DD date in the filename (${url}) — using today's date (${today}) instead.`);
  return today;
}

async function discoverCsvUrl() {
  console.log(`Discovering current register URL from ${PUBLICATION_PAGE_URL} ...`);
  const response = await fetch(PUBLICATION_PAGE_URL, {
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    headers: { "User-Agent": "JobPilotAI-SponsorImporter/1.0" },
  });
  if (!response.ok) {
    throw new Error(`Couldn't reach the gov.uk publication page (HTTP ${response.status}).`);
  }
  const html = await response.text();

  // The real direct-download link always points at
  // assets.publishing.service.gov.uk and ends in .csv — the page also
  // links a "/csv-preview/..." relative URL for the same file, which
  // this deliberately excludes (it's an in-browser viewer, not the raw
  // file).
  const match = html.match(/href="(https:\/\/assets\.publishing\.service\.gov\.uk\/media\/[^"]+\.csv)"/i);
  if (!match) {
    throw new Error(
      "Couldn't find a CSV download link on the gov.uk publication page — its layout may have changed. Pass --url explicitly to bypass discovery.",
    );
  }
  return match[1];
}

async function fetchCsvText(url) {
  console.log(`Downloading ${url} ...`);
  const response = await fetch(url, {
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    headers: { "User-Agent": "JobPilotAI-SponsorImporter/1.0" },
  });
  if (!response.ok) {
    throw new Error(`Couldn't download the register (HTTP ${response.status}).`);
  }
  return response.text();
}

// ---------------------------------------------------------------------
// Parsing + aggregation
// ---------------------------------------------------------------------

function validateHeader(headerRow) {
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
function aggregateRows(rows) {
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

// ---------------------------------------------------------------------
// Database writes
// ---------------------------------------------------------------------

function chunk(array, size) {
  const chunks = [];
  for (let i = 0; i < array.length; i += size) chunks.push(array.slice(i, i + size));
  return chunks;
}

/**
 * Reads the *pre-upsert* existence/active state for every sponsor this
 * run is about to touch — the only way to tell "added" and "reactivated"
 * apart from "already active, no change", since the upsert that follows
 * always overwrites is_active to true regardless of what it was before.
 * Batched by company_name_normalized (reusing that column's existing
 * index, migration 0049) rather than the full composite key — Postgres/
 * PostgREST has no clean composite-tuple IN filter, so this fetches a
 * superset per batch and narrows to the exact (name, town) key
 * client-side, the same way every other lookup in this file already
 * builds its keys.
 */
async function snapshotExistingSponsors(supabase, sponsors) {
  const existing = new Map();
  const normalizedNames = [...new Set([...sponsors.values()].map((s) => s.companyNameNormalized))];

  for (const batch of chunk(normalizedNames, UPSERT_BATCH_SIZE)) {
    const { data, error } = await supabase
      .from("sponsors")
      .select("id, company_name_normalized, town_city_normalized, is_active")
      .in("company_name_normalized", batch);
    if (error) throw new Error(`Snapshotting existing sponsors failed: ${error.message}`);

    for (const row of data) {
      const key = `${row.company_name_normalized}||${row.town_city_normalized ?? ""}`;
      existing.set(key, { id: row.id, isActive: row.is_active });
    }
  }

  return existing;
}

async function upsertSponsors(supabase, sponsors, importId, sourceDate) {
  const sponsorIdByKey = new Map();
  const entries = [...sponsors.entries()];

  for (const batch of chunk(entries, UPSERT_BATCH_SIZE)) {
    const rows = batch.map(([, sponsor]) => {
      const best = bestRating([...sponsor.routes.values()]);
      return {
        import_id: importId,
        company_name: sponsor.companyName,
        company_name_normalized: sponsor.companyNameNormalized,
        town_city: sponsor.townCity,
        town_city_normalized: sponsor.townCityNormalized,
        county: sponsor.county,
        rating: best.rating,
        rating_raw: best.ratingRaw,
        is_active: true,
        source_date: sourceDate,
      };
    });

    const { data, error } = await supabase
      .from("sponsors")
      .upsert(rows, { onConflict: "company_name_normalized,town_city_normalized" })
      .select("id, company_name_normalized, town_city_normalized");

    if (error) throw new Error(`Upserting sponsors failed: ${error.message}`);

    for (const row of data) {
      const key = `${row.company_name_normalized}||${row.town_city_normalized ?? ""}`;
      sponsorIdByKey.set(key, row.id);
    }
    process.stdout.write(`\r  sponsors upserted: ${sponsorIdByKey.size} / ${entries.length}`);
  }
  process.stdout.write("\n");

  return sponsorIdByKey;
}

async function upsertRoutes(supabase, sponsors, sponsorIdByKey) {
  const routeRows = [];
  for (const [key, sponsor] of sponsors) {
    const sponsorId = sponsorIdByKey.get(key);
    if (!sponsorId) continue; // Shouldn't happen — every key was just upserted — but never crash the whole run over one missing id.
    for (const { route, rating, ratingRaw } of sponsor.routes.values()) {
      routeRows.push({ sponsor_id: sponsorId, route, rating, rating_raw: ratingRaw });
    }
  }

  let written = 0;
  for (const batch of chunk(routeRows, UPSERT_BATCH_SIZE)) {
    const { error } = await supabase.from("sponsor_routes").upsert(batch, { onConflict: "sponsor_id,route,rating" });
    if (error) throw new Error(`Upserting sponsor routes failed: ${error.message}`);
    written += batch.length;
    process.stdout.write(`\r  routes upserted: ${written} / ${routeRows.length}`);
  }
  process.stdout.write("\n");

  return routeRows.length;
}

async function upsertAliases(supabase, sponsors, sponsorIdByKey) {
  const aliasRows = [];
  for (const [key, sponsor] of sponsors) {
    const sponsorId = sponsorIdByKey.get(key);
    if (!sponsorId) continue; // Shouldn't happen — every key was just upserted — but never crash the whole run over one missing id.
    for (const { aliasType, aliasName, aliasNameNormalized } of sponsor.aliases.values()) {
      aliasRows.push({ sponsor_id: sponsorId, alias_type: aliasType, alias_name: aliasName, alias_name_normalized: aliasNameNormalized });
    }
  }

  let written = 0;
  for (const batch of chunk(aliasRows, UPSERT_BATCH_SIZE)) {
    const { error } = await supabase.from("sponsor_aliases").upsert(batch, { onConflict: "sponsor_id,alias_type,alias_name_normalized" });
    if (error) throw new Error(`Upserting sponsor aliases failed: ${error.message}`);
    written += batch.length;
    process.stdout.write(`\r  aliases upserted: ${written} / ${aliasRows.length}`);
  }
  if (aliasRows.length > 0) process.stdout.write("\n");

  return aliasRows.length;
}

/** Anything not touched by this import (its import_id no longer matches) has dropped off the register since the last successful sync — deactivate rather than delete, so which import last actually confirmed it stays on the row. Returns the full rows, not just a count, since main() needs each one's id/name to log a 'deactivated' sponsor_sync_changes row per sponsor (migration 0054). */
async function deactivateMissingSponsors(supabase, importId) {
  const { data, error } = await supabase
    .from("sponsors")
    .update({ is_active: false })
    .neq("import_id", importId)
    .eq("is_active", true)
    .select("id, company_name");
  if (error) throw new Error(`Deactivating dropped sponsors failed: ${error.message}`);
  return data;
}

/**
 * Writes migration 0054's sponsor_sync_changes rows — one per sponsor
 * whose existence state changed *this run* (newly seen, reactivated
 * after dropping off, or dropped off now). Plain inserts, not upserts:
 * each import's own change rows are always new, there's nothing to
 * conflict with.
 */
async function insertSyncChanges(supabase, changeRows) {
  for (const batch of chunk(changeRows, UPSERT_BATCH_SIZE)) {
    const { error } = await supabase.from("sponsor_sync_changes").insert(batch);
    if (error) throw new Error(`Recording sponsor sync changes failed: ${error.message}`);
  }
}

// ---------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------

async function main() {
  const args = parseArgs(process.argv.slice(2));

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!args.dryRun && (!supabaseUrl || !serviceRoleKey)) {
    console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.");
    console.error("Copy .env.example to .env.local and fill in your project's values, or pass --dry-run to skip the database entirely.");
    process.exit(1);
  }
  const supabase = args.dryRun ? null : createClient(supabaseUrl, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } });

  // ---- Resolve source ----
  let sourceUrl;
  let csvText;
  if (args.file) {
    const fs = await import("node:fs/promises");
    sourceUrl = `file://${args.file}`;
    console.log(`Reading local file ${args.file} ...`);
    csvText = await fs.readFile(args.file, "utf8");
  } else {
    sourceUrl = args.url ?? (await discoverCsvUrl());
    csvText = await fetchCsvText(sourceUrl);
  }
  const sourceDate = extractSourceDate(sourceUrl);
  console.log(`Source: ${sourceUrl}`);
  console.log(`Source date: ${sourceDate}`);

  // ---- Parse ----
  const rows = parseCsv(csvText);
  if (rows.length === 0) throw new Error("The downloaded file has no rows at all.");
  validateHeader(rows[0]);
  const dataRows = rows.slice(1);
  console.log(`Parsed ${dataRows.length} data rows.`);

  if (dataRows.length < MIN_EXPECTED_ROWS) {
    throw new Error(
      `Only ${dataRows.length} rows parsed — expected at least ${MIN_EXPECTED_ROWS}. Refusing to import: this looks like a truncated download, an error page, or a changed format, not a real register. No sponsors were touched.`,
    );
  }

  const { sponsors, skippedBlankName, skippedNoRoute } = aggregateRows(dataRows);
  const totalRoutes = [...sponsors.values()].reduce((sum, s) => sum + s.routes.size, 0);
  const totalAliases = [...sponsors.values()].reduce((sum, s) => sum + s.aliases.size, 0);
  console.log(
    `Aggregated into ${sponsors.size} distinct sponsors (company + town/city), ${totalRoutes} distinct route entries, ${totalAliases} legal/trading-name aliases.`,
  );
  if (skippedBlankName > 0) console.log(`Skipped ${skippedBlankName} row(s) with a blank organisation name.`);
  if (skippedNoRoute > 0) console.log(`Skipped ${skippedNoRoute} sponsor(s) with no usable route.`);

  if (args.dryRun) {
    console.log("\n--dry-run: no database writes made.");
    return;
  }

  // ---- Guard against re-importing the same source date ----
  if (!args.force) {
    const { data: existing, error } = await supabase
      .from("sponsor_imports")
      .select("id, completed_at")
      .eq("source_date", sourceDate)
      .eq("status", "completed")
      .maybeSingle();
    if (error) throw new Error(`Checking for an existing import failed: ${error.message}`);
    if (existing) {
      console.log(`\nA completed import for ${sourceDate} already exists (id ${existing.id}, completed ${existing.completed_at}).`);
      console.log("Nothing to do — pass --force to re-import this date anyway.");
      return;
    }
  }

  // ---- Create the import row ----
  const { data: importRow, error: importError } = await supabase
    .from("sponsor_imports")
    .insert({ source_url: sourceUrl, source_date: sourceDate, status: "processing" })
    .select("id")
    .single();
  if (importError) throw new Error(`Creating the sponsor_imports row failed: ${importError.message}`);
  const importId = importRow.id;
  console.log(`\nCreated sponsor_imports row ${importId}.`);

  try {
    console.log("Snapshotting existing sponsors (for added/reactivated detection)...");
    const existingSnapshot = await snapshotExistingSponsors(supabase, sponsors);

    console.log("Upserting sponsors...");
    const sponsorIdByKey = await upsertSponsors(supabase, sponsors, importId, sourceDate);

    console.log("Upserting sponsor routes...");
    const routeCount = await upsertRoutes(supabase, sponsors, sponsorIdByKey);

    console.log("Upserting sponsor aliases...");
    const aliasCount = await upsertAliases(supabase, sponsors, sponsorIdByKey);

    // Compare the pre-upsert snapshot against what was just written: no
    // prior row at all -> newly added; a prior row that existed but was
    // inactive -> reactivated. Already-active-and-still-active sponsors
    // (the overwhelming majority of every run) generate no change row —
    // this log is "what changed", not "what exists".
    const changeRows = [];
    let addedCount = 0;
    let reactivatedCount = 0;
    for (const [key, sponsor] of sponsors) {
      const sponsorId = sponsorIdByKey.get(key);
      if (!sponsorId) continue;
      const prior = existingSnapshot.get(key);
      if (!prior) {
        addedCount++;
        changeRows.push({ import_id: importId, sponsor_id: sponsorId, change_type: "added", company_name: sponsor.companyName });
      } else if (!prior.isActive) {
        reactivatedCount++;
        changeRows.push({ import_id: importId, sponsor_id: sponsorId, change_type: "reactivated", company_name: sponsor.companyName });
      }
    }

    console.log("Deactivating sponsors no longer on the register...");
    const deactivatedRows = await deactivateMissingSponsors(supabase, importId);
    for (const row of deactivatedRows) {
      changeRows.push({ import_id: importId, sponsor_id: row.id, change_type: "deactivated", company_name: row.company_name });
    }
    console.log(`  added: ${addedCount}, reactivated: ${reactivatedCount}, deactivated: ${deactivatedRows.length}`);

    console.log("Recording sponsor sync changes...");
    await insertSyncChanges(supabase, changeRows);

    const { error: completeError } = await supabase
      .from("sponsor_imports")
      .update({
        status: "completed",
        sponsor_count: sponsorIdByKey.size,
        route_count: routeCount,
        alias_count: aliasCount,
        added_count: addedCount,
        reactivated_count: reactivatedCount,
        deactivated_count: deactivatedRows.length,
        completed_at: new Date().toISOString(),
      })
      .eq("id", importId);
    if (completeError) throw new Error(`Marking the import completed failed: ${completeError.message}`);

    console.log(
      `\nDone. ${sponsorIdByKey.size} sponsors, ${routeCount} routes, ${aliasCount} aliases (${addedCount} added, ${reactivatedCount} reactivated, ${deactivatedRows.length} deactivated).`,
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`\nImport failed: ${message}`);
    await supabase
      .from("sponsor_imports")
      .update({ status: "failed", error_message: message.slice(0, 2000), completed_at: new Date().toISOString() })
      .eq("id", importId);
    throw err;
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
