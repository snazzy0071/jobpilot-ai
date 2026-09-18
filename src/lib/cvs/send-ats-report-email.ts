import "server-only";
import { siteConfig } from "@/config/site";
import { sendEmail } from "@/lib/email/resend";
import { escapeHtml } from "@/lib/email/escape-html";
import { renderEmailLayout, emailHeading, emailButton, emailSmallPrint } from "@/lib/email/layout";

function keywordListHtml(keywords: string[]): string {
  if (keywords.length === 0) return `<p style="color:#6b7280;font-size:13px;">None — nice work.</p>`;
  return `<p style="font-size:13px;line-height:1.8;">${keywords.map((keyword) => escapeHtml(keyword)).join(", ")}</p>`;
}

function buildAtsReportEmailHtml(score: number, missingKeywords: string[], cvLink: string): string {
  const bodyHtml = `
    ${emailHeading(`Your ATS scan result: ${score}/100`)}
    <h2 style="font-size:12px;text-transform:uppercase;letter-spacing:0.04em;color:#6b7280;margin:0 0 6px;">Top missing keywords</h2>
    ${keywordListHtml(missingKeywords)}
    ${emailButton("View full results", cvLink)}
    ${emailSmallPrint("This is a copy of the scan you just ran, for your records.")}
  `;

  return renderEmailLayout({ previewText: `Your ATS scan result: ${score}/100`, bodyHtml });
}

/**
 * Best-effort — fired after runAtsScan() has already persisted the scan
 * and the caller already sees the result rendered in-app, same "email is
 * a bonus copy, never a gate on the real result" reasoning as Quick
 * Scan's sendQuickScanReportEmail (src/lib/quick-scan/send-report-email.ts).
 */
export async function sendAtsReportEmail(to: string, score: number, missingKeywords: string[], cvId: string): Promise<void> {
  try {
    await sendEmail({
      to,
      subject: `Your ATS scan result: ${score}/100`,
      html: buildAtsReportEmailHtml(score, missingKeywords, `${siteConfig.domain}/dashboard/cvs/${cvId}`),
      template: "ats_scan_report",
    });
  } catch (err) {
    console.error("sendAtsReportEmail failed:", err);
  }
}
