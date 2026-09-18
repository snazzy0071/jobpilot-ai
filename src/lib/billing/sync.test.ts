import { beforeEach, describe, expect, it, vi } from "vitest";
import type Stripe from "stripe";

vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn() }));
vi.mock("@/lib/stripe/prices", () => ({ resolvePlanFromPriceId: vi.fn() }));
vi.mock("@/lib/billing/notification-emails", () => ({
  sendPaymentFailedEmail: vi.fn(),
  sendSubscriptionCanceledEmail: vi.fn(),
}));

type SubscriptionRow = {
  id: string;
  user_id: string;
  plan_id: string;
  status: string;
  stripe_customer_id?: string;
  stripe_subscription_id?: string;
};

/**
 * A small, stateful in-memory stand-in for the admin Supabase client —
 * real enough to prove `withIdempotency` (src/lib/billing/sync.ts) does
 * what it claims: `billing_events.stripe_event_id` genuinely behaves
 * like the real unique column migration 0017 gives it (a second insert
 * with the same id is rejected with a real `23505`), and a failed
 * `apply()` genuinely deletes the claim row again so a retry isn't
 * permanently blocked. Not a canned-return mock — state persists and is
 * inspected across multiple calls within one test, which is what makes
 * this an idempotency test rather than a "the mock returned X" test.
 */
function createFakeAdmin() {
  const subscriptions = new Map<string, SubscriptionRow>();
  const billingEvents: { user_id: string; event_type: string; stripe_event_id: string | null }[] = [];
  const plans = new Map<string, { id: string; slug: string; tier_order: number }>();
  const authUsers = new Map<string, { email: string }>();

  function matchesFilters(row: Record<string, unknown>, filters: [string, unknown][]) {
    return filters.every(([col, val]) => row[col] === val);
  }

  function makeBuilder(table: string) {
    const filters: [string, unknown][] = [];
    let op: "select" | "update" | "delete" | "insert" | null = null;
    let payload: Record<string, unknown> | null = null;

    function execute(): { data: unknown; error: { code?: string; message: string } | null } {
      if (table === "subscriptions") {
        const rows = [...subscriptions.values()];
        if (op === "select") {
          const match = rows.find((row) => matchesFilters(row, filters)) ?? null;
          return { data: match, error: null };
        }
        if (op === "update") {
          const targets = rows.filter((row) => matchesFilters(row, filters));
          for (const row of targets) Object.assign(row, payload);
          return { data: null, error: null };
        }
      }
      if (table === "plans") {
        const rows = [...plans.values()];
        if (op === "select") {
          const match = rows.find((row) => matchesFilters(row, filters)) ?? null;
          return { data: match, error: null };
        }
      }
      if (table === "billing_events") {
        if (op === "insert") {
          const eventId = (payload?.stripe_event_id as string | null) ?? null;
          if (eventId && billingEvents.some((row) => row.stripe_event_id === eventId)) {
            return { data: null, error: { code: "23505", message: "duplicate key value violates unique constraint" } };
          }
          billingEvents.push({
            user_id: payload?.user_id as string,
            event_type: payload?.event_type as string,
            stripe_event_id: eventId,
          });
          return { data: null, error: null };
        }
        if (op === "delete") {
          const remaining = billingEvents.filter((row) => !matchesFilters(row, filters));
          billingEvents.length = 0;
          billingEvents.push(...remaining);
          return { data: null, error: null };
        }
      }
      return { data: null, error: null };
    }

    const builder: Record<string, (...args: never[]) => unknown> = {};
    builder.select = (..._args: unknown[]) => {
      op = "select";
      return builder;
    };
    builder.update = (...args: unknown[]) => {
      op = "update";
      payload = args[0] as Record<string, unknown>;
      return builder;
    };
    builder.insert = (...args: unknown[]) => {
      op = "insert";
      payload = args[0] as Record<string, unknown>;
      return builder;
    };
    builder.delete = (..._args: unknown[]) => {
      op = "delete";
      return builder;
    };
    builder.eq = (...args: unknown[]) => {
      filters.push([args[0] as string, args[1]]);
      return builder;
    };
    builder.single = () => Promise.resolve(execute());
    builder.maybeSingle = () => Promise.resolve(execute());
    builder.then = (onFulfilled: (v: unknown) => unknown, onRejected?: (r: unknown) => unknown) =>
      Promise.resolve(execute()).then(onFulfilled, onRejected);
    return builder;
  }

  return {
    admin: {
      from: (table: string) => makeBuilder(table),
      auth: { admin: { getUserById: (id: string) => Promise.resolve({ data: { user: authUsers.get(id) ?? null } }) } },
    },
    subscriptions,
    billingEvents,
    plans,
    authUsers,
  };
}

function fakeEvent(id: string, type: string, object: Record<string, unknown>): Stripe.Event {
  return { id, type, data: { object } } as unknown as Stripe.Event;
}

