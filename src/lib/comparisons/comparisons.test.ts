import { describe, expect, it } from "vitest";
import { createComparisonSchema, differenceSchema, faqSchema, featureSchema, pricingSchema } from "@/lib/comparisons/schemas";
import { collectSources, hostOf, publishBlockers } from "@/lib/comparisons/sources";
import type { ComparisonFeature } from "@/lib/comparisons/types";

const TODAY = new Date().toISOString().slice(0, 10);
const feature = (over: Partial<ComparisonFeature> = {}) => ({ label: "Feature", competitor: "yes", competitorNote: null, jobpilot: "yes", jobpilotNote: null, sourceUrl: "https://example.com/features", sourceDate: "2026-01-02", ...over });

describe("featureSchema — a claim about a competitor needs a source", () => {
  it("accepts a sourced claim", () => {
    expect(featureSchema.safeParse(feature()).success).toBe(true);
    expect(featureSchema.safeParse(feature({ competitor: "no" })).success).toBe(true);
    expect(featureSchema.safeParse(feature({ competitor: "partial" })).success).toBe(true);
  });
  it("rejects yes/partly/no with no source or no date", () => {
    for (const bad of [{ sourceUrl: null }, { sourceUrl: "" }, { sourceDate: null }, { sourceDate: "" }]) {
      expect(featureSchema.safeParse(feature(bad)).success, JSON.stringify(bad)).toBe(false);
    }
  });
  it("Not confirmed needs no source — and must not carry one", () => {
    expect(featureSchema.safeParse(feature({ competitor: "unknown", sourceUrl: null, sourceDate: null })).success).toBe(true);
    expect(featureSchema.safeParse(feature({ competitor: "unknown" })).success).toBe(false);
  });
  it("only http(s) links and past dates are accepted", () => {
    expect(featureSchema.safeParse(feature({ sourceUrl: "javascript:alert(1)" })).success).toBe(false);
    expect(featureSchema.safeParse(feature({ sourceUrl: "data:text/html,x" })).success).toBe(false);
    expect(featureSchema.safeParse(feature({ sourceUrl: "not a url" })).success).toBe(false);
    expect(featureSchema.safeParse(feature({ sourceDate: "2099-01-01" })).success).toBe(false);
    expect(featureSchema.safeParse(feature({ sourceDate: "01/02/2026" })).success).toBe(false);
    expect(featureSchema.safeParse(feature({ label: "" })).success).toBe(false);
  });
});

describe("pricing, difference and FAQ items", () => {
  const ev = { sourceUrl: "https://example.com/pricing", sourceDate: "2026-01-02" };
  it("pricing and differences always need evidence", () => {
    expect(pricingSchema.safeParse({ plan: "Pro", price: "Free", notes: null, ...ev }).success).toBe(true);
    expect(pricingSchema.safeParse({ plan: "Pro", price: "Free", notes: null }).success).toBe(false);
    expect(pricingSchema.safeParse({ plan: "", price: "Free", ...ev }).success).toBe(false);
    expect(differenceSchema.safeParse({ title: "T", competitor: "A", jobpilot: "B", ...ev }).success).toBe(true);
    expect(differenceSchema.safeParse({ title: "T", competitor: "A", jobpilot: "B" }).success).toBe(false);
  });
  it("an FAQ may have no source, but a half-given one is refused", () => {
    expect(faqSchema.safeParse({ question: "Q", answer: "A" }).success).toBe(true);
    expect(faqSchema.safeParse({ question: "Q", answer: "A", ...ev }).success).toBe(true);
    expect(faqSchema.safeParse({ question: "Q", answer: "A", sourceUrl: "https://example.com", sourceDate: null }).success).toBe(false);
    expect(faqSchema.safeParse({ question: "Q", answer: "A", sourceUrl: "ftp://x", sourceDate: "2026-01-01" }).success).toBe(false);
  });
});

