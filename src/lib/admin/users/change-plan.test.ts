import { beforeEach, describe, expect, it, vi } from "vitest";

// Admin → Users → "Change plan": puts a non-Stripe account on any plan, refuses Stripe-billed accounts, and logs it.

const USER_ID = "11111111-1111-4111-8111-111111111111";
const upsert = vi.fn();
const billingInsert = vi.fn();
const logAdminAction = vi.fn();
let planRow: unknown;
let subscriptionRow: unknown;

function table(name: string) {
  if (name === "plans") {
    return { select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: planRow }) }) }) };
  }
  if (name === "subscriptions") {
    return {
      select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: subscriptionRow }) }) }),
      upsert: (row: unknown, opts: unknown) => {
        upsert(row, opts);
        return { select: () => ({ single: async () => ({ data: { id: "sub-1" }, error: null }) }) };
      },
    };
  }
  if (name === "billing_events") return { insert: async (row: unknown) => billingInsert(row) };
  throw new Error(`unexpected table ${name}`);
}

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({ from: table }) }));
vi.mock("@/lib/admin/permissions", () => ({
  requirePermission: async () => ({ user: { id: "admin-1", email: "admin@example.com" } }),
  hasPermission: async () => true,
}));
vi.mock("@/lib/admin/audit/log", () => ({ logAdminAction: (params: unknown) => logAdminAction(params) }));
vi.mock("@/lib/stripe/client", () => ({ getStripeClient: vi.fn() }));
vi.mock("@/lib/account/erase-account", () => ({ eraseUserAccount: vi.fn() }));

import { changeUserPlanByAdmin } from "@/lib/admin/users/actions";

function form(planSlug: string) {
  const data = new FormData();
  data.set("userId", USER_ID);
  data.set("planSlug", planSlug);
  return data;
}

describe("changeUserPlanByAdmin", () => {
  beforeEach(() => {
    upsert.mockReset();
    billingInsert.mockReset();
    logAdminAction.mockReset();
    planRow = { id: "plan-elite", slug: "elite", name: "Elite", tier_order: 3 };
    subscriptionRow = { id: "sub-1", stripe_subscription_id: null, status: "active", plans: { slug: "free", tier_order: 0 } };
  });

  it("moves a free account onto the chosen plan and logs it", async () => {
    const result = await changeUserPlanByAdmin(undefined, form("elite"));
    expect(result).toEqual({ success: "Moved to Elite." });
    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({ user_id: USER_ID, plan_id: "plan-elite", status: "active" }),
      { onConflict: "user_id" },
    );
    expect(billingInsert).toHaveBeenCalledWith(expect.objectContaining({ event_type: "subscription_upgraded" }));
    expect(logAdminAction).toHaveBeenCalledWith(expect.objectContaining({ action: "subscription.change_plan" }));
  });

  it("refuses an account billed through Stripe", async () => {
    subscriptionRow = { id: "sub-1", stripe_subscription_id: "sub_123", status: "active", plans: { slug: "pro", tier_order: 1 } };
    const result = await changeUserPlanByAdmin(undefined, form("elite"));
    expect(result).toEqual({ error: expect.stringContaining("Stripe") });
    expect(upsert).not.toHaveBeenCalled();
  });

  it("refuses an unknown plan", async () => {
    planRow = null;
    expect(await changeUserPlanByAdmin(undefined, form("nope"))).toEqual({ error: "That plan doesn't exist." });
    expect(upsert).not.toHaveBeenCalled();
  });
});
