import { z } from "zod";

export const newsletterConsentSources = ["newsletter_page", "quick_scan"] as const;

export const newsletterSubscribeSchema = z.object({
  email: z.email().trim().max(254),
  source: z.enum(newsletterConsentSources),
});
