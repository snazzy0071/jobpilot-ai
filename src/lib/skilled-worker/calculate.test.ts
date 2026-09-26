import { describe, expect, it } from "vitest";
import { GENERAL_THRESHOLD, RATE_RULES } from "@/config/skilled-worker";
import { checkSalary, formatPounds, parsePounds } from "@/lib/skilled-worker/calculate";

describe("checkSalary", () => {
  it("standard: the higher of the general threshold and the going rate", () => {
    expect(checkSalary({ salary: 45_000, goingRate: 38_000, category: "standard" })).toMatchObject({ meets: true, required: GENERAL_THRESHOLD, shortfall: 0 });
    expect(checkSalary({ salary: 45_000, goingRate: 52_000, category: "standard" })).toMatchObject({ meets: false, required: 52_000, shortfall: 7_000 });
    expect(checkSalary({ salary: 52_000, goingRate: 52_000, category: "standard" })).toMatchObject({ meets: true });
  });

  it("new entrant: 70% of the going rate, never below the reduced floor", () => {
    expect(checkSalary({ salary: 34_000, goingRate: 40_000, category: "new_entrant" })).toMatchObject({ meets: true, required: 33_400, fromGoingRate: 28_000 });
    expect(checkSalary({ salary: 34_000, goingRate: 60_000, category: "new_entrant" })).toMatchObject({ meets: false, required: 42_000, shortfall: 8_000 });
  });

  it("PhD rates: 80% (STEM, floor 33,400) and 90% (non-STEM, floor 37,500)", () => {
    expect(checkSalary({ salary: 40_000, goingRate: 50_000, category: "phd_stem" })).toMatchObject({ meets: true, required: 40_000 });
    expect(checkSalary({ salary: 39_999, goingRate: 50_000, category: "phd_stem" })).toMatchObject({ meets: false, shortfall: 1 });
    expect(checkSalary({ salary: 38_000, goingRate: 30_000, category: "phd_non_stem" })).toMatchObject({ meets: true, required: 37_500 });
    expect(checkSalary({ salary: 44_000, goingRate: 50_000, category: "phd_non_stem" })).toMatchObject({ meets: false, required: 45_000, shortfall: 1_000 });
  });

  it("postdoctoral: 70% with the reduced floor", () => {
    expect(checkSalary({ salary: 33_400, goingRate: 40_000, category: "postdoctoral" })).toMatchObject({ meets: true, required: 33_400 });
  });

  it("without a going rate: a salary under the floor is a no; above it cannot be confirmed", () => {
    expect(checkSalary({ salary: 30_000, goingRate: null, category: "standard" })).toMatchObject({ meets: false, goingRateNeeded: true, shortfall: 11_700 });
    expect(checkSalary({ salary: 60_000, goingRate: null, category: "standard" })).toMatchObject({ meets: null, goingRateNeeded: true, required: GENERAL_THRESHOLD });
  });

  it("every category's share is between 0 and 1 and its floor never exceeds the general threshold", () => {
    for (const rule of Object.values(RATE_RULES)) {
      expect(rule.goingRateShare).toBeGreaterThan(0);
      expect(rule.goingRateShare).toBeLessThanOrEqual(1);
      expect(rule.floor).toBeLessThanOrEqual(GENERAL_THRESHOLD);
    }
  });
});

describe("parsePounds / formatPounds", () => {
  it("reads what people type", () => {
    expect(parsePounds("£41,700")).toBe(41_700);
    expect(parsePounds(" 41700 ")).toBe(41_700);
    expect(parsePounds("41,700.50")).toBe(41_700.5);
  });
  it("rejects blanks, words, negatives, zero and absurd values", () => {
    for (const bad of ["", "abc", "-5", "0", "12.345", "99999999999", null, undefined]) expect(parsePounds(bad)).toBeNull();
  });
  it("formats whole pounds", () => {
    expect(formatPounds(41_700)).toBe("£41,700");
  });
});
