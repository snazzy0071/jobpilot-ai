import { describe, expect, it } from "vitest";
import { computeStreaks, isValidTimeZone, localDateString, shiftDateString } from "@/lib/test-prep/daily/streak";

describe("shiftDateString", () => {
  it("counts calendar days across month, year and leap boundaries", () => {
    expect(shiftDateString("2026-03-01", -1)).toBe("2026-02-28");
    expect(shiftDateString("2028-03-01", -1)).toBe("2028-02-29");
    expect(shiftDateString("2026-12-31", 1)).toBe("2027-01-01");
  });

  it("is not thrown by daylight-saving changes", () => {
    expect(shiftDateString("2026-03-29", 1)).toBe("2026-03-30");
    expect(shiftDateString("2026-10-25", -1)).toBe("2026-10-24");
  });
});

describe("localDateString", () => {
  it("gives the date in the caller's zone, not UTC", () => {
    const instant = new Date("2026-06-10T23:30:00Z");
    expect(localDateString(instant, "UTC")).toBe("2026-06-10");
    expect(localDateString(instant, "Pacific/Auckland")).toBe("2026-06-11");
    expect(localDateString(instant, "America/Los_Angeles")).toBe("2026-06-10");
  });
});

describe("isValidTimeZone", () => {
  it("accepts real zones and rejects junk", () => {
    expect(isValidTimeZone("Europe/London")).toBe(true);
    expect(isValidTimeZone("Not/AZone")).toBe(false);
  });
});

describe("computeStreaks", () => {
  it("is zero with no history", () => {
    expect(computeStreaks([], "2026-05-10")).toEqual({ current: 0, longest: 0, totalDays: 0 });
  });

  it("counts consecutive days ending today", () => {
    expect(computeStreaks(["2026-05-08", "2026-05-09", "2026-05-10"], "2026-05-10").current).toBe(3);
  });

  it("keeps the streak alive when today isn't done yet", () => {
    expect(computeStreaks(["2026-05-08", "2026-05-09"], "2026-05-10").current).toBe(2);
  });

  it("breaks the streak after a missed day", () => {
    const result = computeStreaks(["2026-05-01", "2026-05-02", "2026-05-03", "2026-05-08"], "2026-05-10");
    expect(result.current).toBe(0);
    expect(result.longest).toBe(3);
    expect(result.totalDays).toBe(4);
  });

  it("ignores duplicates and input order", () => {
    const result = computeStreaks(["2026-05-10", "2026-05-09", "2026-05-09", "2026-05-08"], "2026-05-10");
    expect(result).toEqual({ current: 3, longest: 3, totalDays: 3 });
  });

  it("chains across a month boundary", () => {
    expect(computeStreaks(["2026-04-30", "2026-05-01"], "2026-05-01").current).toBe(2);
  });
});