describe("createComparisonSchema", () => {
  const base = { slug: "acme", competitorName: "Acme", updatedOn: TODAY };
  it("accepts a minimal page and defaults the lists to empty", () => {
    const parsed = createComparisonSchema.parse(base);
    expect(parsed.features).toEqual([]);
    expect(parsed.publishAt).toBeNull();
    expect(parsed.competitorWebsite).toBeNull();
  });
  it("validates slug, website, check date and the embedded JSON", () => {
    expect(createComparisonSchema.safeParse({ ...base, slug: "Bad Slug" }).success).toBe(false);
    expect(createComparisonSchema.safeParse({ ...base, competitorWebsite: "javascript:1" }).success).toBe(false);
    expect(createComparisonSchema.safeParse({ ...base, updatedOn: "2099-01-01" }).success).toBe(false);
    expect(createComparisonSchema.safeParse({ ...base, features: "{nope" }).success).toBe(false);
    const good = createComparisonSchema.safeParse({ ...base, features: JSON.stringify([feature()]) });
    expect(good.success).toBe(true);
    const unsourced = createComparisonSchema.safeParse({ ...base, features: JSON.stringify([feature({ sourceUrl: null })]) });
    expect(unsourced.success).toBe(false);
    if (!unsourced.success) expect(unsourced.error.issues[0].message).toMatch(/needs a source/);
  });
  it("caps how many items a page can hold", () => {
    const many = JSON.stringify(Array.from({ length: 41 }, (_, i) => feature({ label: `F${i}` })));
    expect(createComparisonSchema.safeParse({ ...base, features: many }).success).toBe(false);
  });
});

describe("collectSources", () => {
  const page = {
    features: [feature({ sourceUrl: "https://a.example/x", sourceDate: "2026-01-01" }), feature({ label: "U", competitor: "unknown", sourceUrl: null, sourceDate: null }), feature({ label: "B", sourceUrl: "https://b.example/y", sourceDate: "2026-02-01" }), feature({ label: "A2", sourceUrl: "https://a.example/x", sourceDate: "2026-03-01" })] as ComparisonFeature[],
    pricing: [{ plan: "P", price: "£1", notes: null, sourceUrl: "https://c.example/z", sourceDate: "2026-01-05" }],
    differences: [],
    faqs: [{ question: "Q", answer: "A", sourceUrl: null, sourceDate: null }],
  };
  it("dedupes by URL, numbers in order of first appearance and keeps the latest check date", () => {
    const { sources, numberFor } = collectSources(page);
    expect(sources.map((s) => [s.number, s.host, s.checkedOn])).toEqual([[1, "a.example", "2026-03-01"], [2, "b.example", "2026-02-01"], [3, "c.example", "2026-01-05"]]);
    expect(numberFor("https://a.example/x")).toBe(1);
    expect(numberFor("https://c.example/z")).toBe(3);
    expect(numberFor(null)).toBeNull();
    expect(numberFor("https://unknown.example")).toBeNull();
  });
  it("hostOf strips www and survives junk", () => {
    expect(hostOf("https://www.example.com/path?q=1")).toBe("example.com");
    expect(hostOf("nonsense")).toBe("nonsense");
  });
});

describe("publishBlockers", () => {
  const empty = { competitorName: "X", features: [], pricing: [], differences: [], faqs: [] };
  it("an empty page can't be published", () => {
    expect(publishBlockers(empty)[0]).toMatch(/at least one/);
  });
  it("a claim without a source blocks it; Not confirmed rows don't", () => {
    expect(publishBlockers({ ...empty, features: [feature({ sourceUrl: null }) as ComparisonFeature] })[0]).toMatch(/needs a source/);
    expect(publishBlockers({ ...empty, features: [feature({ competitor: "unknown", sourceUrl: null, sourceDate: null }) as ComparisonFeature] })).toEqual([]);
    expect(publishBlockers({ ...empty, features: [feature() as ComparisonFeature] })).toEqual([]);
  });
});
