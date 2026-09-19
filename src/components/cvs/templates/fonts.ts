import {
  Inter,
  Source_Sans_3,
  Montserrat,
  DM_Sans,
  IBM_Plex_Sans,
  Space_Grotesk,
  Manrope,
  Work_Sans,
  Source_Serif_4,
  Lora,
  Playfair_Display,
  Libre_Baskerville,
  EB_Garamond,
  IBM_Plex_Mono,
} from "next/font/google";
import type { CvFontId } from "@/components/cvs/templates/design";

// The CV typefaces. Self-hosted by next/font (no runtime call to Google),
// which is what lets the print route embed the *same* faces in the PDF the
// preview shows — Chromium subsets them into the PDF as real, selectable,
// extractable text. `preload: false` on every one: a CV only uses two of
// these, so eagerly preloading all 14 on every editor page load would
// waste bandwidth; the browser fetches just the faces a template uses.
// next/font requires each call's options to be written as literals.
const inter = Inter({ subsets: ["latin"], variable: "--cv-font-inter", preload: false, display: "swap" });
const sourceSans = Source_Sans_3({ subsets: ["latin"], variable: "--cv-font-source-sans", preload: false, display: "swap" });
const montserrat = Montserrat({ subsets: ["latin"], variable: "--cv-font-montserrat", preload: false, display: "swap" });
const dmSans = DM_Sans({ subsets: ["latin"], variable: "--cv-font-dm-sans", preload: false, display: "swap" });
const plexSans = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--cv-font-plex-sans",
  preload: false,
  display: "swap",
});
const spaceGrotesk = Space_Grotesk({ subsets: ["latin"], variable: "--cv-font-space-grotesk", preload: false, display: "swap" });
const manrope = Manrope({ subsets: ["latin"], variable: "--cv-font-manrope", preload: false, display: "swap" });
const workSans = Work_Sans({ subsets: ["latin"], variable: "--cv-font-work-sans", preload: false, display: "swap" });
const sourceSerif = Source_Serif_4({
  subsets: ["latin"],
  style: ["normal", "italic"],
  variable: "--cv-font-source-serif",
  preload: false,
  display: "swap",
});
const lora = Lora({ subsets: ["latin"], style: ["normal", "italic"], variable: "--cv-font-lora", preload: false, display: "swap" });
const playfair = Playfair_Display({
  subsets: ["latin"],
  style: ["normal", "italic"],
  variable: "--cv-font-playfair",
  preload: false,
  display: "swap",
});
const baskerville = Libre_Baskerville({
  subsets: ["latin"],
  style: ["normal", "italic"],
  variable: "--cv-font-baskerville",
  preload: false,
  display: "swap",
});
const garamond = EB_Garamond({
  subsets: ["latin"],
  style: ["normal", "italic"],
  variable: "--cv-font-garamond",
  preload: false,
  display: "swap",
});
const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--cv-font-plex-mono",
  preload: false,
  display: "swap",
});

/** Put on the element that wraps a CV so every `var(--cv-font-*)` below resolves inside it. */
export const CV_FONT_CLASS_NAMES = [
  inter,
  sourceSans,
  montserrat,
  dmSans,
  plexSans,
  spaceGrotesk,
  manrope,
  workSans,
  sourceSerif,
  lora,
  playfair,
  baskerville,
  garamond,
  plexMono,
]
  .map((font) => font.variable)
  .join(" ");

const SANS_FALLBACK = "Arial, Helvetica, sans-serif";
const SERIF_FALLBACK = 'Georgia, "Times New Roman", Times, serif';
const MONO_FALLBACK = '"Courier New", Courier, monospace';

export const CV_FONT_STACKS: Record<CvFontId, string> = {
  inter: `var(--cv-font-inter), ${SANS_FALLBACK}`,
  sourceSans: `var(--cv-font-source-sans), ${SANS_FALLBACK}`,
  montserrat: `var(--cv-font-montserrat), ${SANS_FALLBACK}`,
  dmSans: `var(--cv-font-dm-sans), ${SANS_FALLBACK}`,
  plexSans: `var(--cv-font-plex-sans), ${SANS_FALLBACK}`,
  spaceGrotesk: `var(--cv-font-space-grotesk), ${SANS_FALLBACK}`,
  manrope: `var(--cv-font-manrope), ${SANS_FALLBACK}`,
  workSans: `var(--cv-font-work-sans), ${SANS_FALLBACK}`,
  sourceSerif: `var(--cv-font-source-serif), ${SERIF_FALLBACK}`,
  lora: `var(--cv-font-lora), ${SERIF_FALLBACK}`,
  playfair: `var(--cv-font-playfair), ${SERIF_FALLBACK}`,
  baskerville: `var(--cv-font-baskerville), ${SERIF_FALLBACK}`,
  garamond: `var(--cv-font-garamond), ${SERIF_FALLBACK}`,
  plexMono: `var(--cv-font-plex-mono), ${MONO_FALLBACK}`,
};
