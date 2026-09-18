// Plain identifiers, safe to import from Client Components — unlike
// src/lib/stripe/prices.ts, which resolves these to actual Stripe price
// ids from secret env vars and is server-only.

export const PAID_PLAN_SLUGS = ["pro", "premium", "elite"] as const;
export type PaidPlanSlug = (typeof PAID_PLAN_SLUGS)[number];

export const BILLING_CYCLES = ["monthly", "annual"] as const;
export type BillingCycle = (typeof BILLING_CYCLES)[number];
