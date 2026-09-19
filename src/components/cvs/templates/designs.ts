import type { CvTemplate } from "@/config/cv-templates";
import { getCvTemplate } from "@/config/cv-templates";
import type {
  CvColors,
  EntryDesign,
  HeaderDesign,
  HeadingDesign,
  SidebarDesign,
  SkillsStyle,
  TemplateDesign,
} from "@/components/cvs/templates/design";

// The visual definition of each of the 24 templates. Every design chooses
// its own answer to each structural question — frame (single / sidebar /
// side headings), typeface pairing, header treatment, section-heading
// style, entry layout, bullet shape, skills presentation, dividers,
// summary treatment and spacing — so no two templates are the same layout
// in a different colour. designs.test.ts fails the build if two designs
// drift within a few axes of each other.

const header = (over: Partial<HeaderDesign> & Pick<HeaderDesign, "variant">): HeaderDesign => ({
  nameSize: 30,
  nameWeight: 700,
  nameCase: "none",
  nameTracking: 0,
  nameFont: "heading",
  headlineSize: 14,
  headlineStyle: "plain",
  headlineColor: "muted",
  contact: "inline",
  contactSeparator: "  ·  ",
  rule: "none",
  gap: 22,
  ...over,
});

const heading = (over: Partial<HeadingDesign> & Pick<HeadingDesign, "style">): HeadingDesign => ({
  size: 12,
  weight: 700,
  case: "upper",
  tracking: 0.1,
  color: "ink",
  font: "heading",
  ...over,
});

const entry = (over: Partial<EntryDesign> = {}): EntryDesign => ({
  layout: "dates-right",
  dateWidth: 104,
  titleWeight: 600,
  titleFont: "body",
  metaColor: "muted",
  metaItalic: false,
  metaFont: "body",
  dateFont: "body",
  dateCase: "none",
  bullet: "disc",
  divider: "none",
  ...over,
});

const colors = (ink: string, muted: string, accent: string, accentSoft: string, rule: string): CvColors => ({
  ink,
  muted,
  accent,
  accentSoft,
  rule,
});

const sidebar = (over: Partial<SidebarDesign> & Pick<SidebarDesign, "width" | "bg" | "ink" | "muted" | "accent" | "rule" | "skills">): SidebarDesign => ({
  edge: "fill",
  padX: 22,
  sections: ["skills", "languages", "certifications"],
  heading: { style: "plain", size: 10.5, weight: 700, case: "upper", tracking: 0.14, font: "heading" },
  ...over,
});

const type = (base: number, small: number, lineHeight: number) => ({ base, small, lineHeight });
const spacing = (section: number, entrySpace: number, headingSpace: number) => ({ section, entry: entrySpace, heading: headingSpace });

const NO_SKILLS_IN_MAIN: SkillsStyle = "list";

