import { describe, expect, it } from "vitest";
import { buildDeadlines, deadlineLabel } from "@/lib/dashboard/deadlines";

const today = "2026-09-26";
const app = (id: string, deadline: string | null, status = "wishlist") => ({ id, jobTitle: `Role ${id}`, companyName: "Co", deadline, status });
const scheme = (slug: string, deadlineOn: string | null) => ({ slug, employer: "Emp", schemeName: slug, deadlineOn });

describe("buildDeadlines", () => {
  it("lists upcoming deadlines from both sources, soonest first, with whole days left", () => {
    const items = buildDeadlines({ applications: [app("a", "2026-10-10")], schemes: [scheme("s", "2026-09-28")], today });
    expect(items.map((i) => [i.kind, i.daysLeft])).toEqual([["scheme", 2], ["application", 14]]);
    expect(items[0].href).toBe("/graduate-schemes/s");
  });
  it("includes today, drops the past and anything beyond the horizon", () => {
    const items = buildDeadlines({ applications: [app("today", today), app("past", "2026-09-25"), app("far", "2026-12-01")], schemes: [], today });
    expect(items.map((i) => i.id)).toEqual(["app-today"]);
  });
  it("ignores tracker entries already applied for, and anything without a date", () => {
    const items = buildDeadlines({ applications: [app("done", "2026-09-30", "applied"), app("none", null)], schemes: [scheme("nodate", null)], today });
    expect(items).toEqual([]);
  });
  it("caps the list and works across a month boundary", () => {
    const many = Array.from({ length: 8 }, (_, i) => scheme(`s${i}`, "2026-10-05"));
    expect(buildDeadlines({ applications: [], schemes: many, today, limit: 3 })).toHaveLength(3);
    expect(buildDeadlines({ applications: [], schemes: [scheme("x", "2026-10-01")], today })[0].daysLeft).toBe(5);
  });
});

describe("deadlineLabel", () => {
  it("reads naturally", () => {
    expect([0, 1, 9].map(deadlineLabel)).toEqual(["Today", "Tomorrow", "In 9 days"]);
  });
});
