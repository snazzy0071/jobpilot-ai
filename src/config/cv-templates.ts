// The 24-template catalog (matching the Pro plan's real
// `cv_template_count: 24` entitlement — see migration 0016). Each template
// is its own design, not a recolour of another: its typography pairing,
// header treatment, section-heading style, entry layout, skills
// presentation, dividers, spacing and (where it has one) sidebar all
// differ. The visual definition of every slug lives in
// src/components/cvs/templates/designs.ts; this file is the single source
// of truth for which slugs exist, what each is called and described as,
// and which sector / experience-level searches should surface it.
//
// ATS-safe by construction, applied across every design in
// src/components/cvs/templates/: real text only (no images, no text baked
// into graphics, no icon-only labels), no CSS tables, no photo — there is
// no photo field in the data model at all, matching UK CV convention.
// Sidebar designs keep the DOM in a linear reading order (header, main
// column, then sidebar) and only move the sidebar into place with CSS
// grid placement, so a parser reading text order sees the same sensible
// sequence as a single-column CV. Decorative bars, squares and bullets are
// empty elements, never text characters, so they never leak into the text
// an ATS extracts.

export const CV_TEMPLATE_STYLES = ["modern", "classic", "minimal", "executive", "graduate", "technical", "creative"] as const;
export type CvTemplateStyle = (typeof CV_TEMPLATE_STYLES)[number];

export const CV_TEMPLATE_STYLE_LABELS: Record<CvTemplateStyle, string> = {
  modern: "Modern",
  classic: "Classic",
  minimal: "Minimal",
  executive: "Executive",
  graduate: "Graduate",
  technical: "Technical",
  creative: "Creative",
};

// The chooser's filter groups. A template can belong to several (Sovereign is
// Executive, Finance and Legal), unlike `style`, which is its one primary
// character and the label shown on its card.
export const CV_TEMPLATE_CATEGORIES = [
  "graduate",
  "professional",
  "executive",
  "technical",
  "finance",
  "legal",
  "consulting",
  "healthcare",
  "creative",
  "minimal",
  "classic",
  "modern",
] as const;
export type CvTemplateCategory = (typeof CV_TEMPLATE_CATEGORIES)[number];

export const CV_TEMPLATE_CATEGORY_LABELS: Record<CvTemplateCategory, string> = {
  graduate: "Graduate",
  professional: "Professional",
  executive: "Executive",
  technical: "Technical",
  finance: "Finance",
  legal: "Legal",
  consulting: "Consulting",
  healthcare: "Healthcare",
  creative: "Creative",
  minimal: "Minimal",
  classic: "Classic",
  modern: "Modern",
};

export const CV_TEMPLATE_LAYOUTS = ["single", "sidebar-left", "sidebar-right", "gutter"] as const;
export type CvTemplateLayout = (typeof CV_TEMPLATE_LAYOUTS)[number];

export const CV_TEMPLATE_LAYOUT_LABELS: Record<CvTemplateLayout, string> = {
  single: "Single column",
  "sidebar-left": "Left sidebar",
  "sidebar-right": "Right sidebar",
  gutter: "Side headings",
};

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

// The literal slug union kept as an explicit tuple (rather than derived
// from the catalog below) so `CvTemplate` stays a real 24-member union
// type: callers get compile-time exhaustiveness/typo checking, and the
// Postgres `cv_template` enum (migration 0088) mirrors this list exactly.
export const CV_TEMPLATE_SLUGS = [
  // modern
  "meridian",
  "northlight",
  "atlas",
  "halo",
  // classic
  "oxford",
  "cambridge",
  "whitehall",
  "lakeland",
  // minimal
  "paper",
  "quiet",
  "index",
  // executive
  "sovereign",
  "boardroom",
  "chairman",
  // graduate
  "campus",
  "fresher",
  "springboard",
  // technical
  "syntax",
  "kernel",
  "terminal",
  "vector",
  // creative
  "studio",
  "canvas",
  "editorial",
] as const;
export type CvTemplate = (typeof CV_TEMPLATE_SLUGS)[number];

export type CvTemplateDefinition = {
  slug: CvTemplate;
  name: string;
  style: CvTemplateStyle;
  layout: CvTemplateLayout;
  /** Every chooser group this template appears under. */
  categories: CvTemplateCategory[];
  description: string;
  /** One line telling a candidate whether this is their template. */
  recommendedFor: string;
  sectors: CvTemplateSector[];
  experienceLevels: CvTemplateExperienceLevel[];
};

