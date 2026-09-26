import "server-only";
import { siteConfig } from "@/config/site";
import { sendEmail } from "@/lib/email/resend";
import { escapeHtml } from "@/lib/email/escape-html";
import { renderEmailLayout, emailButton, emailSmallPrint } from "@/lib/email/layout";
import { generateQuickScanPdf } from "@/lib/quick-scan/pdf-export";
import type { QuickScanReducedResult } from "@/lib/quick-scan/results";

function keywordListHtml(keywords: string[]): string {
  if (keywords.length === 0) return "<p style=\"color:#6b7280;font-size:13px;\">None found.</p>";
  return `<p style="font-size:13px;line-height:1.8;">${keywords.map((k) => escapeHtml(k)).join(", ")}</p>`;
}

function fixListHtml(fixes: string[]): string {
  return `<ul style="margin:0;padding-left:18px;font-size:13px;line-height:1.7;">${fixes
    .map((fix) => `<li>${escapeHtml(fix)}</li>`)
    .join("")}</ul>`;
}

// The score/keyword/fix layout here is genuinely bespoke to this one
// email (nothing else in the app renders a score-out-of-100 or a
// matched/missing keyword split), so it stays hand-built rather than
// forced through the generic heading/paragraph blocks in
// src/lib/email/layout.ts — but the outer shell and the closing
// CTA/disclaimer now go through that shared layout instead of
// duplicating their own header/footer/button markup.
function buildReportEmailHtml(result: QuickScanReducedResult, resultLink: string): string {
  const bodyHtml = `
    <h1 style="font-size:18px;margin:0 0 4px;color:#111827;">Your ATS scan result</h1>
    <p style="font-size:36px;font-weight:700;margin:16px 0 0;">${result.overallScore}<span style="font-size:14px;color:#6b7280;font-weight:400;"> / 100 ${result.hasJobDescription ? "match with your job description" : "general ATS-readiness"}</span></p>
    <p style="font-size:13px;line-height:1.6;margin:8px 0 20px;">${escapeHtml(result.summary)}</p>

    <h2 style="font-size:12px;text-transform:uppercase;letter-spacing:0.04em;color:#6b7280;margin:0 0 6px;">Top matched keywords</h2>
    ${keywordListHtml(result.matchedKeywords)}

    <h2 style="font-size:12px;text-transform:uppercase;letter-spacing:0.04em;color:#6b7280;margin:20px 0 6px;">Top missing keywords</h2>
    ${keywordListHtml(result.missingKeywords)}

    <h2 style="font-size:12px;text-transform:uppercase;letter-spacing:0.04em;color:#6b7280;margin:20px 0 6px;">Top fixes</h2>
    ${fixListHtml(result.topFixes)}

    ${emailButton("Reopen this result", resultLink)}
    ${emailSmallPrint("The full PDF report is attached. This link is private to you — don't share it unless you mean to. It works for 90 days.")}
  `;

  return renderEmailLayout({ previewText: `Your ATS scan result: ${result.overallScore}/100`, bodyHtml });
}

/**
 * The one email Quick Scan sends — a required, transactional delivery
 * of the report the caller already asked for by submitting the form,
 * not a marketing send. Always sent regardless of the separate
 * `marketingConsent` checkbox (src/lib/newsletter/actions.ts's
 * subscribeToNewsletter is the only thing that checkbox controls) —
 * the two must never share a gate, since consenting to marketing email
 * is not the same thing as agreeing to receive the report you already
 * asked for, and withholding the report over an unchecked marketing box
 * would make the checkbox coercive rather than optional.
 *
 * Best-effort: called after the scan has already succeeded and the
 * result already persisted, so a failure here (Resend down, PDF
 * generation failing) must never undo or hide the result the caller
 * already sees on the page — the caller catches and logs, it doesn't
 * propagate.
 */
export async function sendQuickScanReportEmail(
  to: string,
  resultToken: string,
  result: QuickScanReducedResult,
): Promise<void> {
  const resultLink = `${siteConfig.domain}/free-ats-checker/results/${resultToken}`;

  let pdfBuffer: Buffer | null = null;
  try {
    pdfBuffer = await generateQuickScanPdf(resultToken);
  } catch (err) {
    console.error("Quick Scan report email: PDF generation failed, sending without attachment:", err);
  }

  await sendEmail({
    to,
    subject: `Your ATS scan result: ${result.overallScore}/100`,
    html: buildReportEmailHtml(result, resultLink),
    template: "quick_scan_report",
    attachments: pdfBuffer ? [{ filename: "ats-scan-report.pdf", content: pdfBuffer }] : undefined,
  });
}
