import type { SectionKey } from "@/lib/cvs/types";

// One source of truth for page geometry. The on-screen paginator
// (a4-page.tsx) and the print stylesheet (print route) both read these, so
// a line that wraps on screen wraps in the PDF and a page breaks at the
// same place.
export const PAGE_WIDTH = 794; // 210mm at 96 CSS px/inch
export const PAGE_HEIGHT = 1123; // 297mm at 96 CSS px/inch
/** Breathing space above and below content on every page (cloned onto continuation pages in print). */
export const PAGE_PAD_Y = 44;
export const MAX_PAGES = 2;

export const CV_FONT_IDS = [
  "inter",
  "sourceSans",
  "montserrat",
  "dmSans",
  "plexSans",
  "spaceGrotesk",
  "manrope",
  "workSans",
  "sourceSerif",
  "lora",
  "playfair",
  "baskerville",
  "garamond",
  "plexMono",
] as const;
export type CvFontId = (typeof CV_FONT_IDS)[number];

export type CvColors = {
  ink: string;
  muted: string;
  accent: string;
  accentSoft: string;
  rule: string;
};

export type FontRole = "heading" | "body";
export type ColorRole = "ink" | "muted" | "accent";

// ---- header ---------------------------------------------------------------

export type HeaderVariant =
  | "left" // name, headline, contact stacked under each other
  | "center" // everything centred
  | "split" // name/headline left, contact block right
  | "band" // full-bleed solid colour band
  | "boxed" // name and contact inside a bordered box
  | "framed" // centred name between a heavy and a hairline rule
  | "oversize" // very large name with a contact grid underneath
  | "strip"; // full-bleed accent strip above a left header

export type HeaderDesign = {
  variant: HeaderVariant;
  nameSize: number;
  nameWeight: number;
  nameCase: "none" | "upper" | "small-caps";
  nameTracking: number;
  nameFont: FontRole;
  nameItalic?: boolean;
  nameColor?: ColorRole;
  headlineSize: number;
  headlineStyle: "plain" | "caps" | "italic";
  headlineColor: ColorRole;
  headlineFont?: FontRole;
  contact: "inline" | "stacked" | "grid";
  contactSeparator: string;
  /** Rule under the header block (ignored by band/boxed/framed, which draw their own edges). */
  rule: "none" | "hairline" | "thick" | "double";
  /** Band/strip only. */
  bg?: string;
  ink?: string;
  subInk?: string;
  /** Space below the header block. */
  gap: number;
};

// ---- section headings ------------------------------------------------------

export type HeadingStyle =
  | "rule" // caps text, rule underneath
  | "rule-thick" // heavier rule underneath
  | "plain" // text only
  | "underline-short" // short accent bar under the text
  | "bar-left" // vertical accent bar beside the text
  | "pill" // filled label
  | "block" // full-width tinted block
  | "flanked" // centred text between two hairlines
  | "overline" // heavy rule above the text
  | "square"; // small accent square before the text

export type HeadingDesign = {
  style: HeadingStyle;
  size: number;
  weight: number;
  case: "upper" | "title" | "small-caps";
  tracking: number;
  color: ColorRole;
  font: FontRole;
  italic?: boolean;
  /** Colour of the rule / bar / square, where the style draws one. */
  line?: ColorRole;
};

// ---- entries ---------------------------------------------------------------

export type EntryLayout =
  | "dates-right" // title left, dates right, employer beneath
  | "dates-left" // date gutter beside title + bullets
  | "stacked" // title / employer / dates on separate lines
  | "employer-led" // employer first, role beneath
  | "timeline"; // vertical rail with a marker, dates above the title

export type BulletStyle = "disc" | "dash" | "square" | "chevron" | "none";

export type EntryDesign = {
  layout: EntryLayout;
  dateWidth: number;
  titleWeight: number;
  titleFont: FontRole;
  metaColor: ColorRole;
  metaItalic: boolean;
  metaFont: FontRole;
  dateFont: FontRole;
  dateCase: "none" | "upper";
  bullet: BulletStyle;
  divider: "none" | "hairline";
};

// ---- skills ----------------------------------------------------------------

export type SkillsStyle =
  | "inline" // names separated by a mid-dot
  | "comma"
  | "chips" // outlined text chips
  | "chips-fill" // tinted text chips
  | "columns" // three-column grid
  | "list" // one per line
  | "grouped" // category label column + names
  | "grouped-stacked"; // category label above names

// ---- frames ------------------------------------------------------------------

export type FrameKind = "single" | "sidebar-left" | "sidebar-right" | "gutter";

export type SidebarDesign = {
  width: number;
  /** "fill" paints the column, "line" draws a hairline at its edge. */
  edge: "fill" | "line";
  bg: string;
  ink: string;
  muted: string;
  accent: string;
  rule: string;
  padX: number;
  sections: SectionKey[];
  skills: SkillsStyle;
  heading: Pick<HeadingDesign, "style" | "size" | "weight" | "case" | "tracking" | "font">;
};

export type GutterDesign = {
  width: number;
  gap: number;
  align: "left" | "right";
};

export type SummaryStyle = "plain" | "panel" | "lead" | "bar";

export type SectionLabels = Partial<Record<"summary" | "experience" | "education" | "skills" | "projects" | "certifications" | "languages", string>>;

export type TemplateDesign = {
  frame: FrameKind;
  fonts: { heading: CvFontId; body: CvFontId };
  type: { base: number; small: number; lineHeight: number };
  colors: CvColors;
  padX: number;
  spacing: { section: number; entry: number; heading: number };
  header: HeaderDesign;
  heading: HeadingDesign;
  entry: EntryDesign;
  skills: SkillsStyle;
  summary: SummaryStyle;
  labels: SectionLabels;
  sidebar?: SidebarDesign;
  gutter?: GutterDesign;
};

export const CV_FONT_LABELS: Record<CvFontId, string> = {
  inter: "Inter",
  sourceSans: "Source Sans",
  montserrat: "Montserrat",
  dmSans: "DM Sans",
  plexSans: "IBM Plex Sans",
  spaceGrotesk: "Space Grotesk",
  manrope: "Manrope",
  workSans: "Work Sans",
  sourceSerif: "Source Serif",
  lora: "Lora",
  playfair: "Playfair Display",
  baskerville: "Baskerville",
  garamond: "Garamond",
  plexMono: "IBM Plex Mono",
};
