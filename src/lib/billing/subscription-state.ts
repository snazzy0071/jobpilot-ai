// What a subscriptions row means, in one place. Pure, so it is unit-tested and shared by the server actions, the entitlement
// service and the billing screen.

/** Statuses under which the plan's entitlements apply. past_due keeps access during Stripe's retry period (see service.ts). */
export const ENTITLED_STATUSES: ReadonlySet<string> = new Set(["active", "trialing", "past_due"]);

type Row = { status: string; stripe_subscription_id: string | null } | null | undefined;

/** A Stripe subscription that is still running (so a second checkout would bill the person twice). */
export function hasLiveStripeSubscription(row: Row): boolean {
  return Boolean(row?.stripe_subscription_id) && ENTITLED_STATUSES.has(row!.status);
}

/** A subscription whose end-of-period cancellation can be set or undone. */
export function hasCancellableSubscription(row: Row): boolean {
  return hasLiveStripeSubscription(row);
}

/** Whether the status still grants the plan; anything else (canceled, incomplete, ...) means the person is on Free. */
export function statusGrantsPlan(status: string): boolean {
  return ENTITLED_STATUSES.has(status);
}
