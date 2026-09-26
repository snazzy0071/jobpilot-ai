import { describe, expect, it } from "vitest";
import { applicationStatus, daysBetween, timelineSummary, todayInUk } from "@/lib/graduate-schemes/status";
import { filterSchemes, paginate, parseSchemeFilters, schemeFiltersToQuery, sortSchemes, type SchemeFilters } from "@/lib/graduate-schemes/filter";
import { slugify, uniqueSlug } from "@/lib/graduate-schemes/slug";
import { createGraduateSchemeSchema, schemeRules } from "@/lib/graduate-schemes/schemas";
import { parseGraduateSchemeCsv, resolveBoolean, resolveStudyStages } from "@/lib/graduate-schemes/csv";
import type { GraduateScheme, SchemeAssessment } from "@/lib/graduate-schemes/types";

const TODAY = "2026-06-15";

function mapping(type: SchemeAssessment["type"]): SchemeAssessment {
  return { id: type, schemeId: "s", type, label: null, provider: null, notes: null, isRequired: true, displayOrder: 0, sourceUrl: "https://e.com", sourceDate: "2026-01-01", verifiedAt: "2026-01-02" };
}

function scheme(over: Partial<GraduateScheme> = {}): GraduateScheme {
  return {
    id: over.id ?? over.slug ?? "id",
    slug: "acme-tech",
    employer: "Acme",
    schemeName: "Tech Programme",
    sector: "technology",
    description: null,
    salary: null,
    salaryMin: null,
    salaryMax: null,
    locations: [],
    studyStages: [],
    opensOn: null,
    deadlineOn: null,
    isRolling: false,
    sponsorshipStatus: "not_published",
    assessments: [],
    assessmentNotes: null,
    applicationUrl: null,
    notes: null,
    sourceUrl: "https://example.com",
    sourceDate: "2026-01-01",
    verifiedAt: "2026-01-02",
    isPublished: true,
    updatedAt: "2026-01-02T00:00:00Z",
    ...over,
  };
}

describe("applicationStatus", () => {
  it("is closed the day after the deadline, open on the deadline day", () => {
    expect(applicationStatus(scheme({ deadlineOn: "2026-06-14" }), TODAY)).toBe("closed");
    expect(applicationStatus(scheme({ deadlineOn: "2026-06-15" }), TODAY)).toBe("open");
  });
  it("is upcoming before the opening date", () => {
    expect(applicationStatus(scheme({ opensOn: "2026-07-01", deadlineOn: "2026-09-01" }), TODAY)).toBe("upcoming");
  });
  it("is open once opened, or when rolling", () => {
    expect(applicationStatus(scheme({ opensOn: "2026-06-01", deadlineOn: "2026-09-01" }), TODAY)).toBe("open");
    expect(applicationStatus(scheme({ isRolling: true }), TODAY)).toBe("open");
  });
  it("does not guess when nothing is published", () => {
    expect(applicationStatus(scheme(), TODAY)).toBe("dates_not_published");
  });
  it("a rolling scheme past its cut-off is still closed", () => {
    expect(applicationStatus(scheme({ isRolling: true, deadlineOn: "2026-06-01" }), TODAY)).toBe("closed");
  });
});

