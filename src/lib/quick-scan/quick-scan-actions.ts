"use server";

import { parseDocument, MAX_FILE_SIZE_BYTES } from "@/lib/files/parse-document";
import { generateStructuredGated } from "@/lib/ai/gateway";
import { AIServiceError } from "@/lib/ai/errors";
import { toPromptCallOptions, atsScanPrompt, atsScanSchema } from "@/lib/ai/prompts";
import { normalizeEmail } from "@/lib/quick-scan/normalize-email";
import { consumeQuickScanRateLimit } from "@/lib/quick-scan/rate-limit";
import { quickScanFieldsSchema } from "@/lib/quick-scan/schemas";
import { persistQuickScanResult, type QuickScanReducedResult } from "@/lib/quick-scan/results";
import { sendQuickScanReportEmail } from "@/lib/quick-scan/send-report-email";

const MAX_KEYWORDS_SHOWN = 10;
const MAX_FIXES_SHOWN = 3;

const IMPORTANCE_RANK: Record<"high" | "medium" | "low", number> = { high: 0, medium: 1, low: 2 };
const PRIORITY_RANK: Record<"high" | "medium" | "low", number> = { high: 0, medium: 1, low: 2 };

// atsScanPrompt (shared with the authenticated scanner) is written around comparing a CV to a specific job
// description — every dimension it scores, and matchedKeywords/missingKeywords especially, assume one is there.
// The job description is optional here, so a caller who skips it still gets a coherent result: this stands in for
// it, telling the model plainly that there's no real role to match keywords against, so it falls back to general
// ATS-readiness and professional CV quality instead of inventing a job it was never given.
const NO_JOB_DESCRIPTION_PLACEHOLDER =
  "No specific job description was provided for this scan. Don't invent one or assume a particular role — score " +
  "and review this CV on general ATS-readiness and professional CV quality instead: clear, standard section " +
  "headings; consistent, unambiguous dates; complete contact details; a real, specific summary and experience " +
  "bullets (not generic filler); no formatting an ATS parser would choke on. For matchedKeywords/missingKeywords, " +
  "use widely-expected professional CV terms (skills, tools, qualifications a reader would look for) rather than " +
  "job-specific ones, since there is no job description to draw them from.";

export type QuickScanResult =
  | { error: string }
  // Deliberately "same scoring core, reduced output": no structure/
  // format/sections sub-scores, no keyword occurrence detail, no
  // section-targeted rewrite capability, and only the top 10 keywords
  // each way plus the top 3 fixes (ranked by importance/priority, not
  // just the model's raw output order) — the full breakdown (and the
  // ability to act on any of it) is what an account gets, matching
  // /free-ats-checker's own comparison table. `resultToken` unlocks the
  // persisted copy of exactly this reduced result at
  // /free-ats-checker/results/[token] and its PDF — see
  // src/lib/quick-scan/results.ts. `resultToken` is null only if the
  // scan itself succeeded but persisting it afterward failed — the
  // user's already-consumed monthly attempt still shows a real result,
  // it just can't be reopened or downloaded as a PDF later. `emailSent`
  // reflects whether the report email genuinely went out (never assumed
  // true just because sending was attempted) — the UI must not claim a
  // copy was emailed unless this says so.
  | (QuickScanReducedResult & { resultToken: string | null; emailSent: boolean });

/** Both AIServiceError's message and this module's own are always safe to show directly — no EntitlementError is possible here, there's no plan to check. */
function safeErrorMessage(err: unknown): string {
  if (err instanceof AIServiceError) return err.message;
  console.error("Quick Scan failed:", err);
  return "Couldn't run that scan — try again.";
}

const EXTENSION_MIME_FALLBACK: Record<string, string> = {
  ".pdf": "application/pdf",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".txt": "text/plain",
};

function inferMimeType(file: File): string {
  if (file.type) return file.type;
  const dot = file.name.lastIndexOf(".");
  const extension = dot >= 0 ? file.name.slice(dot).toLowerCase() : "";
  return EXTENSION_MIME_FALLBACK[extension] ?? "";
}

