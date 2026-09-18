/**
 * Single source of truth for brand identity. Swap values here to
 * rebrand the whole app — nothing else should hardcode these literals.
 */
export const siteConfig = {
  name: "JobPilot AI",
  domain: process.env.NEXT_PUBLIC_SITE_URL ?? "https://jobpilotai.com",
  company: "JobPilot AI Ltd",
  supportEmail: "support@jobpilotai.com",
  aiCoachName: "Ivy",
  logo: {
    // No image asset yet — Logo renders the text wordmark below until
    // one is dropped in. Point this at the real file when it exists.
    src: "/logo.svg",
    alt: "JobPilot AI logo",
  },
  social: {
    linkedin: "https://www.linkedin.com/company/jobpilotai",
    x: "https://x.com/jobpilotai",
    instagram: "https://www.instagram.com/jobpilotai",
    tiktok: "https://www.tiktok.com/@jobpilotai",
  },
} as const;

export type SiteConfig = typeof siteConfig;