describe("timelineSummary", () => {
  it("counts days honestly", () => {
    expect(timelineSummary(scheme({ deadlineOn: "2026-06-25" }), TODAY)).toBe("Closes in 10 days");
    expect(timelineSummary(scheme({ deadlineOn: "2026-06-16" }), TODAY)).toBe("Closes in 1 day");
    expect(timelineSummary(scheme({ deadlineOn: "2026-06-15" }), TODAY)).toBe("Closes today");
    expect(timelineSummary(scheme({ deadlineOn: "2026-06-12" }), TODAY)).toBe("Closed 3 days ago");
    expect(timelineSummary(scheme({ opensOn: "2026-06-20" }), TODAY)).toBe("Opens in 5 days");
    expect(timelineSummary(scheme({ isRolling: true }), TODAY)).toMatch(/^Rolling/);
    expect(timelineSummary(scheme(), TODAY)).toMatch(/hasn't published/);
  });
  it("counts across DST changes and month ends", () => {
    expect(daysBetween("2026-03-28", "2026-03-30")).toBe(2);
    expect(daysBetween("2026-01-31", "2026-03-01")).toBe(29);
  });
});

describe("todayInUk", () => {
  it("uses the UK date, not UTC's", () => {
    expect(todayInUk(new Date("2026-06-15T23:30:00Z"))).toBe("2026-06-16"); // BST
    expect(todayInUk(new Date("2026-12-15T23:30:00Z"))).toBe("2026-12-15"); // GMT
  });
});

describe("filters", () => {
  const list = [
    scheme({ id: "a", slug: "a", employer: "Alpha", schemeName: "Engineering", sector: "engineering_and_manufacturing", locations: ["Leeds", "London"], studyStages: ["final_year"], deadlineOn: "2026-06-30", sponsorshipStatus: "sponsors", assessments: [mapping("numerical")], salaryMax: 40000, verifiedAt: "2026-05-01" }),
    scheme({ id: "b", slug: "b", employer: "Beta", schemeName: "Finance", sector: "banking_and_finance", locations: ["London"], studyStages: ["graduate"], isRolling: true, sponsorshipStatus: "no", salaryMax: 50000, verifiedAt: "2026-06-01" }),
    scheme({ id: "c", slug: "c", employer: "Gamma", schemeName: "Law", sector: "law", deadlineOn: "2026-05-01", verifiedAt: "2026-04-01" }),
    scheme({ id: "d", slug: "d", employer: "Delta", schemeName: "Consulting", sector: "consulting", opensOn: "2026-09-01", deadlineOn: "2026-11-01", verifiedAt: "2026-03-01" }),
    scheme({ id: "e", slug: "e", employer: "Epsilon", schemeName: "Mystery", sector: "other" }),
  ];
  const f = (params: Record<string, string>) => parseSchemeFilters(params);
  const ids = (filters: SchemeFilters) => filterSchemes(list, filters, TODAY).map((s) => s.id);

  it("ignores unrecognised values instead of trusting them", () => {
    const parsed = f({ sector: "nonsense", sort: "drop table", page: "-3", status: "x" });
    expect(parsed.sector).toBeNull();
    expect(parsed.sort).toBe("deadline");
    expect(parsed.page).toBe(1);
    expect(parsed.status).toBeNull();
  });
  it("searches employer, programme and location; every word must match", () => {
    expect(ids(f({ q: "alpha" }))).toEqual(["a"]);
    expect(ids(f({ q: "leeds engineering" }))).toEqual(["a"]);
    expect(ids(f({ q: "london" }))).toEqual(["a", "b"]);
    expect(ids(f({ q: "leeds finance" }))).toEqual([]);
  });
  it("filters by sector, stage, sponsorship, location and assessment", () => {
    expect(ids(f({ sector: "law" }))).toEqual(["c"]);
    expect(ids(f({ stage: "graduate" }))).toEqual(["b"]);
    expect(ids(f({ sponsorship: "sponsors" }))).toEqual(["a"]);
    expect(ids(f({ location: "leeds" }))).toEqual(["a"]);
    expect(ids(f({ assessment: "numerical" }))).toEqual(["a"]);
  });
  it("filters by application status", () => {
    expect(ids(f({ status: "open" }))).toEqual(["a", "b"]);
    expect(ids(f({ status: "closed" }))).toEqual(["c"]);
    expect(ids(f({ status: "upcoming" }))).toEqual(["d"]);
    expect(ids(f({ status: "rolling" }))).toEqual(["b"]);
  });
  it("sorts by deadline with open first, unknown dates after upcoming, closed last", () => {
    expect(sortSchemes(list, "deadline", TODAY).map((s) => s.id)).toEqual(["a", "b", "d", "e", "c"]);
  });
  it("sorts by employer, salary and recency", () => {
    expect(sortSchemes(list, "employer", TODAY).map((s) => s.id)).toEqual(["a", "b", "d", "e", "c"]);
    expect(sortSchemes(list, "salary", TODAY).map((s) => s.id).slice(0, 2)).toEqual(["b", "a"]);
    expect(sortSchemes(list, "newest", TODAY).map((s) => s.id)[0]).toBe("b");
  });
  it("round-trips filters through the query string", () => {
    const filters = f({ q: "x y", sector: "law", sort: "employer", page: "3" });
    expect(parseSchemeFilters(Object.fromEntries(new URLSearchParams(schemeFiltersToQuery(filters))))).toEqual(filters);
    expect(schemeFiltersToQuery(f({}))).toBe("");
  });
  it("paginates and clamps the page", () => {
    const many = Array.from({ length: 25 }, (_, i) => i);
    expect(paginate(many, 1).items).toHaveLength(12);
    expect(paginate(many, 3).items).toHaveLength(1);
    expect(paginate(many, 99).page).toBe(3);
    expect(paginate([], 1)).toEqual({ items: [], page: 1, totalPages: 1 });
  });
});

describe("slugs", () => {
  it("makes url-safe, ascii slugs", () => {
    expect(slugify("Nestlé & Co", "Tech/Data Programme (2027)")).toBe("nestle-and-co-tech-data-programme-2027");
    expect(slugify("!!!")).toBe("scheme");
  });
  it("adds a numeric suffix only when needed", () => {
    expect(uniqueSlug("a", new Set())).toBe("a");
    expect(uniqueSlug("a", new Set(["a", "a-2"]))).toBe("a-3");
  });
});

describe("scheme validation", () => {
  const base = { employer: "E", schemeName: "S", sector: "law", sponsorshipStatus: "sponsors", sourceUrl: "https://example.com/x", sourceDate: "2026-01-01", verifiedAt: "2026-01-02" };

  it("accepts a minimal sourced scheme with no invented dates", () => {
    const parsed = createGraduateSchemeSchema.parse(base);
    expect(parsed.opensOn).toBeNull();
    expect(parsed.deadlineOn).toBeNull();
    expect(parsed.studyStages).toEqual([]);
    expect(parsed.isPublished).toBe(true);
  });
  it("requires a source", () => {
    expect(createGraduateSchemeSchema.safeParse({ ...base, sourceUrl: "" }).success).toBe(false);
    expect(createGraduateSchemeSchema.safeParse({ ...base, sourceDate: undefined }).success).toBe(false);
  });
  it("refuses non-http links (javascript:, data:) for source and application", () => {
    expect(createGraduateSchemeSchema.safeParse({ ...base, sourceUrl: "javascript:alert(1)" }).success).toBe(false);
    expect(createGraduateSchemeSchema.safeParse({ ...base, applicationUrl: "data:text/html,x" }).success).toBe(false);
    expect(createGraduateSchemeSchema.safeParse({ ...base, applicationUrl: "https://example.com/apply" }).success).toBe(true);
  });
  it("checks dates and salary ranges against each other", () => {
    expect(createGraduateSchemeSchema.safeParse({ ...base, opensOn: "2026-05-01", deadlineOn: "2026-04-01" }).success).toBe(false);
    expect(createGraduateSchemeSchema.safeParse({ ...base, verifiedAt: "2025-12-01" }).success).toBe(false);
    expect(createGraduateSchemeSchema.safeParse({ ...base, salaryMin: "40000", salaryMax: "30000" }).success).toBe(false);
    expect(createGraduateSchemeSchema.safeParse({ ...base, salaryMin: "£30,000", salaryMax: "40000" }).success).toBe(true);
    expect(createGraduateSchemeSchema.safeParse({ ...base, opensOn: "not a date" }).success).toBe(false);
  });
  it("refuses a verification date in the future", () => {
    const issues: string[] = [];
    schemeRules({ verifiedAt: "2030-01-01", sourceDate: "2026-01-01", opensOn: null, deadlineOn: null, salaryMin: null, salaryMax: null }, { addIssue: (i: { message?: string }) => void issues.push(i.message ?? "") } as never, "2026-06-15");
    expect(issues.join()).toMatch(/future/);
  });
  it("rejects bad slugs and unknown enum values", () => {
    expect(createGraduateSchemeSchema.safeParse({ ...base, slug: "Bad Slug" }).success).toBe(false);
    expect(createGraduateSchemeSchema.safeParse({ ...base, studyStages: ["retired"] }).success).toBe(false);
    expect(createGraduateSchemeSchema.safeParse({ ...base, sector: "astrology" }).success).toBe(false);
  });
});

describe("csv", () => {
  const header = "employer,scheme_name,sector,salary,locations,sponsorship_status,notes,source_url,source_date,verified_at";

  it("keeps the original required header and accepts optional columns", () => {
    const parsed = parseGraduateSchemeCsv(`${header},deadline_on,rolling\nA,B,law,,,no,,https://e.com,2026-01-01,2026-01-02,2026-09-01,yes`);
    expect("rows" in parsed && parsed.rows[0].deadline_on).toBe("2026-09-01");
    expect("columns" in parsed && parsed.columns).toContain("rolling");
  });
  it("refuses a missing required column and an unknown one", () => {
    expect(parseGraduateSchemeCsv("employer,scheme_name\nA,B")).toHaveProperty("error");
    expect(parseGraduateSchemeCsv(`${header},deadlin\nA,B,law,,,no,,https://e.com,2026-01-01,2026-01-02,x`)).toHaveProperty("error");
  });
  it("resolves keys and labels for study stages and reports unknown ones", () => {
    expect(resolveStudyStages("final_year; Recent graduates")).toEqual({ values: ["final_year", "graduate"], invalid: [] });
    expect(resolveStudyStages("final_year;toddler")).toEqual({ values: ["final_year"], invalid: ["toddler"] });
  });
  it("reads yes/no cells strictly", () => {
    expect(resolveBoolean("Yes")).toBe(true);
    expect(resolveBoolean("no")).toBe(false);
    expect(resolveBoolean("")).toBeNull();
    expect(resolveBoolean("maybe")).toBe("invalid");
  });
});
