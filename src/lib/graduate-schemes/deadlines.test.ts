import { describe, expect, it } from "vitest";
import { CLOSING_SOON_DAYS, deadlineGroup, hasNoPublishedDeadline, isClosingSoon } from "@/lib/graduate-schemes/status";
import { filterSchemes, parseSchemeFilters, sortSchemes } from "@/lib/graduate-schemes/filter";
import { updateSchemeDatesSchema } from "@/lib/graduate-schemes/schemas";
import type { GraduateScheme } from "@/lib/graduate-schemes/types";

const TODAY = "2026-06-15";
const t = (over: Partial<Pick<GraduateScheme, "opensOn" | "deadlineOn" | "isRolling">>) => ({ opensOn: null, deadlineOn: null, isRolling: false, ...over });

describe("closing soon", () => {
  it("includes today through 14 days out, excludes 15+ and closed", () => {
    expect(CLOSING_SOON_DAYS).toBe(14);
    expect(isClosingSoon(t({ deadlineOn: "2026-06-15" }), TODAY)).toBe(true);
    expect(isClosingSoon(t({ deadlineOn: "2026-06-29" }), TODAY)).toBe(true);
    expect(isClosingSoon(t({ deadlineOn: "2026-06-30" }), TODAY)).toBe(false);
    expect(isClosingSoon(t({ deadlineOn: "2026-06-14" }), TODAY)).toBe(false);
  });
  it("is never true without a published deadline, or before opening", () => {
    expect(isClosingSoon(t({ isRolling: true }), TODAY)).toBe(false);
    expect(isClosingSoon(t({ opensOn: "2026-06-20", deadlineOn: "2026-06-25" }), TODAY)).toBe(false);
  });
});

describe("deadlineGroup", () => {
  it("puts every scheme in exactly one group", () => {
    expect(deadlineGroup(t({ deadlineOn: "2026-06-20" }), TODAY)).toBe("closing_soon");
    expect(deadlineGroup(t({ deadlineOn: "2026-09-01" }), TODAY)).toBe("open");
    expect(deadlineGroup(t({ isRolling: true }), TODAY)).toBe("rolling");
    expect(deadlineGroup(t({ isRolling: true, deadlineOn: "2026-09-01" }), TODAY)).toBe("open");
    expect(deadlineGroup(t({ opensOn: "2026-07-01" }), TODAY)).toBe("upcoming");
    expect(deadlineGroup(t({}), TODAY)).toBe("no_deadline");
    expect(deadlineGroup(t({ opensOn: "2026-06-01" }), TODAY)).toBe("no_deadline"); // opened, but no closing date published
    expect(deadlineGroup(t({ deadlineOn: "2026-06-01" }), TODAY)).toBe("closed");
  });
  it("no published deadline excludes closed schemes", () => {
    expect(hasNoPublishedDeadline(t({}), TODAY)).toBe(true);
    expect(hasNoPublishedDeadline(t({ deadlineOn: "2026-09-01" }), TODAY)).toBe(false);
  });
});

function scheme(over: Partial<GraduateScheme>): GraduateScheme {
  return {
    id: over.slug ?? "x", slug: "x", employer: "E", schemeName: "S", sector: "law", description: null, salary: null, salaryMin: null, salaryMax: null, locations: [], studyStages: [],
    opensOn: null, deadlineOn: null, isRolling: false, sponsorshipStatus: "sponsors", assessments: [], assessmentNotes: null, applicationUrl: null, notes: null,
    sourceUrl: "https://e.com", sourceDate: "2026-01-01", verifiedAt: "2026-01-02", isPublished: true, updatedAt: "", ...over,
  };
}

describe("deadline filters and sorts", () => {
  const list = [
    scheme({ slug: "soon", employer: "A", deadlineOn: "2026-06-20", opensOn: "2026-05-01" }),
    scheme({ slug: "later", employer: "B", deadlineOn: "2026-10-01", opensOn: "2026-02-01" }),
    scheme({ slug: "roll", employer: "C", isRolling: true }),
    scheme({ slug: "none", employer: "D" }),
    scheme({ slug: "closed", employer: "F", deadlineOn: "2026-06-01" }),
    scheme({ slug: "up", employer: "G", opensOn: "2026-08-01", deadlineOn: "2026-11-01" }),
  ];
  const slugs = (params: Record<string, string>) => filterSchemes(list, parseSchemeFilters(params), TODAY).map((s) => s.slug);

  it("filters closing soon and no published deadline", () => {
    expect(slugs({ status: "closing_soon" })).toEqual(["soon"]);
    expect(slugs({ status: "no_deadline" })).toEqual(["roll", "none", "up"].filter((s) => s !== "up"));
    expect(slugs({ status: "closed" })).toEqual(["closed"]);
  });
  it("sorts by opening date with unpublished ones last", () => {
    expect(sortSchemes(list, "opens", TODAY).map((s) => s.slug)).toEqual(["later", "soon", "up", "roll", "none", "closed"]);
  });
  it("deadline sort keeps closing soonest first and closed last", () => {
    expect(sortSchemes(list, "deadline", TODAY).map((s) => s.slug)).toEqual(["soon", "later", "roll", "up", "none", "closed"]);
  });
});

describe("updateSchemeDatesSchema", () => {
  const base = { id: "3f0c1f9e-6f2e-4b7e-9a51-0f3a5d6b7c8d", opensOn: "2026-05-01", deadlineOn: "2026-09-01", isRolling: false, sourceUrl: "https://example.com/x", sourceDate: "2026-01-01", verifiedAt: "2026-01-02" };
  it("accepts dates with their evidence", () => {
    expect(updateSchemeDatesSchema.safeParse(base).success).toBe(true);
  });
  it("lets a date be cleared (not published)", () => {
    const parsed = updateSchemeDatesSchema.parse({ ...base, opensOn: "", deadlineOn: "" });
    expect(parsed.opensOn).toBeNull();
    expect(parsed.deadlineOn).toBeNull();
  });
  it("requires evidence and coherent dates", () => {
    expect(updateSchemeDatesSchema.safeParse({ ...base, sourceUrl: "" }).success).toBe(false);
    expect(updateSchemeDatesSchema.safeParse({ ...base, sourceUrl: "javascript:1" }).success).toBe(false);
    expect(updateSchemeDatesSchema.safeParse({ ...base, deadlineOn: "2026-04-01" }).success).toBe(false);
    expect(updateSchemeDatesSchema.safeParse({ ...base, verifiedAt: "2099-01-01" }).success).toBe(false);
    expect(updateSchemeDatesSchema.safeParse({ ...base, verifiedAt: "2025-12-01" }).success).toBe(false);
    expect(updateSchemeDatesSchema.safeParse({ ...base, opensOn: "31/12/2026" }).success).toBe(false);
  });
});
