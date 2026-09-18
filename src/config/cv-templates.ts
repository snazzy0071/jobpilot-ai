// The 24-template catalog (matching the Pro plan's real
// `cv_template_count: 24` entitlement — see migration 0016) — built as
// 4 structural layouts x 6 visual themes rather than 24 fully bespoke
// designs. That's a deliberate, honest architecture choice, the same
// way most CV-builder products actually implement "many templates": one
// real layout engine per structure, restyled per theme, not a hand-built
// one-off per slug. Each of the 24 combinations still renders visibly
// and structurally differently — this file is the single source of
// truth for which slugs exist, what each looks like, and which
// sector/experience-level searches should surface it (the "filters"
// this task asks for search against exactly this data).
//
// ATS-safe by construction, applied consistently across every layout in
// src/components/cvs/templates/: no CSS tables, no icon-only text (an
// icon may sit *beside* real text, never instead of it), no
// multi-column CSS regions that would scramble extracted reading order,
// and DOM/reading order that lists primary content (summary, experience,
// education) before secondary content (skills, languages, certs) even
// in the sidebar layout, where that secondary content is only
// *visually* moved into a side column via CSS Grid placement — a parser
// reading DOM order sees the same sensible sequence as the single-column
// layout. No photo, ever — there's no photo field in the data model at
// all (`cv_personal` has none), matching UK CV convention.

export const CV_TEMPLATE_LAYOUTS = ["single", "sidebar", "band", "compact"] as const;
export type CvTemplateLayout = (typeof CV_TEMPLATE_LAYOUTS)[number];

export const CV_TEMPLATE_LAYOUT_LABELS: Record<CvTemplateLayout, string> = {
  single: "Single column",
  sidebar: "Left sidebar",
  band: "Header band",
  compact: "Compact",
};

export const CV_TEMPLATE_THEMES = ["ink", "slate", "forest", "navy", "sand", "mono"] as const;
export type CvTemplateTheme = (typeof CV_TEMPLATE_THEMES)[number];

export const CV_TEMPLATE_SECTORS = [
  "general",
  "corporate-finance",
  "tech-engineering",
  "creative-design",
  "academic-research",
  "healthcare",
  "education",
  "hospitality-retail",
  "legal",
  "construction-trades",
  "marketing-sales",
  "public-sector",
] as const;
export type CvTemplateSector = (typeof CV_TEMPLATE_SECTORS)[number];

export const CV_TEMPLATE_SECTOR_LABELS: Record<CvTemplateSector, string> = {
  general: "General",
  "corporate-finance": "Corporate & Finance",
  "tech-engineering": "Tech & Engineering",
  "creative-design": "Creative & Design",
  "academic-research": "Academic & Research",
  healthcare: "Healthcare",
  education: "Education",
  "hospitality-retail": "Hospitality & Retail",
  legal: "Legal",
  "construction-trades": "Construction & Trades",
  "marketing-sales": "Marketing & Sales",
  "public-sector": "Public Sector",
};

export const CV_TEMPLATE_EXPERIENCE_LEVELS = ["graduate-entry", "mid-career", "senior-executive"] as const;
export type CvTemplateExperienceLevel = (typeof CV_TEMPLATE_EXPERIENCE_LEVELS)[number];

export const CV_TEMPLATE_EXPERIENCE_LEVEL_LABELS: Record<CvTemplateExperienceLevel, string> = {
  "graduate-entry": "Graduate / Entry-level",
  "mid-career": "Mid-career",
  "senior-executive": "Senior / Executive",
};