export const CV_TEMPLATES: CvTemplateDefinition[] = [
  // --- modern ---
  {
    slug: "meridian",
    name: "Meridian",
    style: "modern",
    layout: "sidebar-left",
    categories: ["modern", "professional", "technical", "consulting"],
    recommendedFor: "Tech, product and consulting professionals with a strong skills list to show off.",
    description: "A deep navy sidebar holds skills and languages beside a confident, bold-headed main column.",
    sectors: ["tech-engineering", "marketing-sales", "corporate-finance"],
    experienceLevels: ["graduate-entry", "mid-career"],
  },
  {
    slug: "northlight",
    name: "Northlight",
    style: "modern",
    layout: "single",
    categories: ["modern", "professional", "finance", "consulting", "graduate", "healthcare"],
    recommendedFor: "Almost anyone. The safest all-round choice when you're not sure where to start.",
    description: "A clean split header, accent-barred sections and outlined skill tags. Our most versatile all-rounder.",
    sectors: ["general", "corporate-finance", "marketing-sales", "public-sector"],
    experienceLevels: ["graduate-entry", "mid-career", "senior-executive"],
  },
  {
    slug: "atlas",
    name: "Atlas",
    style: "modern",
    layout: "sidebar-right",
    categories: ["modern", "creative", "professional"],
    recommendedFor: "Marketing, sales and brand roles where confident design should still read cleanly.",
    description: "Big geometric headings, a date gutter down the left and a warm right-hand column for skills.",
    sectors: ["marketing-sales", "creative-design", "hospitality-retail"],
    experienceLevels: ["mid-career"],
  },
  {
    slug: "halo",
    name: "Halo",
    style: "modern",
    layout: "single",
    categories: ["modern", "healthcare", "graduate", "professional"],
    recommendedFor: "Clinical, education and service roles that want a calm, welcoming first impression.",
    description: "A centred header, sections flanked by hairlines and a tidy three-column skills grid.",
    sectors: ["general", "healthcare", "education", "hospitality-retail"],
    experienceLevels: ["graduate-entry", "mid-career"],
  },

  // --- classic ---
  {
    slug: "oxford",
    name: "Oxford",
    style: "classic",
    layout: "single",
    categories: ["classic", "legal", "finance", "professional"],
    recommendedFor: "Law, banking and public-sector applications where a formal, traditional CV is expected.",
    description: "Traditional Baskerville with a double-ruled, centred header. Formal and instantly familiar.",
    sectors: ["legal", "public-sector", "academic-research", "corporate-finance"],
    experienceLevels: ["mid-career", "senior-executive"],
  },
  {
    slug: "cambridge",
    name: "Cambridge",
    style: "classic",
    layout: "single",
    categories: ["classic", "graduate", "professional"],
    recommendedFor: "Academic, research and education CVs, and graduates applying for scholarly roles.",
    description: "Elegant Garamond with a date column and skills grouped by category. Scholarly and refined.",
    sectors: ["academic-research", "education", "legal"],
    experienceLevels: ["graduate-entry", "mid-career"],
  },
  {
    slug: "whitehall",
    name: "Whitehall",
    style: "classic",
    layout: "gutter",
    categories: ["classic", "legal", "executive", "professional"],
    recommendedFor: "Civil service, legal and senior public-sector roles that value a formal record.",
    description: "A framed name and section titles set in a left margin, like a well-kept formal record.",
    sectors: ["public-sector", "legal", "corporate-finance"],
    experienceLevels: ["mid-career", "senior-executive"],
  },
  {
    slug: "lakeland",
    name: "Lakeland",
    style: "classic",
    layout: "single",
    categories: ["classic", "healthcare", "professional"],
    recommendedFor: "NHS, care, teaching and third-sector roles where employers and dates matter most.",
    description: "A warm serif and sans pairing, forest-green rules and employer-first entries.",
    sectors: ["healthcare", "education", "public-sector"],
    experienceLevels: ["mid-career"],
  },

  // --- minimal ---
  {
    slug: "paper",
    name: "Paper",
    style: "minimal",
    layout: "single",
    categories: ["minimal", "graduate", "creative"],
    recommendedFor: "Early-career and design-minded applicants who want the content to speak quietly.",
    description: "Light type, wide margins and no rules at all. Air and restraint do the work.",
    sectors: ["general", "creative-design", "academic-research"],
    experienceLevels: ["graduate-entry", "mid-career"],
  },
  {
    slug: "quiet",
    name: "Quiet",
    style: "minimal",
    layout: "single",
    categories: ["minimal", "professional", "technical"],
    recommendedFor: "Long careers that need to fit two pages without looking crowded.",
    description: "A compact, neutral single column with hairline dividers, built to fit a lot without shouting.",
    sectors: ["general", "tech-engineering", "construction-trades"],
    experienceLevels: ["mid-career", "senior-executive"],
  },
  {
    slug: "index",
    name: "Index",
    style: "minimal",
    layout: "gutter",
    categories: ["minimal", "consulting", "professional"],
    recommendedFor: "Analysts, researchers and consultants with many short entries to scan.",
    description: "Slim side headings and hairline-divided entries, like a well-set contents page.",
    sectors: ["academic-research", "general", "public-sector"],
    experienceLevels: ["graduate-entry", "mid-career"],
  },

  // --- executive ---
  {
    slug: "sovereign",
    name: "Sovereign",
    style: "executive",
    layout: "single",
    categories: ["executive", "finance", "legal"],
    recommendedFor: "Directors, partners and C-suite candidates leading with a strong executive profile.",
    description: "A navy masthead with a serif name, gold detailing and a core-competencies grid.",
    sectors: ["corporate-finance", "legal", "public-sector"],
    experienceLevels: ["senior-executive"],
  },
  {
    slug: "boardroom",
    name: "Boardroom",
    style: "executive",
    layout: "single",
    categories: ["executive", "finance", "consulting"],
    recommendedFor: "Senior leaders in finance, consulting and healthcare management with a broad skill set.",
    description: "Tinted section bars, an executive profile panel and skills grouped by discipline.",
    sectors: ["corporate-finance", "marketing-sales", "healthcare"],
    experienceLevels: ["senior-executive"],
  },
  {
    slug: "chairman",
    name: "Chairman",
    style: "executive",
    layout: "sidebar-left",
    categories: ["executive", "legal", "classic"],
    recommendedFor: "Long, distinguished careers where key facts should sit beside the story.",
    description: "A stone-tinted sidebar of key facts and a refined Garamond header for a long career.",
    sectors: ["legal", "corporate-finance", "academic-research"],
    experienceLevels: ["senior-executive"],
  },

  // --- graduate ---
  {
    slug: "campus",
    name: "Campus",
    style: "graduate",
    layout: "sidebar-left",
    categories: ["graduate", "modern"],
    recommendedFor: "Students and recent graduates applying for a first role, with skills and languages up front.",
    description: "A fresh teal sidebar of skills and languages and pill-labelled sections for first roles.",
    sectors: ["general", "education", "marketing-sales"],
    experienceLevels: ["graduate-entry"],
  },
  {
    slug: "fresher",
    name: "Fresher",
    style: "graduate",
    layout: "single",
    categories: ["graduate", "modern"],
    recommendedFor: "Graduate schemes, retail and hospitality roles where energy counts.",
    description: "A bold raspberry banner, square-marked sections and skill tags. Energetic but tidy.",
    sectors: ["general", "hospitality-retail", "marketing-sales"],
    experienceLevels: ["graduate-entry"],
  },
  {
    slug: "springboard",
    name: "Springboard",
    style: "graduate",
    layout: "single",
    categories: ["graduate", "professional", "consulting"],
    recommendedFor: "Graduates and career-starters whose experience is best shown as a progression.",
    description: "A boxed header and a career timeline that makes early experience read as momentum.",
    sectors: ["general", "public-sector", "education"],
    experienceLevels: ["graduate-entry"],
  },

  // --- technical ---
  {
    slug: "syntax",
    name: "Syntax",
    style: "technical",
    layout: "single",
    categories: ["technical", "modern"],
    recommendedFor: "Software, data and DevOps engineers who want skills grouped by stack.",
    description: "Monospaced headings, chevron bullets and skills grouped by stack. Made for engineers.",
    sectors: ["tech-engineering"],
    experienceLevels: ["graduate-entry", "mid-career", "senior-executive"],
  },
  {
    slug: "kernel",
    name: "Kernel",
    style: "technical",
    layout: "sidebar-right",
    categories: ["technical", "professional", "healthcare"],
    recommendedFor: "Engineers, technicians and clinical specialists with certifications to show.",
    description: "A hairline-edged right column keeps technical skills and certifications in view.",
    sectors: ["tech-engineering", "construction-trades", "healthcare"],
    experienceLevels: ["mid-career"],
  },
  {
    slug: "terminal",
    name: "Terminal",
    style: "technical",
    layout: "single",
    categories: ["technical", "modern"],
    recommendedFor: "Developers and IT graduates applying to tech-led companies.",
    description: "A dark masthead with a monospaced name, green accent and skill chips. Distinctly developer.",
    sectors: ["tech-engineering"],
    experienceLevels: ["graduate-entry", "mid-career"],
  },
  {
    slug: "vector",
    name: "Vector",
    style: "technical",
    layout: "single",
    categories: ["technical", "creative", "consulting"],
    recommendedFor: "Project-led CVs, such as engineers, product and design technologists, and consultants.",
    description: "An accent strip, a vertical career timeline and grid-set headings for project-led CVs.",
    sectors: ["tech-engineering", "creative-design", "academic-research"],
    experienceLevels: ["mid-career", "senior-executive"],
  },

  // --- creative ---
  {
    slug: "studio",
    name: "Studio",
    style: "creative",
    layout: "single",
    categories: ["creative", "modern"],
    recommendedFor: "Designers, writers and marketers who want personality without losing readability.",
    description: "An oversized italic serif name, coral accents and soft skill tags for portfolio-minded roles.",
    sectors: ["creative-design", "marketing-sales"],
    experienceLevels: ["graduate-entry", "mid-career"],
  },
  {
    slug: "canvas",
    name: "Canvas",
    style: "creative",
    layout: "sidebar-right",
    categories: ["creative", "modern"],
    recommendedFor: "Marketing, events and brand roles that suit a bold, confident presence.",
    description: "A deep plum column and a bold banner give designers and marketers a confident presence.",
    sectors: ["creative-design", "marketing-sales", "hospitality-retail"],
    experienceLevels: ["mid-career"],
  },
  {
    slug: "editorial",
    name: "Editorial",
    style: "creative",
    layout: "gutter",
    categories: ["creative", "classic"],
    recommendedFor: "Editors, journalists and communications leads with a long, story-led career.",
    description: "Magazine-style: a large serif masthead, italic section titles in the margin and a generous grid.",
    sectors: ["creative-design", "marketing-sales", "academic-research"],
    experienceLevels: ["mid-career", "senior-executive"],
  },
];