/**
 * The anonymous, no-account "Quick Scan" — src/app/(public)/free-ats-
 * checker's real backend. Reuses the exact same scoring core as the
 * authenticated tailored scan (atsScanPrompt/atsScanSchema,
 * src/lib/ai/prompts/ats-scan.ts) and the same document parser
 * (src/lib/files/parse-document.ts) that PDF/DOCX uploads already go
 * through elsewhere — nothing new to trust, just a different, reduced
 * view of the same real output and a different gate in front of it.
 *
 * Gated via `generateStructuredGated({ anonymous: true }, ...)` instead
 * of a userId — there's no account, so there's nothing for the gateway's
 * usual entitlement/per-user-rate-limit checks to check against.
 * `consumeQuickScanRateLimit` (checked *before* the AI call, same
 * "rate limit before anything expensive" ordering the gateway itself
 * uses for the authenticated path) is what stands in for that guard
 * here: 2 scans per normalized email per calendar month, plus a looser
 * per-IP daily cap against cycling through fake emails.
 *
 * The raw CV text and job description are never persisted anywhere —
 * only the two rate-limit counters (a normalized email and an IP, not
 * the documents themselves) and, once scoring succeeds, the already-
 * reduced result shown to the user (src/lib/quick-scan/results.ts),
 * saved behind an unguessable token so it can be reopened or downloaded
 * as a PDF later without a second AI call. That same result is also
 * emailed — required delivery of the report the caller asked for by
 * submitting this form, entirely independent of the separate
 * `marketingConsent` newsletter opt-in (see
 * src/lib/quick-scan/send-report-email.ts's doc comment).
 */
export async function runQuickScan(formData: FormData): Promise<QuickScanResult> {
  const parsedFields = quickScanFieldsSchema.safeParse({
    email: formData.get("email"),
    jobDescription: formData.get("jobDescription"),
    website: formData.get("website") ?? undefined,
  });
  if (!parsedFields.success) return { error: parsedFields.error.issues[0].message };

  // Honeypot tripped — respond exactly like a real failure, never reveal
  // the mechanism to whatever filled it in.
  if (parsedFields.data.website) {
    return { error: "Couldn't run that scan — try again." };
  }

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return { error: "Upload your CV first." };
  }
  if (file.size === 0) {
    return { error: "That file is empty." };
  }
  if (file.size > MAX_FILE_SIZE_BYTES) {
    return { error: "That file is too large — the limit is 10MB." };
  }

  const normalizedEmail = normalizeEmail(parsedFields.data.email);
  const rateLimit = await consumeQuickScanRateLimit(normalizedEmail);
  if (!rateLimit.allowed) {
    return {
      error:
        rateLimit.reason === "email"
          ? "You've used your 2 free scans for this month — create a free account for unlimited tailored scans."
          : "Too many scans from this connection today — try again tomorrow.",
    };
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const parsed = await parseDocument(buffer, inferMimeType(file));
  if ("error" in parsed) return { error: parsed.error };

  try {
    const result = await generateStructuredGated(
      { anonymous: true },
      {
        ...toPromptCallOptions(atsScanPrompt, {
          cvText: parsed.document.text,
          jobDescription: parsedFields.data.jobDescription ?? NO_JOB_DESCRIPTION_PLACEHOLDER,
        }),
        schema: atsScanSchema,
      },
    );

    const reduced: QuickScanReducedResult = {
      overallScore: result.scores.overall,
      summary: result.summary,
      matchedKeywords: [...result.matchedKeywords]
        .sort((a, b) => IMPORTANCE_RANK[a.importance] - IMPORTANCE_RANK[b.importance])
        .slice(0, MAX_KEYWORDS_SHOWN)
        .map((keyword) => keyword.term),
      missingKeywords: [...result.missingKeywords]
        .sort((a, b) => IMPORTANCE_RANK[a.importance] - IMPORTANCE_RANK[b.importance])
        .slice(0, MAX_KEYWORDS_SHOWN)
        .map((keyword) => keyword.term),
      topFixes: [...result.prioritizedFixes]
        .sort((a, b) => PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority])
        .slice(0, MAX_FIXES_SHOWN)
        .map((fix) => fix.message),
      hasJobDescription: parsedFields.data.jobDescription !== undefined,
    };

    let resultToken: string | null = null;
    try {
      resultToken = await persistQuickScanResult(reduced);
    } catch (err) {
      // The scan itself succeeded and already spent the caller's quota —
      // never discard a real result over a persistence failure, just
      // show it without a reopen/PDF link.
      console.error("Failed to persist Quick Scan result:", err);
    }

    let emailSent = false;
    if (resultToken) {
      try {
        // Required, transactional delivery of the report the caller
        // already asked for — sent to the raw email they typed, not the
        // normalized rate-limit key, and unconditionally: it does not
        // check (or get skipped by) `parsedFields.data.website`'s
        // sibling `marketingConsent` field, which only ever reaches
        // subscribeToNewsletter (called separately, client-side, in
        // src/components/marketing/free-ats-checker-form.tsx). Best-
        // effort like persistence above: a failed send must never hide
        // the result already shown on the page — but the UI must also
        // never claim a copy was emailed when it wasn't, so success is
        // tracked and returned rather than assumed.
        await sendQuickScanReportEmail(parsedFields.data.email, resultToken, reduced);
        emailSent = true;
      } catch (err) {
        console.error("Failed to send Quick Scan report email:", err);
      }
    }

    return { ...reduced, resultToken, emailSent };
  } catch (err) {
    return { error: safeErrorMessage(err) };
  }
}
