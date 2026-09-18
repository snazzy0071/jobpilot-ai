import "server-only";
import { z } from "zod";

/**
 * Stripe env vars, validated separately from src/lib/env.server.ts and
 * on demand rather than at import time. That file's pattern (parse once,
 * eagerly, at module load) is right for a var every server request needs
 * — it isn't right here: Stripe may legitimately be unconfigured in some
 * environments, and this module gets pulled into the build graph by
 * pages that reference the checkout action even when nobody ever clicks
 * "upgrade". An eager throw here would fail `next build` itself whenever
 * Stripe keys aren't set, not just the checkout flow. Call getStripeEnv()
 * at the point of use instead, and handle the throw there.
 */
const stripeEnvSchema = z.object({
  STRIPE_SECRET_KEY: z.string().min(1, "is required"),
  STRIPE_WEBHOOK_SECRET: z.string().min(1, "is required"),
  STRIPE_PRICE_PRO_MONTHLY: z.string().min(1, "is required"),
  STRIPE_PRICE_PRO_ANNUAL: z.string().min(1, "is required"),
  STRIPE_PRICE_PREMIUM_MONTHLY: z.string().min(1, "is required"),
  STRIPE_PRICE_PREMIUM_ANNUAL: z.string().min(1, "is required"),
  STRIPE_PRICE_ELITE_MONTHLY: z.string().min(1, "is required"),
  STRIPE_PRICE_ELITE_ANNUAL: z.string().min(1, "is required"),
  // A one-time (not recurring) Price — the voice top-up purchase
  // (src/lib/interviews/topup-actions.ts) uses Checkout in "payment"
  // mode, not "subscription", so this must be a Stripe one-time price,
  // not one of the monthly/annual recurring ones above.
  STRIPE_PRICE_VOICE_TOPUP: z.string().min(1, "is required"),
});

export type StripeEnv = z.infer<typeof stripeEnvSchema>;

let cached: StripeEnv | null = null;

/** Throws a plain Error (not a build-time crash) if Stripe isn't configured. */
export function getStripeEnv(): StripeEnv {
  if (cached) return cached;

  const parsed = stripeEnvSchema.safeParse({
    STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY,
    STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET,
    STRIPE_PRICE_PRO_MONTHLY: process.env.STRIPE_PRICE_PRO_MONTHLY,
    STRIPE_PRICE_PRO_ANNUAL: process.env.STRIPE_PRICE_PRO_ANNUAL,
    STRIPE_PRICE_PREMIUM_MONTHLY: process.env.STRIPE_PRICE_PREMIUM_MONTHLY,
    STRIPE_PRICE_PREMIUM_ANNUAL: process.env.STRIPE_PRICE_PREMIUM_ANNUAL,
    STRIPE_PRICE_ELITE_MONTHLY: process.env.STRIPE_PRICE_ELITE_MONTHLY,
    STRIPE_PRICE_ELITE_ANNUAL: process.env.STRIPE_PRICE_ELITE_ANNUAL,
    STRIPE_PRICE_VOICE_TOPUP: process.env.STRIPE_PRICE_VOICE_TOPUP,
  });

  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((issue) => `  - ${issue.path.join(".")}: ${issue.message}`)
      .join("\n");
    throw new Error(`Stripe isn't configured (see .env.example):\n${issues}`);
  }

  cached = parsed.data;
  return cached;
}
