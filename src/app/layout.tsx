import type { Metadata } from "next";
import { Geist, Geist_Mono, Sora } from "next/font/google";
import { siteConfig } from "@/config/site";
import { CookieConsentBanner } from "@/components/consent/cookie-consent-banner";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-sans",
  subsets: ["latin"],
});

// preload: false — next/font preloads every font declared in the root
// layout on *every* route by default (its own docs: "root layout... is
// preloaded on all routes"), but font-mono only appears in a handful of
// niche admin/settings screens (audit log, access codes, ATS text
// preview, delete-account confirmation) — every other page was paying
// for a font file it never renders.
const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  preload: false,
});

// Display/heading typeface, distinct from the Geist body font — matches
// docs/DESIGN_SYSTEM.md's reference (Sora for headings). Wired to
// --font-heading (globals.css), which the `font-heading` utility class
// already used by Card/Dialog/AlertDialog/Sheet titles reads — no
// per-page changes needed for those to pick it up.
const sora = Sora({
  variable: "--font-heading",
  subsets: ["latin"],
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

// The theme-init script (public/theme-init.js) has to run blocking,
// before hydration, to avoid a flash of the wrong theme — but it's
// loaded from a same-origin file, not inlined, so it works under a
// strict `script-src 'self'` CSP with no `unsafe-inline` carve-out.
// suppressHydrationWarning on <html> is required regardless: React
// would otherwise flag the class list this script sets as a mismatch
// against the server-rendered markup.

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} ${sora.variable} h-full antialiased`}
    >
      <head>
        {/*
          Deliberately synchronous, not async/defer — it has to run
          during HTML parsing, before first paint, or the theme flash
          this exists to prevent happens anyway. Next.js's own
          no-sync-scripts rule assumes a blocking <script src> is
          always a performance mistake, which isn't true for this one.
        */}
        {/* eslint-disable-next-line @next/next/no-sync-scripts */}
        <script src="/theme-init.js" />
      </head>
      <body className="min-h-full flex flex-col">
        {children}
        <CookieConsentBanner />
      </body>
    </html>
  );
}
