import type { ReedJobResult } from "@/lib/jobs/adapters/reed/client";
import type { NormalizedJobInput } from "@/lib/jobs/types";
import { normalizeForMatch } from "@/lib/jobs/normalize";
import { cleanFeedText, safeHttpUrl } from "@/lib/jobs/text";

/**
 * Reed gives dates as "dd/MM/yyyy" (UK format), not ISO 8601 like
 * Adzuna's `created` — this is the one genuinely different shape
 * "normalize to the same job model" has to bridge here. Returns null
 * for anything that doesn't parse cleanly rather than guessing, same
 * "don't fabricate" reasoning as leaving a field out entirely.
 */
export function parseReedDate(value: string | undefined): string | null {
  if (!value) return null;
  const match = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(value.trim());
  if (!match) return null;

  const day = Number(match[1]);
  const month = Number(match[2]);
  const year = Number(match[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;

  const date = new Date(Date.UTC(year, month - 1, day));
  // Guards against e.g. "31/02/2024" silently rolling over into March.
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;

  return date.toISOString();
}

/**
 * Maps one raw Reed result onto migration 0059's `jobs` shape — same
 * per-row error/skip approach as
 * src/lib/jobs/adapters/adzuna/normalize.ts, so one malformed listing
 * doesn't abort a whole sync. Unlike Adzuna, Reed does give a real
 * `expirationDate`, so `expiresAt` here is a genuine value, not always
 * null.
 */
export function normalizeReedJob(raw: ReedJobResult): { job: NormalizedJobInput } | { error: string } {
  const id = raw?.jobId === undefined || raw?.jobId === null ? "" : String(raw.jobId).trim();
  if (!id) return { error: "Reed job without a jobId." };

  const title = cleanFeedText(raw.jobTitle).replace(/\s+/g, " ");
  if (!title) return { error: `Reed job ${id}: missing jobTitle.` };

  const companyName = cleanFeedText(raw.employerName).replace(/\s+/g, " ");
  if (!companyName) return { error: `Reed job ${id}: missing employerName.` };

  const url = safeHttpUrl(raw.jobUrl);
  if (!url) return { error: `Reed job ${id}: missing or invalid jobUrl.` };

  const description = cleanFeedText(raw.jobDescription);
  if (!description) return { error: `Reed job ${id}: missing jobDescription.` };

  const location = cleanFeedText(raw.locationName).replace(/\s+/g, " ") || null;

  const postedAt = parseReedDate(raw.date);
  let expiresAt = parseReedDate(raw.expirationDate);
  // The jobs table requires expires_at >= posted_at when both are set. A batch upsert is one statement — a single row
  // violating that check would fail the entire sync, not just that row — so an inconsistent pair from the source is
  // treated as "no real expiry" rather than crashing the batch or silently reordering the source's own dates.
  if (postedAt && expiresAt && expiresAt < postedAt) expiresAt = null;

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
      postedAt,
      expiresAt,
    },
  };
}
