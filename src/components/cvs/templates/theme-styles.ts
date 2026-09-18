import type { CvTemplateTheme } from "@/config/cv-templates";

export type ThemeStyle = {
  /** Tailwind font-family utility for headings — the only structural typography difference between themes. */
  headingFont: string;
  headingText: string;
  accentText: string;
  /** Dark enough for white text on top (used by the header-band layout). */
  accentBg: string;
  accentBgSoft: string;
  ruleColor: string;
  bodyText: string;
};

export const THEME_STYLES: Record<CvTemplateTheme, ThemeStyle> = {
  ink: {
    headingFont: "font-serif",
    headingText: "text-neutral-900",
    accentText: "text-neutral-600",
    accentBg: "bg-neutral-900",
    accentBgSoft: "bg-neutral-100",
    ruleColor: "border-neutral-300",
    bodyText: "text-neutral-800",
  },
  slate: {
    headingFont: "font-sans",
    headingText: "text-slate-900",
    accentText: "text-slate-600",
    accentBg: "bg-slate-700",
    accentBgSoft: "bg-slate-50",
    ruleColor: "border-slate-200",
    bodyText: "text-slate-800",
  },
  forest: {
    headingFont: "font-sans",
    headingText: "text-emerald-950",
    accentText: "text-emerald-700",
    accentBg: "bg-emerald-800",
    accentBgSoft: "bg-emerald-50",
    ruleColor: "border-emerald-200",
    bodyText: "text-emerald-950",
  },
  navy: {
    headingFont: "font-sans",
    headingText: "text-blue-950",
    accentText: "text-blue-800",
    accentBg: "bg-blue-950",
    accentBgSoft: "bg-blue-50",
    ruleColor: "border-blue-200",
    bodyText: "text-blue-950",
  },
  sand: {
    headingFont: "font-sans",
    headingText: "text-amber-950",
    accentText: "text-amber-700",
    accentBg: "bg-amber-700",
    accentBgSoft: "bg-amber-50",
    ruleColor: "border-amber-200",
    bodyText: "text-amber-950",
  },
  mono: {
    headingFont: "font-sans",
    headingText: "text-neutral-900",
    accentText: "text-neutral-500",
    accentBg: "bg-neutral-700",
    accentBgSoft: "bg-neutral-100",
    ruleColor: "border-neutral-300",
    bodyText: "text-neutral-700",
  },
};
