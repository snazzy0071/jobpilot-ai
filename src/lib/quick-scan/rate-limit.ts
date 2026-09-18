import "server-only";
import { getRequestIp } from "@/lib/rate-limit/request-ip";
import { getCalendarWindowStart } from "@/lib/rate-limit/windows";
import { consumeAnonymousRateLimit } from "@/lib/rate-limit/store";

const EMAIL_SCOPE = "quick_scan_email";
const IP_SCOPE = "quick_scan_ip";
const PDF_IP_SCOPE = "quick_scan_pdf_ip";

// The real product limit: 2 scans per normalized email per calendar
// month.
const MAX_SCANS_PER_EMAIL_PER_MONTH = 2;
// A looser, secondary deterrent against cycling through fake/disposable
// email addresses to bypass the email cap — not the primary control,
// and deliberately generous so a shared office/university IP isn't
// blocked under ordinary use.
const MAX_SCANS_PER_IP_PER_DAY = 10;
// The PDF endpoint doesn't call the AI gateway at all (it only renders
// an already-persisted result), so it needs its own guard against a
// different cost: a real token is unguessable, but repeatedly hitting a
// *known* valid one would still spin up headless Chromium on demand —
// generous enough for legitimate re-downloads, tight enough to bound that.
const MAX_PDFS_PER_IP_PER_HOUR = 20;

export type QuickScanRateLimitResult = { allowed: true } | { allowed: false; reason: "email" | "ip" };

/**
 * Two independent layers, checked cheapest/least-precious first: the IP
 * check runs (and consumes its own counter) before the email check, so
 * a request that would be IP-blocked anyway never burns one of the
 * user's real 2-per-month email-scoped attempts for nothing — that
 * quota is only ever consumed for a request that actually reaches the
 * scoring core.
 */
export async function consumeQuickScanRateLimit(normalizedEmail: string): Promise<QuickScanRateLimitResult> {
  const ip = await getRequestIp();
  if (ip) {
    const { allowed: ipAllowed } = await consumeAnonymousRateLimit(IP_SCOPE, ip, getCalendarWindowStart("day"), MAX_SCANS_PER_IP_PER_DAY);
    if (!ipAllowed) return { allowed: false, reason: "ip" };
  }

  const { allowed: emailAllowed } = await consumeAnonymousRateLimit(
    EMAIL_SCOPE,
    normalizedEmail,
    getCalendarWindowStart("month"),
    MAX_SCANS_PER_EMAIL_PER_MONTH,
  );
  if (!emailAllowed) return { allowed: false, reason: "email" };

  return { allowed: true };
}

/** Guards PDF generation specifically (src/app/api/quick-scan/[token]/pdf) — see MAX_PDFS_PER_IP_PER_HOUR. An IP that can't be determined is let through, same tradeoff consumeQuickScanRateLimit makes: this is a secondary defense on top of the token's own unguessability, not the primary one. */
export async function consumeQuickScanPdfRateLimit(): Promise<boolean> {
  const ip = await getRequestIp();
  if (!ip) return true;
  const { allowed } = await consumeAnonymousRateLimit(PDF_IP_SCOPE, ip, getCalendarWindowStart("hour"), MAX_PDFS_PER_IP_PER_HOUR);
  return allowed;
}
