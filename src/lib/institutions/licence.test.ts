import { describe, expect, it } from "vitest";
import { daysUntilExpiry, endOfDayUtc, institutionPlanWins, licenceState, normaliseDomain, seatsRemaining } from "@/lib/institutions/licence";

const now = new Date("2026-09-26T12:00:00Z");
const base = { isActive: true, startsAt: "2026-01-01T00:00:00Z", expiresAt: null as string | null };

describe("licenceState", () => {
  it("is active with no end date, or before the end", () => {
    expect(licenceState(base, now)).toBe("active");
    expect(licenceState({ ...base, expiresAt: "2026-12-31T23:59:59Z" }, now)).toBe("active");
  });
  it("is expired at and after the end instant", () => {
    expect(licenceState({ ...base, expiresAt: "2026-09-26T12:00:00Z" }, now)).toBe("expired");
    expect(licenceState({ ...base, expiresAt: "2026-09-01T00:00:00Z" }, now)).toBe("expired");
  });
  it("is scheduled before it starts and inactive when switched off (off wins over expiry)", () => {
    expect(licenceState({ ...base, startsAt: "2026-10-01T00:00:00Z" }, now)).toBe("scheduled");
    expect(licenceState({ ...base, isActive: false, expiresAt: "2026-01-02T00:00:00Z" }, now)).toBe("inactive");
  });
});

describe("daysUntilExpiry", () => {
  it("counts whole days for an active licence and is null otherwise", () => {
    expect(daysUntilExpiry({ ...base, expiresAt: "2026-10-06T12:00:00Z" }, now)).toBe(10);
    expect(daysUntilExpiry({ ...base, expiresAt: "2026-09-27T00:00:00Z" }, now)).toBe(1);
    expect(daysUntilExpiry(base, now)).toBeNull();
    expect(daysUntilExpiry({ ...base, expiresAt: "2026-09-01T00:00:00Z" }, now)).toBeNull();
  });
});

describe("endOfDayUtc / seatsRemaining", () => {
  it("expires at the end of the chosen day", () => expect(endOfDayUtc("2026-12-31")).toBe("2026-12-31T23:59:59.999Z"));
  it("reserves a seat per member and per pending invite, never below zero", () => {
    expect(seatsRemaining(10, 6, 2)).toBe(2);
    expect(seatsRemaining(3, 3, 1)).toBe(0);
  });
});

describe("normaliseDomain", () => {
  it("accepts and cleans plausible domains", () => {
    expect(normaliseDomain(" @Uni.AC.uk ")).toBe("uni.ac.uk");
    expect(normaliseDomain("https://students.uni.ac.uk/path")).toBe("students.uni.ac.uk");
  });
  it("rejects anything else", () => {
    for (const bad of ["", "uni", "a b.com", "uni..com", "-x.com", "x.c", "user@uni.ac.uk"]) expect(normaliseDomain(bad)).toBeNull();
  });
});

describe("institutionPlanWins", () => {
  it("prefers the higher tier; a tie or lower keeps the personal plan", () => {
    expect(institutionPlanWins("free", "premium")).toBe(true);
    expect(institutionPlanWins("pro", "elite")).toBe(true);
    expect(institutionPlanWins("premium", "premium")).toBe(false);
    expect(institutionPlanWins("elite", "pro")).toBe(false);
    expect(institutionPlanWins("free", "custom")).toBe(true);
  });
});
