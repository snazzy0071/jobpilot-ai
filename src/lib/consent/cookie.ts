import { DEFAULT_CONSENT_STATE, type ConsentState } from "@/lib/consent/types";

// No "server-only"/"use client" here on purpose — this module is pure
// parsing/serialization with no DOM or Next.js API access, imported by
// both the server-side reader (src/lib/consent/server.ts, via
// next/headers) and the client-side hook
// (src/lib/consent/use-consent.ts, via document.cookie), so the two
// can never disagree on the cookie's shape.

export const CONSENT_COOKIE_NAME = "cookie_consent";
export const CONSENT_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 365; // 1 year

/**
 * Deliberately tolerant of anything malformed (missing cookie, corrupted
 * value, a shape from some future/older version of this schema) — it
 * falls back to the fully-undecided default rather than throwing, since
 * a parse failure here must never crash a page render. Falling back to
 * "undecided" rather than "denied" as a distinct state matters too: it's
 * what makes the banner reappear for a corrupted cookie instead of
 * silently and permanently treating the visitor as having opted out.
 */
export function parseConsentCookie(rawValue: string | undefined | null): ConsentState {
  if (!rawValue) return DEFAULT_CONSENT_STATE;
  try {
    const parsed: unknown = JSON.parse(decodeURIComponent(rawValue));
    if (typeof parsed !== "object" || parsed === null) return DEFAULT_CONSENT_STATE;
    const candidate = parsed as Record<string, unknown>;
    return {
      necessary: true,
      analytics: candidate.analytics === true,
      marketing: candidate.marketing === true,
      decidedAt: typeof candidate.decidedAt === "string" ? candidate.decidedAt : null,
    };
  } catch {
    return DEFAULT_CONSENT_STATE;
  }
}

export function serializeConsentCookie(state: ConsentState): string {
  return encodeURIComponent(JSON.stringify(state));
}
