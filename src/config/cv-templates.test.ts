import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { CV_TEMPLATES, CV_TEMPLATE_CATEGORIES, getCvTemplate, normalizeCvTemplate } from "@/config/cv-templates";

describe("CV template chooser catalog", () => {
  it("gives every template at least one category and a recommendation", () => {
    for (const template of CV_TEMPLATES) {
      expect(template.categories.length, template.slug).toBeGreaterThan(0);
      expect(new Set(template.categories).size, `${template.slug} repeats a category`).toBe(template.categories.length);
      expect(template.recommendedFor.trim().length, template.slug).toBeGreaterThan(20);
    }
  });

  it("never leaves a chooser group empty or with a single template", () => {
    for (const category of CV_TEMPLATE_CATEGORIES) {
      const count = CV_TEMPLATES.filter((t) => t.categories.includes(category)).length;
      expect(count, category).toBeGreaterThanOrEqual(2);
    }
  });

  it("files a template under its own style", () => {
    for (const template of CV_TEMPLATES) {
      expect(template.categories, template.slug).toContain(template.style);
    }
  });
});

describe("legacy template slugs", () => {
  it("resolves current slugs to themselves and unknown values to the default", () => {
    for (const template of CV_TEMPLATES) expect(normalizeCvTemplate(template.slug)).toBe(template.slug);
    expect(normalizeCvTemplate("nonsense")).toBe("northlight");
    expect(normalizeCvTemplate(null)).toBe("northlight");
  });

  it("remaps every previous slug to the same template migration 0089 does (no drift between code and database)", () => {
    const sql = readFileSync(path.join(process.cwd(), "supabase/migrations/0089_cv_template_redesign_default_and_remap.sql"), "utf8");
    const pairs = [...sql.matchAll(/when '([a-z-]+)' then '([a-z]+)'/g)].map((match) => [match[1], match[2]] as const);
    expect(pairs.length).toBe(27); // 24 layout-theme values + the 3 retired placeholders
    for (const [legacy, expected] of pairs) {
      expect(normalizeCvTemplate(legacy), legacy).toBe(expected);
    }
  });

  it("getCvTemplate follows the same mapping, so every screen agrees on a legacy row's template", () => {
    expect(getCvTemplate("single-ink").slug).toBe("oxford");
    expect(getCvTemplate("sidebar-slate").slug).toBe("meridian");
  });
});
