import { describe, expect, it } from "vitest";
import { ADVICE_CATEGORIES, ADVICE_CATEGORY_LABELS, ADVICE_CATEGORY_TOOLS, isAdviceCategory } from "@/lib/advice/categories";
import { categoryCounts, featuredGuides, filterByCategory, hubQuery, paginate, parseHubParams, relatedGuides, searchGuides } from "@/lib/advice/search";
import { createGuideSchema, normaliseHeadingIds, ukLocalToIso } from "@/lib/advice/schemas";
import { isLive, type AdviceGuide } from "@/lib/advice/types";
import { guides as seed } from "../../../scripts/advice-content/guides.mjs";
import type { ContentBlock } from "@/lib/content/blocks";

function guide(over: Partial<AdviceGuide> = {}): AdviceGuide {
  return {
    id: over.slug ?? "id", slug: "g", title: "Guide", summary: "Summary", category: "cv", content: [{ type: "paragraph", text: "Body." }], featuredRank: null, relatedSlugs: [],
    authorName: null, reviewedOn: null, publishedAt: "2026-06-01T09:00:00Z", createdAt: "", updatedAt: "", readingTimeMinutes: 1, ...over,
  };
}

describe("categories", () => {
  it("has the eight required categories, each with a label and a tool", () => {
    expect([...ADVICE_CATEGORIES]).toEqual(["cv", "ats", "interviews", "applications", "graduate_schemes", "visa_sponsorship", "assessments", "career_advice"]);
    for (const category of ADVICE_CATEGORIES) {
      expect(ADVICE_CATEGORY_LABELS[category]).toBeTruthy();
      expect(ADVICE_CATEGORY_TOOLS[category].href).toMatch(/^\//);
    }
    expect(isAdviceCategory("cv")).toBe(true);
    expect(isAdviceCategory("blog")).toBe(false);
  });
});

describe("searchGuides", () => {
  const list = [
    guide({ slug: "a", title: "Writing a CV", summary: "Tips", publishedAt: "2026-01-01T00:00:00Z", content: [{ type: "heading", level: 2, id: "x", text: "Keywords matter" }, { type: "paragraph", text: "Use plain words." }] }),
    guide({ slug: "b", title: "Interviews", summary: "About keywords in answers", publishedAt: "2026-03-01T00:00:00Z", category: "interviews" }),
    guide({ slug: "c", title: "Tracking", summary: "Deadlines", publishedAt: "2026-02-01T00:00:00Z", content: [{ type: "paragraph", text: "A keyword can appear only in the body." }] }),
  ];
  it("an empty query returns everything, newest first", () => {
    expect(searchGuides(list, "").map((g) => g.slug)).toEqual(["b", "c", "a"]);
  });
  it("requires every word and ranks title > heading > summary > body", () => {
    expect(searchGuides(list, "cv").map((g) => g.slug)).toEqual(["a"]);
    expect(searchGuides(list, "keyword").map((g) => g.slug)).toEqual(["a", "b", "c"]); // heading, then summary, then body
    expect(searchGuides(list, "keyword deadlines").map((g) => g.slug)).toEqual(["c"]);
    expect(searchGuides(list, "nothing here")).toEqual([]);
  });
  it("ignores case and punctuation", () => {
    expect(searchGuides(list, "  WRITING, cv!! ").map((g) => g.slug)).toEqual(["a"]);
  });
});

describe("filters, featured, counts", () => {
  const list = [guide({ slug: "a", category: "cv", featuredRank: 2 }), guide({ slug: "b", category: "ats", featuredRank: 1 }), guide({ slug: "c", category: "cv" })];
  it("filters by category", () => {
    expect(filterByCategory(list, "cv").map((g) => g.slug)).toEqual(["a", "c"]);
    expect(filterByCategory(list, null)).toHaveLength(3);
  });
  it("orders featured by rank and limits them", () => {
    expect(featuredGuides(list).map((g) => g.slug)).toEqual(["b", "a"]);
    expect(featuredGuides(list, 1).map((g) => g.slug)).toEqual(["b"]);
  });
  it("counts per category", () => {
    expect(categoryCounts(list)).toEqual({ cv: 2, ats: 1 });
  });
});

describe("relatedGuides", () => {
  const cv1 = guide({ slug: "cv1", category: "cv", relatedSlugs: ["ats1", "missing", "cv1"], publishedAt: "2026-01-01T00:00:00Z" });
  const cv2 = guide({ slug: "cv2", category: "cv", publishedAt: "2026-05-01T00:00:00Z" });
  const cv3 = guide({ slug: "cv3", category: "cv", publishedAt: "2026-04-01T00:00:00Z" });
  const ats1 = guide({ slug: "ats1", category: "ats", publishedAt: "2026-06-01T00:00:00Z" });
  const int1 = guide({ slug: "int1", category: "interviews", publishedAt: "2026-07-01T00:00:00Z" });
  const all = [cv1, cv2, cv3, ats1, int1];
  it("hand-picked first (only real, live ones, never itself), then same category, then the rest", () => {
    expect(relatedGuides(cv1, all, 5).map((g) => g.slug)).toEqual(["ats1", "cv2", "cv3", "int1"]);
  });
  it("respects the limit and never repeats a guide", () => {
    const result = relatedGuides(cv1, all, 3).map((g) => g.slug);
    expect(result).toHaveLength(3);
    expect(new Set(result).size).toBe(3);
  });
  it("a draft named as related is not shown (it isn't in the live list)", () => {
    expect(relatedGuides(cv1, [cv1, cv2], 3).map((g) => g.slug)).toEqual(["cv2"]);
  });
});

describe("params and pagination", () => {
  it("parses defensively", () => {
    expect(parseHubParams({ q: "  cv ", category: "ats", page: "2" }, isAdviceCategory)).toEqual({ q: "cv", category: "ats", page: 2 });
    expect(parseHubParams({ category: "nope", page: "-1" }, isAdviceCategory)).toEqual({ q: "", category: null, page: 1 });
    expect(parseHubParams({ q: "x".repeat(300) }, isAdviceCategory).q).toHaveLength(100);
  });
  it("round-trips through a query string", () => {
    const params = { q: "star method", category: "interviews" as const, page: 3 };
    expect(parseHubParams(Object.fromEntries(new URLSearchParams(hubQuery(params))), isAdviceCategory)).toEqual(params);
    expect(hubQuery({ q: "", category: null, page: 1 })).toBe("");
  });
  it("paginates and clamps", () => {
    const items = Array.from({ length: 25 }, (_, i) => i);
    expect(paginate(items, 3).items).toHaveLength(1);
    expect(paginate(items, 99).page).toBe(3);
    expect(paginate([], 1)).toEqual({ items: [], page: 1, totalPages: 1 });
  });
});

describe("isLive", () => {
  const now = new Date("2026-06-15T12:00:00Z");
  it("drafts and scheduled guides are not live", () => {
    expect(isLive({ publishedAt: null }, now)).toBe(false);
    expect(isLive({ publishedAt: "2026-06-16T00:00:00Z" }, now)).toBe(false);
    expect(isLive({ publishedAt: "2026-06-15T12:00:00Z" }, now)).toBe(true);
  });
});

describe("normaliseHeadingIds", () => {
  it("fills blank ids from the text and makes every id unique", () => {
    const blocks: ContentBlock[] = [
      { type: "heading", level: 2, id: "", text: "What it does" },
      { type: "paragraph", text: "x" },
      { type: "heading", level: 2, id: "", text: "What it does" },
      { type: "heading", level: 3, id: "Custom ID", text: "Other" },
    ];
    const ids = normaliseHeadingIds(blocks).filter((b) => b.type === "heading").map((b) => (b as { id: string }).id);
    expect(ids).toEqual(["what-it-does", "what-it-does-2", "custom-id"]);
  });
});

describe("ukLocalToIso", () => {
  it("reads the typed time as UK time, summer and winter", () => {
    expect(ukLocalToIso("2026-07-01T10:00")).toBe("2026-07-01T09:00:00.000Z"); // BST
    expect(ukLocalToIso("2026-12-01T10:00")).toBe("2026-12-01T10:00:00.000Z"); // GMT
  });
  it("rejects anything else", () => {
    expect(ukLocalToIso("")).toBeNull();
    expect(ukLocalToIso("tomorrow")).toBeNull();
  });
});

describe("createGuideSchema", () => {
  const base = { slug: "", title: "T", summary: "S", category: "cv", content: JSON.stringify([{ type: "paragraph", text: "Hello" }]) };
  it("accepts a minimal guide and defaults everything optional to null/empty", () => {
    const parsed = createGuideSchema.parse(base);
    expect(parsed.featuredRank).toBeNull();
    expect(parsed.relatedSlugs).toEqual([]);
    expect(parsed.publishAt).toBeNull();
    expect(parsed.reviewedOn).toBeNull();
  });
  it("rejects a bad category, empty or malformed content, and script-like slugs", () => {
    expect(createGuideSchema.safeParse({ ...base, category: "blog" }).success).toBe(false);
    expect(createGuideSchema.safeParse({ ...base, content: "[]" }).success).toBe(false);
    expect(createGuideSchema.safeParse({ ...base, content: "not json" }).success).toBe(false);
    expect(createGuideSchema.safeParse({ ...base, content: JSON.stringify([{ type: "html", text: "<b>x</b>" }]) }).success).toBe(false);
    expect(createGuideSchema.safeParse({ ...base, slug: "Bad Slug!" }).success).toBe(false);
  });
  it("validates featured order, related slugs and the review date", () => {
    expect(createGuideSchema.safeParse({ ...base, featuredRank: "0" }).success).toBe(false);
    expect(createGuideSchema.safeParse({ ...base, featuredRank: "3" }).success).toBe(true);
    expect(createGuideSchema.safeParse({ ...base, relatedSlugs: "a,b,c,d,e,f,g" }).success).toBe(false);
    expect(createGuideSchema.parse({ ...base, relatedSlugs: "a-b, c-d a-b" }).relatedSlugs).toEqual(["a-b", "c-d"]);
    expect(createGuideSchema.safeParse({ ...base, reviewedOn: "2099-01-01" }).success).toBe(false);
  });
  it("gives every heading a unique id", () => {
    const content = JSON.stringify([
      { type: "heading", level: 2, id: "", text: "Intro" },
      { type: "heading", level: 2, id: "", text: "Intro" },
    ]);
    const parsed = createGuideSchema.parse({ ...base, content });
    expect(parsed.content.map((b) => (b.type === "heading" ? b.id : ""))).toEqual(["intro", "intro-2"]);
  });
});

describe("the seeded guides", () => {
  it("cover every category, with unique slugs, valid links and usable structure", () => {
    expect(new Set(seed.map((g: { category: string }) => g.category))).toEqual(new Set(ADVICE_CATEGORIES));
    const slugs = seed.map((g: { slug: string }) => g.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    for (const g of seed as { slug: string; title: string; summary: string; related: string[]; content: ContentBlock[]; featured_rank: number | null }[]) {
      expect(g.slug).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
      expect(g.summary.length).toBeLessThanOrEqual(500);
      expect(g.title.length).toBeLessThanOrEqual(200);
      expect(g.related.length).toBeLessThanOrEqual(6);
      for (const r of g.related) expect(slugs, `${g.slug} -> ${r}`).toContain(r);
      const ids = g.content.filter((b) => b.type === "heading").map((b) => (b as { id: string }).id);
      expect(ids.length).toBeGreaterThanOrEqual(3);
      expect(new Set(ids).size).toBe(ids.length);
      for (const id of ids) expect(id).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
    }
    const ranks = (seed as { featured_rank: number | null }[]).map((g) => g.featured_rank).filter((r): r is number => r !== null);
    expect(new Set(ranks).size).toBe(ranks.length);
  });
});