export const CV_TEMPLATE_DESIGNS: Record<CvTemplate, TemplateDesign> = {
  // ───────────────────────────── modern ─────────────────────────────

  // Navy sidebar, indigo accent, bold Manrope headings.
  meridian: {
    frame: "sidebar-left",
    fonts: { heading: "manrope", body: "inter" },
    type: type(13, 11.5, 1.5),
    colors: colors("#1b2333", "#566073", "#4f46e5", "#eef0ff", "#dfe3ee"),
    padX: 34,
    spacing: spacing(20, 13, 9),
    header: header({
      variant: "left",
      nameSize: 34,
      nameWeight: 800,
      nameTracking: -0.02,
      headlineSize: 15,
      headlineColor: "accent",
      gap: 24,
    }),
    heading: heading({ style: "underline-short", size: 15, weight: 800, case: "title", tracking: -0.01, line: "accent" }),
    entry: entry({ titleWeight: 700, metaColor: "accent", bullet: "square" }),
    skills: NO_SKILLS_IN_MAIN,
    summary: "plain",
    labels: {},
    sidebar: sidebar({
      width: 232,
      bg: "#14213d",
      ink: "#eef2fb",
      muted: "#aebbd8",
      accent: "#9db8ff",
      rule: "#2b3b62",
      padX: 24,
      sections: ["skills", "languages", "certifications", "education"],
      skills: "grouped-stacked",
    }),
  },

  // The all-rounder: split header, accent-barred sections, outlined tags.
  northlight: {
    frame: "single",
    fonts: { heading: "inter", body: "inter" },
    type: type(13, 11.5, 1.5),
    colors: colors("#17202a", "#5b6572", "#0e7c66", "#e6f4f0", "#dde3e8"),
    padX: 44,
    spacing: spacing(22, 13, 9),
    header: header({
      variant: "split",
      nameSize: 30,
      nameTracking: -0.02,
      contact: "stacked",
      rule: "hairline",
      gap: 24,
    }),
    heading: heading({ style: "bar-left", size: 11.5, tracking: 0.12, line: "accent" }),
    entry: entry({ bullet: "disc" }),
    skills: "chips",
    summary: "plain",
    labels: {},
  },

  // Right sidebar in warm stone, orange accent, date gutter down the main column.
  atlas: {
    frame: "sidebar-right",
    fonts: { heading: "montserrat", body: "sourceSans" },
    type: type(13.5, 12, 1.5),
    colors: colors("#22262b", "#5c636b", "#c2410c", "#fbeee6", "#e6dfd6"),
    padX: 34,
    spacing: spacing(22, 14, 10),
    header: header({
      variant: "left",
      nameSize: 40,
      nameWeight: 800,
      nameTracking: -0.03,
      headlineSize: 12.5,
      headlineStyle: "caps",
      headlineColor: "accent",
      rule: "thick",
      gap: 26,
    }),
    heading: heading({ style: "plain", size: 12, tracking: 0.16, color: "accent" }),
    entry: entry({ layout: "dates-left", dateWidth: 98, titleWeight: 700, bullet: "chevron" }),
    skills: NO_SKILLS_IN_MAIN,
    summary: "plain",
    labels: {},
    sidebar: sidebar({
      width: 224,
      bg: "#f4efe8",
      ink: "#2b2b2b",
      muted: "#6a6258",
      accent: "#b03a0a",
      rule: "#e2d8ca",
      skills: "grouped-stacked",
      heading: { style: "rule", size: 10.5, weight: 700, case: "upper", tracking: 0.14, font: "heading" },
    }),
  },

  // Centred header, hairline-flanked headings, stacked entries, three-column skills.
  halo: {
    frame: "single",
    fonts: { heading: "dmSans", body: "dmSans" },
    type: type(13, 11.5, 1.5),
    colors: colors("#201a2b", "#635b73", "#7c3aed", "#f3ecfe", "#e2dcee"),
    padX: 46,
    spacing: spacing(22, 13, 10),
    header: header({
      variant: "center",
      nameSize: 34,
      nameTracking: -0.01,
      headlineSize: 11.5,
      headlineStyle: "caps",
      headlineColor: "accent",
      contactSeparator: "  |  ",
      rule: "hairline",
      gap: 22,
    }),
    heading: heading({ style: "flanked", size: 11, tracking: 0.2, color: "accent" }),
    entry: entry({ layout: "stacked", titleWeight: 700, bullet: "disc" }),
    skills: "columns",
    summary: "plain",
    labels: {},
  },

  // ───────────────────────────── classic ─────────────────────────────

  // Baskerville, small-caps name over a double rule.
  oxford: {
    frame: "single",
    fonts: { heading: "baskerville", body: "baskerville" },
    type: type(12.5, 11, 1.5),
    colors: colors("#111111", "#4a4a4a", "#7a1f2b", "#f6eeee", "#9a9a9a"),
    padX: 52,
    spacing: spacing(18, 11, 7),
    header: header({
      variant: "center",
      nameSize: 30,
      nameCase: "small-caps",
      nameTracking: 0.06,
      headlineSize: 14,
      headlineStyle: "italic",
      rule: "double",
      gap: 22,
    }),
    heading: heading({ style: "rule", size: 13, case: "small-caps", tracking: 0.06 }),
    entry: entry({ titleWeight: 700, metaItalic: true, bullet: "disc" }),
    skills: "inline",
    summary: "plain",
    labels: { summary: "Personal Profile", experience: "Employment History" },
  },

  // Garamond, date column, skills grouped by category.
  cambridge: {
    frame: "single",
    fonts: { heading: "garamond", body: "garamond" },
    type: type(14, 12.5, 1.42),
    colors: colors("#1c1c1c", "#555555", "#1f3a5f", "#eef2f7", "#c9ced6"),
    padX: 54,
    spacing: spacing(20, 12, 8),
    header: header({
      variant: "left",
      nameSize: 38,
      nameWeight: 500,
      nameTracking: 0.01,
      headlineSize: 16,
      headlineStyle: "italic",
      headlineColor: "accent",
      rule: "hairline",
      gap: 24,
    }),
    heading: heading({ style: "rule", size: 18, weight: 500, case: "title", tracking: 0, color: "accent", italic: true }),
    entry: entry({ layout: "dates-left", dateWidth: 112, titleWeight: 600, bullet: "dash" }),
    skills: "grouped",
    summary: "plain",
    labels: { summary: "Profile" },
  },

  // Framed name, section titles set in a left margin.
  whitehall: {
    frame: "gutter",
    fonts: { heading: "sourceSerif", body: "sourceSerif" },
    type: type(13, 11.5, 1.5),
    colors: colors("#1a1a1a", "#555555", "#8a1c1c", "#f6eded", "#b7b7b7"),
    padX: 46,
    spacing: spacing(20, 13, 0),
    header: header({
      variant: "framed",
      nameSize: 26,
      nameWeight: 600,
      nameCase: "upper",
      nameTracking: 0.14,
      headlineSize: 14,
      headlineStyle: "italic",
      gap: 26,
    }),
    heading: heading({ style: "plain", size: 10.5, tracking: 0.14, color: "accent" }),
    entry: entry({ layout: "stacked", titleWeight: 700, metaItalic: true, bullet: "disc" }),
    skills: "comma",
    summary: "plain",
    labels: { summary: "Profile", experience: "Career History" },
    gutter: { width: 128, gap: 22, align: "left" },
  },

  // Lora + Source Sans, forest rules, employer-first entries.
  lakeland: {
    frame: "single",
    fonts: { heading: "lora", body: "sourceSans" },
    type: type(13.5, 12, 1.5),
    colors: colors("#1d2a22", "#55625a", "#2f5d3a", "#e8f1ea", "#cfdcd2"),
    padX: 46,
    spacing: spacing(22, 14, 9),
    header: header({
      variant: "left",
      nameSize: 32,
      nameWeight: 600,
      contact: "grid",
      rule: "thick",
      gap: 24,
    }),
    heading: heading({ style: "overline", size: 12, tracking: 0.12, color: "accent", line: "accent" }),
    entry: entry({ layout: "employer-led", titleWeight: 700, metaItalic: true, metaColor: "accent", bullet: "disc" }),
    skills: "comma",
    summary: "bar",
    labels: {},
  },

  // ───────────────────────────── minimal ─────────────────────────────

  // Light type, wide margins, no rules anywhere.
  paper: {
    frame: "single",
    fonts: { heading: "inter", body: "inter" },
    type: type(12.5, 11, 1.6),
    colors: colors("#222222", "#6b6b6b", "#444444", "#f4f4f4", "#e2e2e2"),
    padX: 64,
    spacing: spacing(28, 16, 10),
    header: header({
      variant: "left",
      nameSize: 28,
      nameWeight: 300,
      nameTracking: -0.01,
      headlineSize: 13,
      contactSeparator: "   /   ",
      gap: 30,
    }),
    heading: heading({ style: "plain", size: 10, weight: 600, tracking: 0.22, color: "muted" }),
    entry: entry({ layout: "dates-left", dateWidth: 112, titleWeight: 600, bullet: "dash" }),
    skills: "inline",
    summary: "plain",
    labels: {},
  },

  // Compact neutral column with hairline-divided entries.
  quiet: {
    frame: "single",
    fonts: { heading: "dmSans", body: "dmSans" },
    type: type(12.5, 11, 1.45),
    colors: colors("#1f2328", "#656d76", "#2a2f36", "#f3f4f6", "#d8dce1"),
    padX: 42,
    spacing: spacing(16, 10, 7),
    header: header({
      variant: "left",
      nameSize: 24,
      nameTracking: -0.01,
      headlineSize: 13,
      rule: "hairline",
      gap: 16,
    }),
    heading: heading({ style: "rule", size: 12.5, case: "title", tracking: 0 }),
    entry: entry({ divider: "hairline", bullet: "square" }),
    skills: "comma",
    summary: "plain",
    labels: {},
  },

  // Slim side headings, hairline-divided entries, contact in a grid.
  index: {
    frame: "gutter",
    fonts: { heading: "sourceSans", body: "sourceSans" },
    type: type(13, 11.5, 1.5),
    colors: colors("#20242a", "#6a7079", "#20242a", "#f1f2f4", "#dcdfe3"),
    padX: 46,
    spacing: spacing(20, 12, 0),
    header: header({
      variant: "left",
      nameSize: 30,
      nameWeight: 600,
      contact: "grid",
      gap: 26,
    }),
    heading: heading({ style: "plain", size: 11, weight: 600, case: "title", tracking: 0.02, color: "muted" }),
    entry: entry({ divider: "hairline", bullet: "dash" }),
    skills: "comma",
    summary: "plain",
    labels: {},
    gutter: { width: 96, gap: 24, align: "left" },
  },

  // ──────────────────────────── executive ────────────────────────────

  // Navy masthead, serif name, gold detailing, competency grid.
  sovereign: {
    frame: "single",
    fonts: { heading: "playfair", body: "sourceSans" },
    type: type(13.5, 12, 1.5),
    colors: colors("#182033", "#56607a", "#b8862b", "#f7f1e3", "#d9d4c6"),
    padX: 48,
    spacing: spacing(22, 14, 10),
    header: header({
      variant: "band",
      nameSize: 36,
      nameTracking: 0.01,
      headlineSize: 12,
      headlineStyle: "caps",
      contactSeparator: "  |  ",
      bg: "#0f1f3d",
      ink: "#ffffff",
      subInk: "#e9d9a8",
      gap: 26,
    }),
    heading: heading({ style: "underline-short", size: 17, case: "title", tracking: 0, line: "accent" }),
    entry: entry({ titleWeight: 700, bullet: "square" }),
    skills: "columns",
    summary: "lead",
    labels: { summary: "Executive Profile", experience: "Professional Experience", skills: "Core Competencies" },
  },

  // Tinted section bars, profile panel, skills grouped by discipline.
  boardroom: {
    frame: "single",
    fonts: { heading: "sourceSerif", body: "sourceSans" },
    type: type(13.5, 12, 1.5),
    colors: colors("#16202b", "#4f5b6a", "#1e3a5f", "#e8eef5", "#cbd5e1"),
    padX: 46,
    spacing: spacing(22, 14, 9),
    header: header({
      variant: "left",
      nameSize: 34,
      headlineSize: 12,
      headlineStyle: "caps",
      headlineColor: "accent",
      contactSeparator: "  |  ",
      rule: "thick",
      gap: 24,
    }),
    heading: heading({ style: "block", size: 12, tracking: 0.12 }),
    entry: entry({ layout: "employer-led", titleWeight: 700, metaColor: "accent", bullet: "square" }),
    skills: "grouped",
    summary: "panel",
    labels: { summary: "Executive Profile", experience: "Professional Experience" },
  },

  // Stone sidebar of key facts, Garamond headings, bronze accent.
  chairman: {
    frame: "sidebar-left",
    fonts: { heading: "garamond", body: "sourceSerif" },
    type: type(13, 11.5, 1.5),
    colors: colors("#24211c", "#625d54", "#6b4f2a", "#efe9dc", "#d6cfc0"),
    padX: 32,
    spacing: spacing(22, 13, 9),
    header: header({
      variant: "split",
      nameSize: 34,
      nameWeight: 500,
      nameTracking: 0.02,
      headlineSize: 15,
      headlineStyle: "italic",
      contact: "stacked",
      rule: "hairline",
      gap: 24,
    }),
    heading: heading({ style: "rule", size: 13, weight: 600, tracking: 0.12 }),
    entry: entry({ titleWeight: 600, metaItalic: true, bullet: "dash" }),
    skills: NO_SKILLS_IN_MAIN,
    summary: "bar",
    labels: { summary: "Profile" },
    sidebar: sidebar({
      width: 214,
      bg: "#f1eee6",
      ink: "#2a261f",
      muted: "#6a645a",
      accent: "#6b4f2a",
      rule: "#d9d2c2",
      skills: "list",
      heading: { style: "rule", size: 12, weight: 600, case: "upper", tracking: 0.1, font: "heading" },
    }),
  },

  // ──────────────────────────── graduate ────────────────────────────

  // Teal sidebar, pill-labelled sections, accent-coloured name.
  campus: {
    frame: "sidebar-left",
    fonts: { heading: "workSans", body: "workSans" },
    type: type(13, 11.5, 1.5),
    colors: colors("#0f2a33", "#476069", "#0e7490", "#e0f2f5", "#cfe3e8"),
    padX: 32,
    spacing: spacing(20, 13, 9),
    header: header({
      variant: "left",
      nameSize: 32,
      nameTracking: -0.02,
      nameColor: "accent",
      headlineSize: 14,
      gap: 22,
    }),
    heading: heading({ style: "pill", size: 10.5, tracking: 0.1, line: "accent" }),
    entry: entry({ titleWeight: 600, bullet: "disc" }),
    skills: NO_SKILLS_IN_MAIN,
    summary: "plain",
    labels: { summary: "Personal Statement", experience: "Work Experience" },
    sidebar: sidebar({
      width: 218,
      bg: "#e3f3f6",
      ink: "#0d3540",
      muted: "#3f6570",
      accent: "#0b6a82",
      rule: "#bfe0e7",
      skills: "chips-fill",
    }),
  },

  // Raspberry banner, square-marked headings, skill tags.
  fresher: {
    frame: "single",
    fonts: { heading: "montserrat", body: "sourceSans" },
    type: type(13.5, 12, 1.5),
    colors: colors("#231a24", "#5f5566", "#c2255c", "#fdeaf1", "#ecdde4"),
    padX: 44,
    spacing: spacing(22, 13, 9),
    header: header({
      variant: "band",
      nameSize: 34,
      nameWeight: 800,
      nameTracking: -0.01,
      headlineSize: 15,
      bg: "#c2255c",
      ink: "#ffffff",
      subInk: "#ffe3ee",
      gap: 22,
    }),
    heading: heading({ style: "square", weight: 800, tracking: 0.08, line: "accent" }),
    entry: entry({ titleWeight: 700, metaColor: "accent", bullet: "square" }),
    skills: "chips",
    summary: "plain",
    labels: { summary: "Personal Statement", experience: "Work Experience" },
  },

  // Boxed header and a career timeline.
  springboard: {
    frame: "single",
    fonts: { heading: "dmSans", body: "dmSans" },
    type: type(13, 11.5, 1.5),
    colors: colors("#14232f", "#4f6270", "#0369a1", "#e5f2fa", "#cfe0ec"),
    padX: 44,
    spacing: spacing(20, 16, 10),
    header: header({
      variant: "boxed",
      nameSize: 30,
      nameTracking: -0.01,
      headlineColor: "accent",
      gap: 24,
    }),
    heading: heading({ style: "rule-thick", tracking: 0.1, line: "accent" }),
    entry: entry({ layout: "timeline", titleWeight: 700, dateCase: "upper", bullet: "disc" }),
    skills: "grouped",
    summary: "plain",
    labels: { summary: "Personal Statement", experience: "Work Experience" },
  },

  // ──────────────────────────── technical ────────────────────────────

  // Monospaced headings, chevron bullets, skills by stack.
  syntax: {
    frame: "single",
    fonts: { heading: "plexMono", body: "plexSans" },
    type: type(12.5, 11, 1.5),
    colors: colors("#16191d", "#59616b", "#047857", "#e5f5ee", "#d5dbe0"),
    padX: 44,
    spacing: spacing(20, 12, 9),
    header: header({
      variant: "left",
      nameSize: 28,
      nameWeight: 600,
      nameTracking: -0.02,
      headlineSize: 13,
      headlineFont: "heading",
      contactSeparator: "  |  ",
      rule: "hairline",
      gap: 22,
    }),
    heading: heading({ style: "square", size: 11, weight: 600, tracking: 0.08, line: "accent" }),
    entry: entry({ metaColor: "accent", dateFont: "heading", bullet: "chevron" }),
    skills: "grouped",
    summary: "bar",
    labels: { skills: "Technical Skills", summary: "Profile" },
  },

  // Hairline-edged right column for skills and credentials.
  kernel: {
    frame: "sidebar-right",
    fonts: { heading: "plexSans", body: "plexSans" },
    type: type(12.5, 11, 1.5),
    colors: colors("#1c2128", "#5b6470", "#0b5fa5", "#e7f0fa", "#d5dce4"),
    padX: 34,
    spacing: spacing(20, 12, 9),
    header: header({
      variant: "left",
      nameSize: 30,
      nameTracking: -0.01,
      headlineColor: "accent",
      rule: "hairline",
      gap: 22,
    }),
    heading: heading({ style: "block", size: 11.5, tracking: 0.1 }),
    entry: entry({ titleWeight: 600, dateFont: "body", bullet: "dash" }),
    skills: NO_SKILLS_IN_MAIN,
    summary: "plain",
    labels: { summary: "Profile" },
    sidebar: sidebar({
      width: 216,
      edge: "line",
      bg: "#ffffff",
      ink: "#1c2128",
      muted: "#5b6470",
      accent: "#0b5fa5",
      rule: "#d5dce4",
      sections: ["skills", "languages", "certifications", "education"],
      skills: "grouped-stacked",
      heading: { style: "rule", size: 10.5, weight: 700, case: "upper", tracking: 0.1, font: "heading" },
    }),
  },

  // Near-black masthead, monospaced name, green accent.
  terminal: {
    frame: "single",
    fonts: { heading: "plexMono", body: "plexSans" },
    type: type(12.5, 11, 1.5),
    colors: colors("#0d1117", "#4b5563", "#1a7f37", "#e6f4ea", "#d0d7de"),
    padX: 44,
    spacing: spacing(20, 13, 9),
    header: header({
      variant: "band",
      nameSize: 28,
      nameWeight: 600,
      nameTracking: -0.02,
      headlineSize: 13,
      headlineFont: "heading",
      contactSeparator: "  /  ",
      bg: "#0d1117",
      ink: "#f0f6fc",
      subInk: "#7ee787",
      gap: 22,
    }),
    heading: heading({ style: "bar-left", size: 11, weight: 600, tracking: 0.1, line: "accent" }),
    entry: entry({ layout: "dates-left", dateWidth: 108, dateFont: "heading", bullet: "dash" }),
    skills: "chips",
    summary: "plain",
    labels: {},
  },

  // Accent strip, vertical timeline, grid-set headings.
  vector: {
    frame: "single",
    fonts: { heading: "spaceGrotesk", body: "plexSans" },
    type: type(12.5, 11, 1.5),
    colors: colors("#1a1f2b", "#5a6275", "#b45309", "#fdf1e1", "#e5dccf"),
    padX: 44,
    spacing: spacing(22, 15, 10),
    header: header({
      variant: "strip",
      nameSize: 34,
      nameTracking: -0.02,
      contact: "grid",
      bg: "#b45309",
      rule: "hairline",
      gap: 22,
    }),
    heading: heading({ style: "overline", size: 11.5, tracking: 0.14, line: "accent" }),
    entry: entry({ layout: "timeline", dateCase: "upper", bullet: "square" }),
    skills: "grouped-stacked",
    summary: "plain",
    labels: {},
  },

  // ───────────────────────────── creative ─────────────────────────────

  // Oversized italic serif name, coral accents, soft tags.
  studio: {
    frame: "single",
    fonts: { heading: "playfair", body: "dmSans" },
    type: type(13, 11.5, 1.5),
    colors: colors("#1f1a1a", "#6a5f5f", "#c0392b", "#fbe9e6", "#eadcd9"),
    padX: 48,
    spacing: spacing(24, 14, 10),
    header: header({
      variant: "oversize",
      nameSize: 50,
      nameWeight: 800,
      nameTracking: -0.02,
      nameItalic: true,
      headlineSize: 12,
      headlineStyle: "caps",
      headlineColor: "accent",
      contact: "grid",
      gap: 28,
    }),
    heading: heading({ style: "plain", size: 21, weight: 600, case: "title", tracking: 0, color: "accent", italic: true }),
    entry: entry({ titleFont: "heading", metaItalic: true, bullet: "dash" }),
    skills: "chips-fill",
    summary: "lead",
    labels: {},
  },

  // Plum right column, fuchsia banner over the main column.
  canvas: {
    frame: "sidebar-right",
    fonts: { heading: "montserrat", body: "workSans" },
    type: type(13, 11.5, 1.5),
    colors: colors("#221a2b", "#61566b", "#86198f", "#f7e9f8", "#e6d7e9"),
    padX: 30,
    spacing: spacing(20, 13, 9),
    header: header({
      variant: "band",
      nameSize: 32,
      nameWeight: 800,
      headlineSize: 14,
      bg: "#86198f",
      ink: "#ffffff",
      subInk: "#f5d9f7",
      gap: 22,
    }),
    heading: heading({ style: "block", size: 11.5, tracking: 0.1 }),
    entry: entry({ titleWeight: 700, metaColor: "accent", bullet: "square" }),
    skills: NO_SKILLS_IN_MAIN,
    summary: "panel",
    labels: {},
    sidebar: sidebar({
      width: 226,
      bg: "#3b1d4a",
      ink: "#f6eefb",
      muted: "#d3bfe0",
      accent: "#f0c6ff",
      rule: "#5a3770",
      sections: ["skills", "languages", "certifications", "education"],
      skills: "chips-fill",
    }),
  },

  // Magazine masthead, italic serif titles set in a right-aligned margin.
  editorial: {
    frame: "gutter",
    fonts: { heading: "playfair", body: "sourceSerif" },
    type: type(13, 11.5, 1.55),
    colors: colors("#1c1c1c", "#666666", "#9a3412", "#f8ede6", "#d9d2ca"),
    padX: 50,
    spacing: spacing(24, 14, 0),
    header: header({
      variant: "split",
      nameSize: 44,
      nameTracking: -0.02,
      headlineSize: 16,
      headlineStyle: "italic",
      headlineFont: "heading",
      contact: "stacked",
      rule: "hairline",
      gap: 28,
    }),
    heading: heading({ style: "plain", size: 17, weight: 500, case: "title", tracking: 0, color: "accent", italic: true }),
    entry: entry({ titleFont: "heading", titleWeight: 700, metaItalic: true, bullet: "dash" }),
    skills: "comma",
    summary: "lead",
    labels: {},
    gutter: { width: 120, gap: 26, align: "right" },
  },
};

/** The design for a slug; an unrecognised slug falls back exactly as `getCvTemplate` does. */
export function getTemplateDesign(slug: string): TemplateDesign {
  return CV_TEMPLATE_DESIGNS[getCvTemplate(slug).slug];
}
