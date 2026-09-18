// 4 original, fully bespoke cover letter templates — unlike the CV
// catalog's 4-layout x 6-theme composition (src/config/cv-templates.ts),
// a cover letter has far less structural surface (a letterhead block,
// paragraphs, nothing else), so each of these 4 is a genuinely distinct,
// self-contained design rather than a layout restyled by a shared theme
// object. No sector/experience-level filtering — with only 4 options a
// picker grid needs none of the CV picker's filter UI.

export const COVER_LETTER_TEMPLATE_SLUGS = ["classic-serif", "modern-block", "minimal-clean", "bold-header"] as const;
export type CoverLetterTemplate = (typeof COVER_LETTER_TEMPLATE_SLUGS)[number];

export type CoverLetterTemplateDefinition = {
  slug: CoverLetterTemplate;
  name: string;
  description: string;
};

export const COVER_LETTER_TEMPLATES: CoverLetterTemplateDefinition[] = [
  {
    slug: "classic-serif",
    name: "Classic",
    description: "A traditional business letter — serif headings, right-aligned sender block, formal spacing.",
  },
  {
    slug: "modern-block",
    name: "Modern",
    description: "Clean sans-serif with a bold name and a single accent rule under the letterhead.",
  },
  {
    slug: "minimal-clean",
    name: "Minimal",
    description: "Understated and airy — no rules or blocks, just refined typography and generous whitespace.",
  },
  {
    slug: "bold-header",
    name: "Bold",
    description: "A solid colour header band carries your name, with the letter itself kept plain underneath.",
  },
];

const DEFAULT_TEMPLATE_SLUG: CoverLetterTemplate = "classic-serif";

/** Falls back to the default template for any unrecognised slug, never throws — same defensive stance as getCvTemplate. */
export function getCoverLetterTemplate(slug: string): CoverLetterTemplateDefinition {
  return (
    COVER_LETTER_TEMPLATES.find((template) => template.slug === slug) ??
    COVER_LETTER_TEMPLATES.find((template) => template.slug === DEFAULT_TEMPLATE_SLUG)!
  );
}