const TEMPLATES_BY_SLUG = new Map(CV_TEMPLATES.map((t) => [t.slug, t]));

// The previous `<layout>-<theme>` slugs and where migration 0089 remaps each. Mirrored here so a CV row that
// still carries an old value (the migration hasn't run on that database yet, or a row was written by an old
// client) resolves to the same template everywhere — the editor preview, the template picker's "current"
// marker, the CV list, and the PDF — instead of each place falling back on its own.
const LEGACY_TEMPLATE_SLUGS: Record<string, CvTemplate> = {
  "single-ink": "oxford",
  "single-slate": "northlight",
  "single-forest": "lakeland",
  "single-navy": "cambridge",
  "single-sand": "springboard",
  "single-mono": "paper",
  "sidebar-ink": "chairman",
  "sidebar-slate": "meridian",
  "sidebar-forest": "campus",
  "sidebar-navy": "kernel",
  "sidebar-sand": "atlas",
  "sidebar-mono": "index",
  "band-ink": "sovereign",
  "band-slate": "halo",
  "band-forest": "fresher",
  "band-navy": "boardroom",
  "band-sand": "studio",
  "band-mono": "terminal",
  "compact-ink": "whitehall",
  "compact-slate": "syntax",
  "compact-forest": "quiet",
  "compact-navy": "boardroom",
  "compact-sand": "quiet",
  "compact-mono": "vector",
  classic: "oxford",
  modern: "meridian",
  minimal: "paper",
};