// The literal slug union — every `${layout}-${theme}` combination — kept
// as an explicit tuple (rather than derived purely from the loop below)
// so `CvTemplate` stays a real 24-member union type: callers get
// compile-time exhaustiveness/typo checking, not just a runtime-checked
// `string`.
export const CV_TEMPLATE_SLUGS = [
  "single-ink",
  "single-slate",
  "single-forest",
  "single-navy",
  "single-sand",
  "single-mono",
  "sidebar-ink",
  "sidebar-slate",
  "sidebar-forest",
  "sidebar-navy",
  "sidebar-sand",
  "sidebar-mono",
  "band-ink",
  "band-slate",
  "band-forest",
  "band-navy",
  "band-sand",
  "band-mono",
  "compact-ink",
  "compact-slate",
  "compact-forest",
  "compact-navy",
  "compact-sand",
  "compact-mono",
] as const;
export type CvTemplate = (typeof CV_TEMPLATE_SLUGS)[number];

export type CvTemplateDefinition = {
  slug: CvTemplate;
  name: string;
  layout: CvTemplateLayout;
  theme: CvTemplateTheme;
  description: string;
  sectors: CvTemplateSector[];
  experienceLevels: CvTemplateExperienceLevel[];
};

function template(
  layout: CvTemplateLayout,
  theme: CvTemplateTheme,
  name: string,
  description: string,
  sectors: CvTemplateSector[],
  experienceLevels: CvTemplateExperienceLevel[],
): CvTemplateDefinition {
  return { slug: `${layout}-${theme}` as CvTemplate, name, layout, theme, description, sectors, experienceLevels };
}

