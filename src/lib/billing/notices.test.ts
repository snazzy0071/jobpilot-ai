import { describe, expect, it } from "vitest";
import { billingNotice, type BillingNoticeState } from "@/lib/billing/notices";

const free: BillingNoticeState = { planName: "Free", planSlug: "free", hasLiveSubscription: false, cancelAtPeriodEnd: false, topupCreditsThisMonth: 0 };
const pro: BillingNoticeState = { planName: "Pro", planSlug: "pro", hasLiveSubscription: true, cancelAtPeriodEnd: false, topupCreditsThisMonth: 0 };

describe("billingNotice: the database decides, the query string only names the flow", () => {
  it("never claims a subscription the database does not have", () => {
    const text = billingNotice({ checkout: "success" }, free)!;
    expect(text).not.toMatch(/you're on|subscribed/i);
    expect(text).toMatch(/waiting for Stripe/i);
  });
  it("names the real plan once the webhook has landed", () => {
    expect(billingNotice({ checkout: "success" }, pro)).toBe("You're on the Pro plan.");
  });
  it("does not say checkout failed to someone who is subscribed", () => {
    expect(billingNotice({ checkout: "canceled" }, pro)).toBeNull();
    expect(billingNotice({ checkout: "canceled" }, free)).toMatch(/no subscription was started/);
  });
  it("cancellation and reactivation only announce what the row says", () => {
    expect(billingNotice({ plan: "canceling" }, { ...pro, cancelAtPeriodEnd: true })).toMatch(/will end/);
    expect(billingNotice({ plan: "canceling" }, pro)).toMatch(/once Stripe confirms/);
    expect(billingNotice({ plan: "reactivated" }, pro)).toMatch(/active and will renew/);
    expect(billingNotice({ plan: "reactivated" }, { ...pro, cancelAtPeriodEnd: true })).toMatch(/once Stripe confirms/);
    expect(billingNotice({ plan: "reactivated" }, free)).toBeNull();
  });
  it("a plan change is only 'requested' until the row changes", () => {
    expect(billingNotice({ plan: "updated" }, pro)).toMatch(/requested/);
    expect(billingNotice({ plan: "updated" }, pro)).not.toMatch(/has been updated/);
  });
  it("top-up credits are only claimed when they exist in the database", () => {
    expect(billingNotice({ topup: "success" }, free)).toMatch(/waiting for Stripe/);
    expect(billingNotice({ topup: "success" }, { ...pro, topupCreditsThisMonth: 5 })).toMatch(/5 added/);
    expect(billingNotice({ topup: "canceled" }, pro)).toMatch(/nothing was charged/);
  });
  it("shows nothing for unknown or missing parameters", () => {
    expect(billingNotice({}, pro)).toBeNull();
    expect(billingNotice({ checkout: "<script>" }, pro)).toBeNull();
  });
});
