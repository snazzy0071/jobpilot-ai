// The banner on Settings > Billing after a trip to Stripe. The URL only says which flow the person just left (Stripe's redirect back
// carries ?checkout=..., our own actions carry ?plan=... / ?topup=...): it is NOT evidence that anything happened. Anyone can type
// that query string. So every message that would claim an outcome ("you're subscribed", "credits added", "plan updated") is chosen
// from what the database says right now, and where the database doesn't yet agree the message says the change is still being
// confirmed instead of announcing it.

export type BillingNoticeParams = { checkout?: string; plan?: string; topup?: string };

export type BillingNoticeState = {
  /** Plan in force right now, from the entitlement service (subscription, institution licence, or Free). */
  planName: string;
  planSlug: string;
  /** True when the person's OWN subscription is a live Stripe one. */
  hasLiveSubscription: boolean;
  cancelAtPeriodEnd: boolean;
  /** Extra voice interviews credited to this month, from the database. */
  topupCreditsThisMonth: number;
};

export function billingNotice(params: BillingNoticeParams, state: BillingNoticeState): string | null {
  const paid = state.planSlug !== "free";

  switch (params.checkout) {
    case "success":
      return state.hasLiveSubscription
        ? `You're on the ${state.planName} plan.`
        : "Thanks. We're waiting for Stripe to confirm your payment. Your plan updates here as soon as it does, so refresh in a moment.";
    case "canceled":
      return state.hasLiveSubscription ? null : "Checkout wasn't completed, so no subscription was started.";
  }

  switch (params.plan) {
    case "updated":
      return `Plan change requested. You're currently on ${state.planName}; this page shows the new plan once Stripe confirms the change.`;
    case "canceling":
      return state.cancelAtPeriodEnd
        ? "Your subscription will end at the end of the current period."
        : "Cancellation requested. This page shows the end date once Stripe confirms it.";
    case "reactivated":
      return state.hasLiveSubscription && !state.cancelAtPeriodEnd
        ? "Your subscription is active and will renew as normal."
        : paid
          ? "Reactivation requested. This page updates once Stripe confirms it."
          : null;
  }

  switch (params.topup) {
    case "success":
      return state.topupCreditsThisMonth > 0
        ? `Your extra voice interviews are in this month's allowance (${state.topupCreditsThisMonth} added so far).`
        : "Thanks. We're waiting for Stripe to confirm the payment. The extra voice interviews appear once it does.";
    case "canceled":
      return "Checkout wasn't completed, so nothing was charged and no credits were added.";
  }

  return null;
}
