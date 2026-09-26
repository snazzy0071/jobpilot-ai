import type { NextConfig } from "next";

// Built once at module load (next.config.ts runs in a plain Node
// context, not through this app's own src/lib/env.ts helpers, so this
// reads process.env directly) — whatever NEXT_PUBLIC_SUPABASE_URL is at
// build time is the same URL src/lib/supabase/client.ts's browser
// client actually calls, so connect-src has to allow exactly that
// origin for the OAuth/identity-management calls that go straight from
// the browser to Supabase (src/components/auth/oauth-buttons.tsx,
// src/components/settings/connected-providers-panel.tsx) rather than
// through this app's own server.
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const isDev = process.env.NODE_ENV === "development";

// A real, restrictive CSP rather than report-only or absent — kept
// static (one value, computed once) rather than per-request/nonce-
// based specifically so it doesn't force this app's many statically
// prerendered marketing pages into dynamic rendering, which a nonce-
// based CSP would require (Next's own CSP guide: "you must use dynamic
// rendering to add nonces"). public/theme-init.js was pulled out of an
// inline <script> for the same reason CSP matters at all here — but
// that alone doesn't get script-src down to bare `'self'`: verified in
// a real browser (Playwright, both `next dev` and `next start`) that
// Next.js's own runtime injects its own inline bootstrap/hydration
// scripts on every page, framework-required and unrelated to any inline
// script this app writes — blocking them throws a hard client-side
// "Invariant: Expected a request ID..." crash, not just a console
// warning. Next's own docs' one supported static (non-nonce) CSP
// example (content-security-policy.md, "Without Nonces") is
// `script-src 'self' 'unsafe-inline'` for exactly this reason — this
// app follows that documented shape rather than the stricter
// bare-`'self'` this comment previously (incorrectly) shipped with.
//
// - `style-src` keeps `'unsafe-inline'`: several components set a real
//   `style={{...}}` attribute from data that has nothing to do with
//   script execution (e.g. institution branding's accent colour) —
//   tightening this would need auditing/refactoring every dynamic
//   inline style in the app, disproportionate to what this task asked
//   for, and inline *style* injection is a much lower-severity vector
//   than inline *script* injection (which this policy does fully close).
// - `img-src` allows any `https:` source, not just `'self'`: institution
//   admins set an arbitrary external logo URL
//   (src/components/onboarding/institution-cobrand-banner.tsx renders
//   it as a plain `<img src>`), a real, already-shipped feature.
// - `object-src 'none'`, `frame-ancestors 'none'`, `frame-src 'none'`:
//   this app never embeds a plugin/object or an iframe, and must never
//   be embedded in one either (clickjacking) — confirmed by grepping
//   the whole `src/` tree for `<iframe`, zero hits.
const cspDirectives = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: https:",
  "font-src 'self'",
  "media-src 'self' blob:",
  `connect-src 'self'${supabaseUrl ? ` ${supabaseUrl}` : ""}`,
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "frame-src 'none'",
  "upgrade-insecure-requests",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: cspDirectives },
  // Legacy pre-CSP clickjacking defense — kept alongside
  // frame-ancestors above for browsers that don't honour CSP.
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // microphone=(self): voice-mode interviews record via the browser's
  // MediaRecorder (src/components/interviews/interview-chat.tsx) —
  // everything else this app never uses.
  { key: "Permissions-Policy", value: "camera=(), microphone=(self), geolocation=(), interest-cohort=()" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
];

const CHROMIUM_BIN = "./node_modules/@sparticuz/chromium/bin/**/*";

const nextConfig: NextConfig = {
  // pdf-parse (via pdfjs-dist) dynamically imports its own worker file at
  // a path relative to itself at runtime — bundling it breaks that
  // resolution ("Cannot find module '.../pdf.worker.mjs'"). Opting it out
  // of Server Components bundling lets Node's native `require` resolve it
  // straight from node_modules instead, where that relative path is real.
  // puppeteer/puppeteer-core and @sparticuz/chromium (src/lib/pdf/
  // launch-browser.ts) need the same treatment for the same reason —
  // @sparticuz/chromium's own README says it "must be marked as
  // external," since it locates its binary via a path relative to
  // itself, which breaks once bundled.
  serverExternalPackages: ["pdf-parse", "pdfjs-dist", "puppeteer", "puppeteer-core", "@sparticuz/chromium"],
  // The Chromium binary @sparticuz/chromium unpacks at runtime lives in its
  // `bin/` folder (four Brotli archives), which the package finds with
  // `import.meta.url` + "../bin" — a path Next's file tracing can't follow,
  // so without this the deployed function ships the package's JS but not the
  // binary and every PDF export fails on Vercel with 'The input directory
  // ".../@sparticuz/chromium/bin" does not exist' (locally it works, because
  // node_modules is right there). Only the routes that launch a browser
  // (src/lib/pdf/launch-browser.ts) get it: the CV, cover-letter and Quick
  // Scan export endpoints, and the free ATS checker page, whose server action
  // emails the report PDF. Keys are route paths, so brackets are escaped.
  outputFileTracingIncludes: {
    "/api/cvs/\\[cvId\\]/export": [CHROMIUM_BIN],
    "/api/cover-letters/\\[id\\]/export": [CHROMIUM_BIN],
    "/api/quick-scan/\\[token\\]/pdf": [CHROMIUM_BIN],
    "/free-ats-checker": [CHROMIUM_BIN],
  },
  // Don't advertise the framework/version in every response.
  poweredByHeader: false,
  async headers() {
    return [{ source: "/(.*)", headers: securityHeaders }];
  },
  // Not generated by any link/redirect/nav item in this codebase (confirmed
  // by a full-repo search) — real production requests for these singular/
  // "feature(s)" variants of the CV tool's dashboard route still show up
  // (stale external links, bookmarks, or bots guessing at /features/cv's
  // shape under /dashboard). Catching them here sends real traffic to the
  // right page without touching any page, component, or nav config.
  // Scheme-specific signup: `/signup?from=grad&scheme=<slug>` is served by src/app/(auth)/signup/scheme/page.tsx, keeping the URL. A
  // rewrite (not a redirect) so the address is the one that was shared, and so the ordinary /signup page stays static and untouched.
  async rewrites() {
    // beforeFiles: /signup is itself a real (static) page, and ordinary rewrites only run when no page matches.
    return { beforeFiles: [{ source: "/signup", has: [{ type: "query", key: "from", value: "grad" }], destination: "/signup/scheme" }] };
  },
  async redirects() {
    return [
      { source: "/dashboard/cv", destination: "/dashboard/cvs", permanent: true },
      { source: "/dashboard/features/cv", destination: "/dashboard/cvs", permanent: true },
      { source: "/dashboard/feature/cv", destination: "/dashboard/cvs", permanent: true },
    ];
  },
};

export default nextConfig;