/** The one place a stored template value becomes a real catalog slug: current slugs pass through, legacy ones are remapped, anything else falls back to the default. */
export function normalizeCvTemplate(slug: string | null | undefined): CvTemplate {
  if (slug && TEMPLATES_BY_SLUG.has(slug as CvTemplate)) return slug as CvTemplate;
  if (slug && slug in LEGACY_TEMPLATE_SLUGS) return LEGACY_TEMPLATE_SLUGS[slug];
  return CV_TEMPLATES[1].slug;
}

/** Falls back to the first template for any slug that isn't (or isn't yet) in the catalog — never throws on an unrecognised value. */
export function getCvTemplate(slug: string): CvTemplateDefinition {
  return TEMPLATES_BY_SLUG.get(normalizeCvTemplate(slug))!;
}

// Sanity check the catalog is exactly what it claims to be — asserted
// once at module load rather than left as an implicit assumption, since
// a typo in one entry above (or CV_TEMPLATE_SLUGS drifting out of sync
// with them) would otherwise only surface as a confusing "template not
// found" somewhere else entirely.
if (CV_TEMPLATES.length !== 24) {
  throw new Error(`Expected exactly 24 CV templates, found ${CV_TEMPLATES.length}.`);
}
if (new Set(CV_TEMPLATES.map((t) => t.slug)).size !== CV_TEMPLATES.length) {
  throw new Error("Duplicate CV template slug detected.");
}
if (CV_TEMPLATES.some((t, index) => t.slug !== CV_TEMPLATE_SLUGS[index])) {
  throw new Error("CV_TEMPLATES and CV_TEMPLATE_SLUGS are out of order or out of sync.");
}