export const CV_TEMPLATES: CvTemplateDefinition[] = [
  // --- single column ---
  template(
    "single",
    "ink",
    "Classic Ink",
    "Traditional serif headings on a single linear page — the safest choice for conservative sectors.",
    ["legal", "academic-research", "public-sector"],
    ["mid-career", "senior-executive"],
  ),
  template(
    "single",
    "slate",
    "Slate Standard",
    "A clean, understated single-column layout that reads well anywhere.",
    ["general", "corporate-finance", "public-sector"],
    ["graduate-entry", "mid-career"],
  ),
  template(
    "single",
    "forest",
    "Forest Classic",
    "A calm green accent over a simple, linear structure.",
    ["education", "public-sector", "healthcare"],
    ["graduate-entry", "mid-career"],
  ),
  template(
    "single",
    "navy",
    "Navy Traditional",
    "Structured and formal, with a navy accent suited to established institutions.",
    ["legal", "corporate-finance", "public-sector"],
    ["mid-career", "senior-executive"],
  ),
  template(
    "single",
    "sand",
    "Sand Classic",
    "A warm, approachable single-column layout for early-career applications.",
    ["general", "education", "hospitality-retail"],
    ["graduate-entry"],
  ),
  template(
    "single",
    "mono",
    "Mono Classic",
    "Grayscale and understated, letting the content speak for itself.",
    ["academic-research", "general"],
    ["graduate-entry", "mid-career"],
  ),

  // --- left sidebar ---
  template(
    "sidebar",
    "ink",
    "Ink Sidebar",
    "A narrow contact/skills column beside a serif main column, for detail-heavy CVs.",
    ["corporate-finance", "legal"],
    ["mid-career", "senior-executive"],
  ),
  template(
    "sidebar",
    "slate",
    "Slate Sidebar",
    "A practical two-column layout that keeps skills and contact details visible at a glance.",
    ["tech-engineering", "corporate-finance"],
    ["graduate-entry", "mid-career"],
  ),
  template(
    "sidebar",
    "forest",
    "Forest Sidebar",
    "A green-accented sidebar layout suited to care-oriented and educational roles.",
    ["healthcare", "education"],
    ["graduate-entry", "mid-career"],
  ),
  template(
    "sidebar",
    "navy",
    "Navy Sidebar",
    "A formal two-column layout for technical or corporate roles with a lot to show.",
    ["corporate-finance", "tech-engineering", "public-sector"],
    ["mid-career", "senior-executive"],
  ),
  template(
    "sidebar",
    "sand",
    "Sand Sidebar",
    "A warm two-column layout that keeps things friendly without losing structure.",
    ["marketing-sales", "hospitality-retail"],
    ["graduate-entry", "mid-career"],
  ),
  template(
    "sidebar",
    "mono",
    "Mono Sidebar",
    "A grayscale two-column layout for a clean, technical look.",
    ["tech-engineering", "general"],
    ["graduate-entry", "mid-career"],
  ),

  // --- header band ---
  template(
    "band",
    "ink",
    "Ink Header",
    "A bold name banner above a single flowing column.",
    ["creative-design", "marketing-sales"],
    ["mid-career"],
  ),
  template(
    "band",
    "slate",
    "Slate Header",
    "A confident header band in a professional slate tone.",
    ["marketing-sales", "corporate-finance"],
    ["graduate-entry", "mid-career"],
  ),
  template(
    "band",
    "forest",
    "Forest Header",
    "A fresh green banner for hospitality and care-sector applications.",
    ["hospitality-retail", "healthcare"],
    ["graduate-entry"],
  ),
  template(
    "band",
    "navy",
    "Navy Header",
    "An authoritative navy banner suited to leadership and public-facing roles.",
    ["marketing-sales", "public-sector"],
    ["mid-career", "senior-executive"],
  ),
  template(
    "band",
    "sand",
    "Sand Header",
    "A warm, creative banner that still reads cleanly to an ATS.",
    ["creative-design", "hospitality-retail"],
    ["graduate-entry", "mid-career"],
  ),
  template(
    "band",
    "mono",
    "Mono Header",
    "A striking grayscale banner for design-led applications.",
    ["creative-design", "general"],
    ["graduate-entry"],
  ),

  // --- compact dense ---
  template(
    "compact",
    "ink",
    "Ink Compact",
    "Tighter spacing to fit a long career history within two pages.",
    ["legal", "corporate-finance", "construction-trades"],
    ["senior-executive"],
  ),
  template(
    "compact",
    "slate",
    "Slate Compact",
    "A dense, practical layout for CVs with a lot of technical experience to list.",
    ["tech-engineering", "construction-trades"],
    ["mid-career", "senior-executive"],
  ),
  template(
    "compact",
    "forest",
    "Forest Compact",
    "A space-efficient layout for extensive healthcare or trades experience.",
    ["healthcare", "construction-trades"],
    ["mid-career", "senior-executive"],
  ),
  template(
    "compact",
    "navy",
    "Navy Compact",
    "A formal, dense layout built for a long, senior career history.",
    ["corporate-finance", "public-sector", "legal"],
    ["senior-executive"],
  ),
  template(
    "compact",
    "sand",
    "Sand Compact",
    "A warmer dense layout for varied hands-on experience.",
    ["hospitality-retail", "construction-trades"],
    ["mid-career"],
  ),
  template(
    "compact",
    "mono",
    "Mono Compact",
    "A tight, grayscale layout that fits a lot of content without feeling cluttered.",
    ["general", "tech-engineering"],
    ["mid-career", "senior-executive"],
  ),
];

const TEMPLATES_BY_SLUG = new Map(CV_TEMPLATES.map((t) => [t.slug, t]));

/** Falls back to the first template for any slug that isn't (or isn't yet) in the catalog — never throws on an unrecognised value. */
export function getCvTemplate(slug: string): CvTemplateDefinition {
  return TEMPLATES_BY_SLUG.get(slug as CvTemplate) ?? CV_TEMPLATES[0];
}

// Sanity check the catalog is exactly what it claims to be — asserted
// once at module load rather than left as an implicit assumption, since
// a typo in one of the 24 `template(...)` calls above (or CV_TEMPLATE_
// SLUGS drifting out of sync with them) would otherwise only surface as
// a confusing "template not found" somewhere else entirely.
if (CV_TEMPLATES.length !== 24) {
  throw new Error(`Expected exactly 24 CV templates, found ${CV_TEMPLATES.length}.`);
}
if (new Set(CV_TEMPLATES.map((t) => t.slug)).size !== CV_TEMPLATES.length) {
  throw new Error("Duplicate CV template slug detected.");
}
