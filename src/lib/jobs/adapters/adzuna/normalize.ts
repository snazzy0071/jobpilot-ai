import type { AdzunaJobResult } from "@/lib/jobs/adapters/adzuna/client";
import type { NormalizedJobInput } from "@/lib/jobs/types";
import { normalizeForMatch } from "@/lib/jobs/normalize";

/**
 * Maps one raw Adzuna result onto migration 0059's `jobs` shape. Adzuna
 * gives no expiry for a listing, so `expiresAt` is always null here —
 * never guessed at a default TTL, same "don't fabricate a freshness
 * signal that isn't real" reasoning as that migration's own header
 * comment on `posted_at`.
 *
 * Returns an error string instead of throwing when a result is missing
 * a field this schema requires (title/company/url/description) — one
 * malformed listing from an external feed shouldn't abort an entire
 * sync run, same "report per-row, skip, keep going" approach the
 * graduate schemes CSV importer uses.
 */
export function normalizeAdzunaJob(raw: AdzunaJobResult): { job: NormalizedJobInput } | { error: string } {
  const title = raw.title?.trim();
  if (!title) return { error: `Adzuna job ${raw.id}: missing title.` };

  const companyName = raw.company?.display_name?.trim();
  if (!companyName) return { error: `Adzuna job ${raw.id}: missing company name.` };

  const url = raw.redirect_url?.trim();
  if (!url) return { error: `Adzuna job ${raw.id}: missing redirect_url.` };

  const description = raw.description?.trim();
  if (!description) return { error: `Adzuna job ${raw.id}: missing description.` };

  const location = raw.location?.display_name?.trim() || null;

  // Adzuna's `created` is already ISO 8601 — passed through as-is
  // rather than reformatted, so an unexpected value fails validation at
  // the DB boundary (a timestamptz column) instead of being silently
  // coerced into something wrong here.
  const postedAt = raw.created?.trim() || null;

  return {
    job: {
      externalId: raw.id,
      title: title.slice(0, 300),
      titleNormalized: normalizeForMatch(title).slice(0, 300),
      companyName: companyName.slice(0, 300),
      companyNameNormalized: normalizeForMatch(companyName).slice(0, 300),
      location: location ? location.slice(0, 200) : null,
      locationNormalized: location ? normalizeForMatch(location).slice(0, 200) : null,
      description: description.slice(0, 50000),
      url: url.slice(0, 2000),
      postedAt,
      expiresAt: null,
    },
  };
}
