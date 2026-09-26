import { describe, expect, it } from "vitest";
import { hasCancellableSubscription, hasLiveStripeSubscription, statusGrantsPlan } from "@/lib/billing/subscription-state";

describe("subscription state", () => {
  it("grants the plan for active, trialing and past_due only", () => {
    for (const status of ["active", "trialing", "past_due"]) expect(statusGrantsPlan(status)).toBe(true);
    for (const status of ["canceled", "incomplete", "incomplete_expired", "unpaid", "paused", ""]) expect(statusGrantsPlan(status)).toBe(false);
  });
  it("a live Stripe subscription needs both a Stripe id and a granting status (a grant with no Stripe id is not billable)", () => {
    expect(hasLiveStripeSubscription({ status: "active", stripe_subscription_id: "sub_1" })).toBe(true);
    expect(hasLiveStripeSubscription({ status: "past_due", stripe_subscription_id: "sub_1" })).toBe(true);
    expect(hasLiveStripeSubscription({ status: "active", stripe_subscription_id: null })).toBe(false);
    expect(hasLiveStripeSubscription({ status: "canceled", stripe_subscription_id: "sub_1" })).toBe(false);
    expect(hasLiveStripeSubscription(null)).toBe(false);
    expect(hasCancellableSubscription({ status: "trialing", stripe_subscription_id: "sub_1" })).toBe(true);
  });
});