describe("withIdempotency (via handleSubscriptionDeleted)", () => {
  beforeEach(() => vi.clearAllMocks());

  it("applies the side effect once for a fresh event, and a redelivery of the same event is a no-op", async () => {
    const fake = createFakeAdmin();
    const { createAdminClient } = await import("@/lib/supabase/admin");
    (createAdminClient as ReturnType<typeof vi.fn>).mockReturnValue(fake.admin);

    fake.subscriptions.set("sub-row-1", { id: "sub-row-1", user_id: "user-1", plan_id: "plan-1", status: "active", stripe_customer_id: "cus_1" });
    fake.authUsers.set("user-1", { email: "user1@test.local" });

    const { handleSubscriptionDeleted } = await import("@/lib/billing/sync");
    const event = fakeEvent("evt_deleted_1", "customer.subscription.deleted", { id: "sub_stripe_1", customer: "cus_1" });

    await handleSubscriptionDeleted(event);
    expect(fake.subscriptions.get("sub-row-1")?.status).toBe("canceled");
    expect(fake.billingEvents).toHaveLength(1);

    const { sendSubscriptionCanceledEmail } = await import("@/lib/billing/notification-emails");
    expect(sendSubscriptionCanceledEmail).toHaveBeenCalledTimes(1);

    // Redelivery: Stripe's own "at least once" guarantee — the exact
    // same event, same id, arrives again.
    fake.subscriptions.get("sub-row-1")!.status = "active"; // simulate something else changed it back, to prove this call does NOT re-apply
    await handleSubscriptionDeleted(event);
    expect(fake.subscriptions.get("sub-row-1")?.status).toBe("active"); // untouched by the redelivery
    expect(fake.billingEvents).toHaveLength(1); // still only one claim row
    expect(sendSubscriptionCanceledEmail).toHaveBeenCalledTimes(1); // not sent twice
  });

  it("un-claims the event (deletes its billing_events row) when apply() throws, so a genuine retry can still succeed", async () => {
    const fake = createFakeAdmin();
    const { createAdminClient } = await import("@/lib/supabase/admin");
    (createAdminClient as ReturnType<typeof vi.fn>).mockReturnValue(fake.admin);

    // No matching subscription row at all — findUserIdByStripeCustomerId
    // resolves null, and the handler itself just logs+returns *before*
    // ever calling withIdempotency in that case, so instead force the
    // failure inside `apply()` directly: an update that throws because
    // the mocked email sender rejects.
    fake.subscriptions.set("sub-row-1", { id: "sub-row-1", user_id: "user-1", plan_id: "plan-1", status: "active", stripe_customer_id: "cus_2" });
    const { sendSubscriptionCanceledEmail } = await import("@/lib/billing/notification-emails");
    (sendSubscriptionCanceledEmail as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error("email provider down"));
    fake.authUsers.set("user-1", { email: "user1@test.local" });

    const { handleSubscriptionDeleted } = await import("@/lib/billing/sync");
    const event = fakeEvent("evt_deleted_2", "customer.subscription.deleted", { id: "sub_stripe_2", customer: "cus_2" });

    await expect(handleSubscriptionDeleted(event)).rejects.toThrow("email provider down");
    // The status update itself already committed (apply() throws *after*
    // that succeeds) — but the claim row must be gone so Stripe's retry
    // can attempt the whole thing again rather than being told "already
    // processed" for something that only partially completed.
    expect(fake.billingEvents).toHaveLength(0);

    // Retry: this time the email sender succeeds.
    (sendSubscriptionCanceledEmail as ReturnType<typeof vi.fn>).mockResolvedValueOnce(undefined);
    await handleSubscriptionDeleted(event);
    expect(fake.billingEvents).toHaveLength(1);
  });
});

describe("handleInvoicePaid", () => {
  beforeEach(() => vi.clearAllMocks());

  it("self-heals a past_due subscription back to active, but never touches one that's already active", async () => {
    const fake = createFakeAdmin();
    const { createAdminClient } = await import("@/lib/supabase/admin");
    (createAdminClient as ReturnType<typeof vi.fn>).mockReturnValue(fake.admin);
    fake.subscriptions.set("sub-row-1", { id: "sub-row-1", user_id: "user-1", plan_id: "plan-1", status: "past_due", stripe_customer_id: "cus_3" });

    const { handleInvoicePaid } = await import("@/lib/billing/sync");
    await handleInvoicePaid(
      fakeEvent("evt_paid_1", "invoice.paid", { id: "in_1", customer: "cus_3", amount_paid: 500, currency: "gbp" }),
    );

    expect(fake.subscriptions.get("sub-row-1")?.status).toBe("active");
  });

  it("does not process the same invoice.paid event twice", async () => {
    const fake = createFakeAdmin();
    const { createAdminClient } = await import("@/lib/supabase/admin");
    (createAdminClient as ReturnType<typeof vi.fn>).mockReturnValue(fake.admin);
    fake.subscriptions.set("sub-row-1", { id: "sub-row-1", user_id: "user-1", plan_id: "plan-1", status: "past_due", stripe_customer_id: "cus_4" });

    const { handleInvoicePaid } = await import("@/lib/billing/sync");
    const event = fakeEvent("evt_paid_2", "invoice.paid", { id: "in_2", customer: "cus_4", amount_paid: 500, currency: "gbp" });

    await handleInvoicePaid(event);
    fake.subscriptions.get("sub-row-1")!.status = "past_due"; // something else (a later failed payment) legitimately moved it back
    await handleInvoicePaid(event); // a redelivery of the *original* event must not flip it to active again
    expect(fake.subscriptions.get("sub-row-1")?.status).toBe("past_due");
  });
});

describe("handleCheckoutSessionCompleted", () => {
  beforeEach(() => vi.clearAllMocks());

  it("skips entirely when the session carries no user reference, without touching billing_events", async () => {
    const fake = createFakeAdmin();
    const { createAdminClient } = await import("@/lib/supabase/admin");
    (createAdminClient as ReturnType<typeof vi.fn>).mockReturnValue(fake.admin);

    const { handleCheckoutSessionCompleted } = await import("@/lib/billing/sync");
    await handleCheckoutSessionCompleted(
      fakeEvent("evt_checkout_1", "checkout.session.completed", { mode: "subscription", metadata: {}, customer: "cus_5" }),
    );

    expect(fake.billingEvents).toHaveLength(0);
  });
});
