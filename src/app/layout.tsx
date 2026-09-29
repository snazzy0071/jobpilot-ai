import type { Metadata } from "next";
import localFont from "next/font/local";
import { DM_Sans, JetBrains_Mono } from "next/font/google";
import { siteConfig } from "@/config/site";
import { CookieConsentBanner } from "@/components/consent/cookie-consent-banner";
import { MotionProvider } from "@/components/motion/motion-provider";
import "./globals.css";

// Body/UI typeface (genesis-DESIGN.md: "Body Font: DM Sans"). Regular and medium weights only —
// the design doesn't call for anything bolder in body text, and every weight bundled costs real
// bytes on every page.
const dmSans = DM_Sans({
  variable: "--font-sans",
  subsets: ["latin"],
  weight: ["400", "500"],
});

// Code/CLI typeface (genesis-DESIGN.md: "Code Font: JetBrains Mono"). preload: false — it only
// renders on a handful of niche admin/settings screens (audit log, access codes, ATS text
// preview, delete-account confirmation), so every other page shouldn't pay to preload it.
const jetbrainsMono = JetBrains_Mono({
  variable: "--font-mono-face",
  subsets: ["latin"],
  preload: false,
});

// Display/heading typeface (genesis-DESIGN.md: "Display Font: General Sans — loaded from
// Fontshare"). Self-hosted via next/font/local (the 4 static weight files in src/fonts, fetched
// directly from Fontshare's own CDN) rather than a runtime <link> to fontshare.com: this app's CSP
// is deliberately `script-src 'self'` with no external hosts, and next/font/local gets the same
// zero-external-request, zero-layout-shift treatment next/font/google already gives DM Sans/
// JetBrains Mono above, for a font family Next can't fetch from Google itself. Bold weight (700)
// covers the design's display/headline sizes; 400/500/600 cover everywhere else font-heading is
// already used (Card/Dialog/AlertDialog/Sheet titles, nav, etc.) at a lighter weight than 700.
const generalSans = localFont({
  variable: "--font-heading",
  display: "swap",
  src: [
    { path: "../fonts/GeneralSans-400.woff2", weight: "400", style: "normal" },
    { path: "../fonts/GeneralSans-500.woff2", weight: "500", style: "normal" },
    { path: "../fonts/GeneralSans-600.woff2", weight: "600", style: "normal" },
    { path: "../fonts/GeneralSans-700.woff2", weight: "700", style: "normal" },
  ],
});

const DEFAULT_DESCRIPTION = "The UK career toolkit for international students and graduates.";

export const metadata: Metadata = {
  metadataBase: new URL(siteConfig.domain),
  title: {
    default: siteConfig.name,
    template: `%s | ${siteConfig.name}`,
  },
  description: DEFAULT_DESCRIPTION,
  openGraph: {
    title: siteConfig.name,
    description: DEFAULT_DESCRIPTION,
    url: siteConfig.domain,
    siteName: siteConfig.name,
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: siteConfig.name,
    description: DEFAULT_DESCRIPTION,
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    // No theme/dark-mode class here on purpose — genesis-DESIGN.md is a light-only design system
    // (globals.css no longer defines a `.dark` palette, and nothing in the app ever adds that
    // class), so there's no pre-hydration theme choice left to apply and no class-list mismatch
    // to suppress for it. suppressHydrationWarning stays for the one remaining, unrelated reason:
    // some browser extensions inject their own attributes into the live DOM before React hydrates
    // (see strip-extension-attrs.js and its own comment on <body> below).
    <html lang="en" className={`${dmSans.variable} ${jetbrainsMono.variable} ${generalSans.variable} h-full antialiased`}>
      <head>
        {/* Strips browser-extension-injected attributes (bis_skin_checked and friends) before they can cause a hydration
            mismatch — see the file's own comment. Deliberately synchronous, not async/defer: it has to run during HTML
            parsing, before hydration, and a same-origin <script src> needs no `unsafe-inline` CSP carve-out to do that. */}
        {/* eslint-disable-next-line @next/next/no-sync-scripts */}
        <script src="/strip-extension-attrs.js" />
      </head>
      {/*
        suppressHydrationWarning here (and not just <html>): some browser extensions (Bitdefender's Anti-tracker and
        similar) inject their own attributes — e.g. `bis_skin_checked` — onto <body> and its children before React
        hydrates. strip-extension-attrs.js actively removes them, so most of the time there's nothing left to mismatch on
        by the time hydration runs, but it's a real DOM mutation racing an extension's own timing, not a guarantee — this
        is the fallback for <body> itself if that race is ever lost. It never hides a genuine bug: this only affects users
        with that class of extension installed, and only the noted attributes, never real content.
      */}
      <body className="min-h-full flex flex-col" suppressHydrationWarning>
        <MotionProvider>
          {children}
          <CookieConsentBanner />
        </MotionProvider>
      </body>
    </html>
  );
}
