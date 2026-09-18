"use server";

import { requireUser } from "@/lib/auth/session";
import { consumeRateLimit } from "@/lib/ai/rate-limit";
import { safeFetchHtml } from "@/lib/net/safe-fetch";
import { extractJobPosting } from "@/lib/cvs/job-posting-extract";
import { fetchJobUrlSchema } from "@/lib/cvs/schemas";

export type FetchJobUrlResult =
  // `blocked` is the single signal AtsPreflightPanel needs — every
  // failure reason (SSRF-blocked, timeout, non-HTML, anti-bot response,
  // too little extractable text, rate-limited) means the same thing to
  // the UI: give up on the URL and fall back to asking the user to paste
  // the job description instead, rather than a dead-end error.
  | { error: string; blocked: true }
  | { jobDescription: string; title: string | null; company: string | null };

/**
 * Fetches a job posting URL (SSRF-safe — src/lib/net/safe-fetch.ts) and
 * extracts its description/title/company (src/lib/cvs/job-posting-
 * extract.ts). Rate-limited via the same fixed-window mechanism AI calls
 * use (src/lib/ai/rate-limit.ts) — an independent counter, since
 * `operation` is part of that table's key — because an outbound fetch to
 * an arbitrary user-supplied URL is exactly the kind of thing worth
 * throttling regardless of whether it ever reaches an AI call: even a
 * blocked attempt still costs a DNS lookup and a connection attempt.
 */
export async function fetchJobDescriptionFromUrl(input: { url: string }): Promise<FetchJobUrlResult> {
  const user = await requireUser();
  const parsed = fetchJobUrlSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message, blocked: true };

  const rateLimit = await consumeRateLimit(user.id, "fetch_job_url");
  if (!rateLimit.allowed) {
    return { error: "You're fetching links too quickly — wait a moment and try again.", blocked: true };
  }

  const fetched = await safeFetchHtml(parsed.data.url);
  if ("error" in fetched) return { error: fetched.error, blocked: true };

  const extracted = extractJobPosting(fetched.html);
  if ("error" in extracted) return { error: extracted.error, blocked: true };

  return {
    jobDescription: extracted.posting.description,
    title: extracted.posting.title,
    company: extracted.posting.company,
  };
}
