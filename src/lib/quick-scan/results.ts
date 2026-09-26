import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { generateResultToken, hashResultToken } from "@/lib/quick-scan/result-token";

const RETENTION_DAYS = 90;

export type QuickScanReducedResult = {
  overallScore: number;
  summary: string;
  matchedKeywords: string[];
  missingKeywords: string[];
  topFixes: string[];
  /** False for a general CV/ATS-readiness scan run with no job description (that field is optional) — the raw
   *  text itself is never stored, so this is what a reopened result later uses to show the right framing. */
  hasJobDescription: boolean;
};

/**
 * Persists the exact reduced result the user was already shown (never
 * the raw CV/job description — those never touch this table) and
 * returns the one-time raw token that unlocks it. Only `hashResultToken`'s
 * output is ever written to the database.
 */
export async function persistQuickScanResult(result: QuickScanReducedResult): Promise<string> {
  const token = generateResultToken();
  const expiresAt = new Date(Date.now() + RETENTION_DAYS * 24 * 60 * 60 * 1000).toISOString();

  const admin = createAdminClient();
  const { error } = await admin.from("quick_scan_results").insert({
    token_hash: hashResultToken(token),
    overall_score: result.overallScore,
    summary: result.summary,
    matched_keywords: result.matchedKeywords,
    missing_keywords: result.missingKeywords,
    top_fixes: result.topFixes,
    has_job_description: result.hasJobDescription,
    expires_at: expiresAt,
  });

  if (error) throw new Error(`Failed to persist Quick Scan result: ${error.message}`);
  return token;
}

/** Hashes the caller-supplied token and looks it up — an expired or never-existing row are deliberately indistinguishable to the caller, filtered in the same query rather than fetched and checked after. */
export async function getQuickScanResultByToken(token: string): Promise<QuickScanReducedResult | null> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("quick_scan_results")
    .select("overall_score, summary, matched_keywords, missing_keywords, top_fixes, has_job_description")
    .eq("token_hash", hashResultToken(token))
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();

  if (error || !data) return null;

  return {
    overallScore: data.overall_score,
    summary: data.summary,
    matchedKeywords: data.matched_keywords as string[],
    missingKeywords: data.missing_keywords as string[],
    topFixes: data.top_fixes as string[],
    hasJobDescription: data.has_job_description,
  };
}
