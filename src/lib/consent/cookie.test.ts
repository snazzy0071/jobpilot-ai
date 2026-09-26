import { describe, expect, it } from "vitest";
import { parseConsentCookie, serializeConsentCookie } from "@/lib/consent/cookie";
import { DEFAULT_CONSENT_STATE } from "@/lib/consent/types";

describe("consent cookie", () => {
  it("round-trips a decision", () => {
    const state = { necessary: true as const, analytics: true, marketing: false, decidedAt: "2026-09-26T10:00:00.000Z" };
    expect(parseConsentCookie(serializeConsentCookie(state))).toEqual(state);
  });

  it("treats a missing or malformed cookie as undecided, so the banner comes back rather than the visitor silently opting out", () => {
    for (const raw of [undefined, null, "", "not-json", encodeURIComponent("[1,2]"), encodeURIComponent("null"), "%E0%A4%A"]) {
      expect(parseConsentCookie(raw)).toEqual(DEFAULT_CONSENT_STATE);
    }
  });

  it("never lets a cookie switch on a category that was not explicitly true, and always keeps necessary on", () => {
    const raw = encodeURIComponent(JSON.stringify({ necessary: false, analytics: "yes", marketing: 1, decidedAt: 5 }));
    expect(parseConsentCookie(raw)).toEqual({ necessary: true, analytics: false, marketing: false, decidedAt: null });
  });
});
