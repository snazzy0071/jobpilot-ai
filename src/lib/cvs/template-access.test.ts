import { describe, expect, it } from "vitest";
import { CV_TEMPLATE_SLUGS } from "@/config/cv-templates";
import { isTemplateAllowed, TEMPLATE_ACCESS_ORDER } from "@/lib/cvs/template-access";

describe("template access", () => {
  it("orders every template exactly once", () => {
    expect([...TEMPLATE_ACCESS_ORDER].sort()).toEqual([...CV_TEMPLATE_SLUGS].sort());
  });
  it("a plan with 3 gets the curated three (including the creation default), never a fourth", () => {
    const allowed = CV_TEMPLATE_SLUGS.filter((slug) => isTemplateAllowed(slug, 3));
    expect(allowed.sort()).toEqual(["campus", "northlight", "oxford"]);
  });
  it("null means all 24, and a bad limit fails closed", () => {
    expect(CV_TEMPLATE_SLUGS.every((slug) => isTemplateAllowed(slug, null))).toBe(true);
    expect(CV_TEMPLATE_SLUGS.filter((slug) => isTemplateAllowed(slug, 24))).toHaveLength(24);
    for (const bad of [undefined, Number.NaN, -5, 0]) expect(CV_TEMPLATE_SLUGS.some((slug) => isTemplateAllowed(slug, bad as number))).toBe(false);
    expect(isTemplateAllowed("not-a-template", 24)).toBe(false);
  });
});
