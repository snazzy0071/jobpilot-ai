import type { AdzunaJobResult } from "@/lib/jobs/adapters/adzuna/client";
import type { NormalizedJobInput } from "@/lib/jobs/types";
import { normalizeForMatch } from "@/lib/jobs/normalize";
import { cleanFeedText, safeHttpUrl, safePostedAt } from "@/lib/jobs/text";

/**
 * Maps one raw Adzuna result onto the jobs table's shape. Adzuna gives no expiry for a listing, so `expiresAt` is
 * always null here — never guessed at a default TTL (a job that stops appearing is retired by the maintenance sweep's
 * last_seen_at rule instead).
 *
 * Returns an error string instead of throwing when a result is missing a field the table requires — one malformed
 * listing from an external feed must not abort a whole run, and (because a batch upsert is one statement) must never
 * reach the database where its check constraint would fail every other row with it.
 */
export function normalizeAdzunaJob(raw: AdzunaJobResult): { job: NormalizedJobInput } | { error: string } {
  const id = raw?.id === undefined || raw?.id === null ? "" : String(raw.id).trim();
  if (!id) return { error: "Adzuna job without an id." };

  const title = cleanFeedText(raw.title).replace(/\s+/g, " ");
  if (!title) return { error: `Adzuna job ${id}: missing title.` };

  const companyName = cleanFeedText(raw.company?.display_name).replace(/\s+/g, " ");
  if (!companyName) return { error: `Adzuna job ${id}: missing company name.` };

  const url = safeHttpUrl(raw.redirect_url);
  if (!url) return { error: `Adzuna job ${id}: missing or invalid redirect_url.` };

  const description = cleanFeedText(raw.description);
  if (!description) return { error: `Adzuna job ${id}: missing description.` };

  const location = cleanFeedText(raw.location?.display_name).replace(/\s+/g, " ") || null;

  return {
    job: {
      externalId: id.slice(0, 300),
      title: title.slice(0, 300),
      titleNormalized: normalizeForMatch(title).slice(0, 300),
      companyName: companyName.slice(0, 300),
      companyNameNormalized: normalizeForMatch(companyName).slice(0, 300),
      location: location ? location.slice(0, 200) : null,
      locationNormalized: location ? normalizeForMatch(location).slice(0, 200) : null,
      description: description.slice(0, 50000),
      url,
      postedAt: safePostedAt(raw.created),
      expiresAt: null,
    },
  };
}
