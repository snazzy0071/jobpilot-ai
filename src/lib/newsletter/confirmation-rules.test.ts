import { describe, expect, it } from "vitest";
import { CONFIRMATION_TTL_HOURS, decideConfirmation, isConfirmationExpired } from "@/lib/newsletter/confirmation-rules";

const NOW = new Date("2026-09-26T12:00:00Z");
const hoursAgo = (hours: number) => new Date(NOW.getTime() - hours * 3_600_000).toISOString();

describe("isConfirmationExpired", () => {
  it("is valid up to the limit and expired after it", () => {
    expect(isConfirmationExpired(hoursAgo(CONFIRMATION_TTL_HOURS - 1), NOW)).toBe(false);
    expect(isConfirmationExpired(hoursAgo(CONFIRMATION_TTL_HOURS + 1), NOW)).toBe(true);
  });
  it("treats a missing or unreadable time as expired rather than open-ended", () => {
    expect(isConfirmationExpired(null, NOW)).toBe(true);
    expect(isConfirmationExpired("not a date", NOW)).toBe(true);
  });
});

describe("decideConfirmation", () => {
  it("confirms a fresh pending row", () => {
    expect(decideConfirmation({ status: "pending", confirmation_sent_at: hoursAgo(1) }, NOW)).toBe("confirmed");
  });
  it("is idempotent: a second click on a confirmed subscription is fine", () => {
    expect(decideConfirmation({ status: "subscribed", confirmation_sent_at: hoursAgo(500) }, NOW)).toBe("already_confirmed");
  });
  it("refuses an expired link, an unknown token and someone who has since unsubscribed", () => {
    expect(decideConfirmation({ status: "pending", confirmation_sent_at: hoursAgo(100) }, NOW)).toBe("expired");
    expect(decideConfirmation(null, NOW)).toBe("invalid");
    expect(decideConfirmation({ status: "unsubscribed", confirmation_sent_at: hoursAgo(1) }, NOW)).toBe("invalid");
  });
});
