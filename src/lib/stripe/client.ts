import "server-only";
import Stripe from "stripe";
import { getStripeEnv } from "@/lib/stripe/env";

let cached: Stripe | null = null;

/**
 * Constructed lazily for the same reason getStripeEnv() validates lazily
 * — see that file.
 *
 * `httpClient` only changes when `E2E_MOCK_PROVIDERS` is set — a flag
 * this app's own runtime never sets itself (see
 * e2e/support/mock-providers/preload.mjs, the one place that does, as a
 * Node process preload loaded *before* this module ever runs). The
 * Node SDK's real default (`NodeHttpClient`) talks to Stripe over the
 * raw `http`/`https` modules directly, invisible to undici's dispatcher
 * — swapping to `createFetchHttpClient()` is what lets the E2E provider
 * mock (undici's global MockAgent) see and intercept these calls at
 * all. Same real Stripe API requests either way; only the literal
 * transport changes, and only under this one flag.
 */
export function getStripeClient(): Stripe {
  if (cached) return cached;

  const { STRIPE_SECRET_KEY } = getStripeEnv();
  cached = new Stripe(STRIPE_SECRET_KEY, {
    apiVersion: "2026-08-26.dahlia",
    ...(process.env.E2E_MOCK_PROVIDERS === "1" ? { httpClient: Stripe.createFetchHttpClient() } : {}),
  });
  return cached;
}
