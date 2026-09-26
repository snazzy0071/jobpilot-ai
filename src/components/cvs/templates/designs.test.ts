import { describe, expect, it } from "vitest";
import { CV_TEMPLATES, CV_TEMPLATE_SLUGS } from "@/config/cv-templates";
import { CV_TEMPLATE_DESIGNS } from "@/components/cvs/templates/designs";
import { PAGE_WIDTH, type TemplateDesign } from "@/components/cvs/templates/design";

// The structural choices a reader actually sees. Colour is deliberately
// absent: two templates that differ only in colour are the failure this
// test exists to catch.
const AXES: Record<string, (d: TemplateDesign) => string> = {
  frame: (d) => d.frame,
  header: (d) => d.header.variant,
  headerContact: (d) => d.header.contact,
  headerRule: (d) => d.header.rule,
  headingStyle: (d) => d.heading.style,
  headingCase: (d) => `${d.heading.case}${d.heading.italic ? "-italic" : ""}`,
  entryLayout: (d) => d.entry.layout,
  entryDivider: (d) => d.entry.divider,
  bullet: (d) => d.entry.bullet,
  skills: (d) => (d.sidebar ? `${d.skills}/${d.sidebar.skills}` : d.skills),
  summary: (d) => d.summary,
  headingFont: (d) => d.fonts.heading,
  bodyFont: (d) => d.fonts.body,
};

function differingAxes(a: TemplateDesign, b: TemplateDesign): string[] {
  return Object.entries(AXES)
    .filter(([, read]) => read(a) !== read(b))
    .map(([name]) => name);
}

describe("CV template designs", () => {
  it("defines a design for every catalog slug and nothing else", () => {
    expect(Object.keys(CV_TEMPLATE_DESIGNS).sort()).toEqual([...CV_TEMPLATE_SLUGS].sort());
  });

  it("uses the frame the catalog advertises", () => {
    for (const template of CV_TEMPLATES) {
      expect(CV_TEMPLATE_DESIGNS[template.slug].frame, template.slug).toBe(template.layout);
    }
  });

  it("gives every sidebar frame a sidebar, and every gutter frame a gutter", () => {
    for (const template of CV_TEMPLATES) {
      const design = CV_TEMPLATE_DESIGNS[template.slug];
      if (design.frame === "sidebar-left" || design.frame === "sidebar-right") expect(design.sidebar, template.slug).toBeDefined();
      if (design.frame === "gutter") expect(design.gutter, template.slug).toBeDefined();
      if (design.frame === "single") {
        expect(design.sidebar, template.slug).toBeUndefined();
        expect(design.gutter, template.slug).toBeUndefined();
      }
    }
  });

  it("keeps every template genuinely different from every other (not a recolour)", () => {
    const slugs = CV_TEMPLATES.map((t) => t.slug);
    const tooClose: string[] = [];
    for (let i = 0; i < slugs.length; i++) {
      for (let j = i + 1; j < slugs.length; j++) {
        const differing = differingAxes(CV_TEMPLATE_DESIGNS[slugs[i]], CV_TEMPLATE_DESIGNS[slugs[j]]);
        if (differing.length < 5) tooClose.push(`${slugs[i]} ~ ${slugs[j]} (${differing.length}: ${differing.join(", ")})`);
      }
    }
    expect(tooClose).toEqual([]);
  });

  it("never repeats the same typeface pairing AND heading style", () => {
    const seen = new Map<string, string>();
    for (const template of CV_TEMPLATES) {
      const d = CV_TEMPLATE_DESIGNS[template.slug];
      const key = `${d.fonts.heading}|${d.fonts.body}|${d.heading.style}`;
      expect(seen.get(key), `${template.slug} repeats ${seen.get(key)}`).toBeUndefined();
      seen.set(key, template.slug);
    }
  });

  it("covers every header variant, heading style and entry layout the engine offers", () => {
    const designs = Object.values(CV_TEMPLATE_DESIGNS);
    const used = (read: (d: TemplateDesign) => string) => new Set(designs.map(read));
    expect(used((d) => d.header.variant).size).toBeGreaterThanOrEqual(8);
    expect(used((d) => d.heading.style).size).toBeGreaterThanOrEqual(10);
    expect(used((d) => d.entry.layout).size).toBe(5);
    expect(used((d) => d.entry.bullet).size).toBeGreaterThanOrEqual(4);
    expect(new Set(designs.map((d) => d.skills)).size).toBeGreaterThanOrEqual(6);
  });

  it("leaves room for a readable main column beside any sidebar", () => {
    for (const template of CV_TEMPLATES) {
      const d = CV_TEMPLATE_DESIGNS[template.slug];
      if (!d.sidebar) continue;
      const main = PAGE_WIDTH - d.sidebar.width - 2 * d.padX;
      expect(main, `${template.slug} main column`).toBeGreaterThanOrEqual(380);
    }
  });

  it("keeps body text at a readable size for a printed CV", () => {
    for (const template of CV_TEMPLATES) {
      const d = CV_TEMPLATE_DESIGNS[template.slug];
      // 12.5px is 9.4pt — the floor for print CVs; a serif with a small x-height needs more.
      expect(d.type.base, template.slug).toBeGreaterThanOrEqual(12.5);
      expect(d.type.small, template.slug).toBeGreaterThanOrEqual(10.5);
    }
  });
});

describe("letter-spacing stays extractable", () => {
  it("never exceeds the point where a PDF's text stops reading as whole words", async () => {
    const { MAX_TRACKING_EM, safeTracking } = await import("@/components/cvs/templates/design");
    expect(MAX_TRACKING_EM).toBe(0.06);
    expect(safeTracking(0.22)).toBe(0.06);
    expect(safeTracking(0.14)).toBe(0.06);
    expect(safeTracking(0.1)).toBe(0.06);
    expect(safeTracking(0.04)).toBe(0.04);
    expect(safeTracking(-0.01)).toBe(-0.01);
  });
});
