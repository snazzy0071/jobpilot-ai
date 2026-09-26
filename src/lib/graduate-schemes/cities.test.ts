import { describe, expect, it } from "vitest";
import { cityCounts, findCity, schemesForCity } from "@/lib/graduate-schemes/cities";
import { RESERVED_SCHEME_SLUGS, uniqueSlug } from "@/lib/graduate-schemes/slug";
import type { GraduateScheme } from "@/lib/graduate-schemes/types";

const scheme = (id: string, locations: string[]) => ({ id, slug: id, locations }) as unknown as GraduateScheme;

const schemes = [scheme("a", ["London", "Manchester"]), scheme("b", ["london ", "Leeds"]), scheme("c", ["London", "London"]), scheme("d", ["Manchester"]), scheme("e", [])];

describe("cityCounts", () => {
  it("counts each scheme once per place, treating spelling variants of a place as one", () => {
    expect(cityCounts(schemes)).toEqual([
      { name: "London", slug: "london", count: 3 },
      { name: "Manchester", slug: "manchester", count: 2 },
      { name: "Leeds", slug: "leeds", count: 1 },
    ]);
  });
  it("lists nothing when no scheme names a place", () => {
    expect(cityCounts([])).toEqual([]);
    expect(cityCounts([scheme("x", ["  ", ""])])).toEqual([]);
  });
});

describe("schemesForCity / findCity", () => {
  it("returns the schemes that name the place, however it is spelled", () => {
    expect(schemesForCity(schemes, "london").map((s) => s.id)).toEqual(["a", "b", "c"]);
    expect(schemesForCity(schemes, "leeds").map((s) => s.id)).toEqual(["b"]);
    expect(schemesForCity(schemes, "nowhere")).toEqual([]);
  });
  it("finds a listed city and not an unlisted one", () => {
    expect(findCity(schemes, "manchester")?.count).toBe(2);
    expect(findCity(schemes, "nowhere")).toBeUndefined();
  });
});

describe("reserved scheme addresses", () => {
  it("never hands out an address that is a page of its own", () => {
    expect(RESERVED_SCHEME_SLUGS.has("cities")).toBe(true);
    expect(uniqueSlug("cities", new Set())).toBe("cities-2");
    expect(uniqueSlug("acme-grad", new Set())).toBe("acme-grad");
  });
});
