import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CurrentSubscription } from "@/lib/billing/queries";

vi.mock("@/lib/billing/queries", () => ({ getCurrentSubscription: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn() }));

function subscription(overrides: Partial<CurrentSubscription> = {}): CurrentSubscription {
  return {
    planSlug: "pro",
    planName: "Pro",
    status: "active",
    billingCycle: "monthly",
    currentPeriodEnd: null,
    cancelAtPeriodEnd: false,
    hasStripeCustomer: true,
    entitlements: { tailored_ats_scans_per_month: 20 },
    ...overrides,
  };
}

/** A single-table stub for the plain `createClient()` path — every method chains to itself, `.maybeSingle()`/awaiting resolves to `result`. */
function stubSupabase(result: { data: unknown; error: { message: string } | null }) {
  const builder: Record<string, (...args: never[]) => unknown> = {};
  const chain = () => builder;
  builder.select = chain;
  builder.eq = chain;
  builder.in = chain;
  builder.maybeSingle = () => Promise.resolve(result);
  builder.then = (onFulfilled: (v: typeof result) => unknown, onRejected?: (r: unknown) => unknown) =>
    Promise.resolve(result).then(onFulfilled, onRejected);
  return { from: () => builder };
}

describe("getCurrentCalendarPeriod", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns the first instant of the current UTC month as periodStart and next month as periodEnd", async () => {
    vi.setSystemTime(new Date("2024-03-17T15:42:00Z"));
    const { getCurrentCalendarPeriod } = await import("@/lib/entitlements/service");
    const { periodStart, periodEnd } = getCurrentCalendarPeriod();
    expect(periodStart).toBe("2024-03-01T00:00:00.000Z");
    expect(periodEnd).toBe("2024-04-01T00:00:00.000Z");
  });

  it("rolls over into next calendar year in December", async () => {
    vi.setSystemTime(new Date("2024-12-25T00:00:00Z"));
    const { getCurrentCalendarPeriod } = await import("@/lib/entitlements/service");
    const { periodStart, periodEnd } = getCurrentCalendarPeriod();
    expect(periodStart).toBe("2024-12-01T00:00:00.000Z");
    expect(periodEnd).toBe("2025-01-01T00:00:00.000Z");
  });
});

describe("getEntitlements / hasFeature", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("uses the subscription's own plan entitlements when status is active", async () => {
    const { getCurrentSubscription } = await import("@/lib/billing/queries");
    (getCurrentSubscription as ReturnType<typeof vi.fn>).mockResolvedValue(
      subscription({ entitlements: { cover_letter_generator: true } }),
    );

    const { hasFeature } = await import("@/lib/entitlements/service");
    expect(await hasFeature("user-1", "cover_letter_generator")).toBe(true);
  });

  it.each(["trialing", "past_due"])("still treats a %s subscription as entitled (grace period)", async (status) => {
    const { getCurrentSubscription } = await import("@/lib/billing/queries");
    (getCurrentSubscription as ReturnType<typeof vi.fn>).mockResolvedValue(
      subscription({ status, entitlements: { cover_letter_generator: true } }),
    );

    const { hasFeature } = await import("@/lib/entitlements/service");
    expect(await hasFeature("user-1", "cover_letter_generator")).toBe(true);
  });

  it("falls back to Free's entitlements when the subscription is canceled", async () => {
    const { getCurrentSubscription } = await import("@/lib/billing/queries");
    (getCurrentSubscription as ReturnType<typeof vi.fn>).mockResolvedValue(
      subscription({ status: "canceled", entitlements: { cover_letter_generator: true } }),
    );
    const { createClient } = await import("@/lib/supabase/server");
    (createClient as ReturnType<typeof vi.fn>).mockResolvedValue(
      stubSupabase({ data: { entitlements: { cover_letter_generator: false } }, error: null }),
    );

    const { hasFeature } = await import("@/lib/entitlements/service");
    // Even though the (stale) subscription row still says `true`, a
    // canceled status must never grant its plan's entitlements.
    expect(await hasFeature("user-1", "cover_letter_generator")).toBe(false);
  });

  it("falls back to Free's entitlements when there is no subscription at all", async () => {
    const { getCurrentSubscription } = await import("@/lib/billing/queries");
    (getCurrentSubscription as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    const { createClient } = await import("@/lib/supabase/server");
    (createClient as ReturnType<typeof vi.fn>).mockResolvedValue(
      stubSupabase({ data: { entitlements: { cover_letter_generator: false } }, error: null }),
    );

    const { getEntitlements } = await import("@/lib/entitlements/service");
    const result = await getEntitlements("user-1");
    expect(result.planSlug).toBe("free");
  });

  it("treats a non-boolean truthy value as not entitled — only a literal `true` counts", async () => {
    const { getCurrentSubscription } = await import("@/lib/billing/queries");
    (getCurrentSubscription as ReturnType<typeof vi.fn>).mockResolvedValue(
      subscription({ entitlements: { cover_letter_generator: "yes" } }),
    );

    const { hasFeature } = await import("@/lib/entitlements/service");
    expect(await hasFeature("user-1", "cover_letter_generator")).toBe(false);
  });
});

describe("getLimit", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("fails closed to 0 when the metric key is entirely missing from entitlements", async () => {
    const { getCurrentSubscription } = await import("@/lib/billing/queries");
    (getCurrentSubscription as ReturnType<typeof vi.fn>).mockResolvedValue(subscription({ entitlements: {} }));

    const { getLimit } = await import("@/lib/entitlements/service");
    expect(await getLimit("user-1", "tailored_ats_scans_per_month")).toBe(0);
  });

  it("returns null (unlimited) only when the entitlements blob explicitly says null", async () => {
    const { getCurrentSubscription } = await import("@/lib/billing/queries");
    (getCurrentSubscription as ReturnType<typeof vi.fn>).mockResolvedValue(
      subscription({ entitlements: { tailored_ats_scans_per_month: null } }),
    );

    const { getLimit } = await import("@/lib/entitlements/service");
    expect(await getLimit("user-1", "tailored_ats_scans_per_month")).toBeNull();
  });

  it("returns the plain configured number for a metric other than voice interviews, without a topup query", async () => {
    const { getCurrentSubscription } = await import("@/lib/billing/queries");
    (getCurrentSubscription as ReturnType<typeof vi.fn>).mockResolvedValue(
      subscription({ entitlements: { tailored_ats_scans_per_month: 20 } }),
    );
    const { createClient } = await import("@/lib/supabase/server");
    const createClientMock = createClient as ReturnType<typeof vi.fn>;

    const { getLimit } = await import("@/lib/entitlements/service");
    expect(await getLimit("user-1", "tailored_ats_scans_per_month")).toBe(20);
    expect(createClientMock).not.toHaveBeenCalled();
  });

  it("adds real purchased topup credits on top of the plan limit for voice interviews only", async () => {
    const { getCurrentSubscription } = await import("@/lib/billing/queries");
    (getCurrentSubscription as ReturnType<typeof vi.fn>).mockResolvedValue(
      subscription({ entitlements: { voice_interviews_per_month: 5 } }),
    );
    const { createClient } = await import("@/lib/supabase/server");
    (createClient as ReturnType<typeof vi.fn>).mockResolvedValue(
      stubSupabase({ data: [{ credits: 3 }, { credits: 2 }], error: null }),
    );

    const { getLimit } = await import("@/lib/entitlements/service");
    expect(await getLimit("user-1", "voice_interviews_per_month")).toBe(10);
  });
});

describe("checkUsageAllowed", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("short-circuits to unlimited without querying usage when the limit is null", async () => {
    const { getCurrentSubscription } = await import("@/lib/billing/queries");
    (getCurrentSubscription as ReturnType<typeof vi.fn>).mockResolvedValue(
      subscription({ entitlements: { tailored_ats_scans_per_month: null } }),
    );
    const { createClient } = await import("@/lib/supabase/server");
    const createClientMock = createClient as ReturnType<typeof vi.fn>;

    const { checkUsageAllowed } = await import("@/lib/entitlements/service");
    const result = await checkUsageAllowed("user-1", "tailored_ats_scans_per_month");
    expect(result).toEqual({ allowed: true, limit: null, used: 0, remaining: null });
    expect(createClientMock).not.toHaveBeenCalled();
  });

  it("reports remaining allowance correctly when some usage already exists", async () => {
    const { getCurrentSubscription } = await import("@/lib/billing/queries");
    (getCurrentSubscription as ReturnType<typeof vi.fn>).mockResolvedValue(
      subscription({ entitlements: { tailored_ats_scans_per_month: 10 } }),
    );
    const { createClient } = await import("@/lib/supabase/server");
    (createClient as ReturnType<typeof vi.fn>).mockResolvedValue(stubSupabase({ data: { used_count: 4 }, error: null }));

    const { checkUsageAllowed } = await import("@/lib/entitlements/service");
    const result = await checkUsageAllowed("user-1", "tailored_ats_scans_per_month");
    expect(result).toEqual({ allowed: true, limit: 10, used: 4, remaining: 6 });
  });

  it("reports not allowed once usage reaches the limit", async () => {
    const { getCurrentSubscription } = await import("@/lib/billing/queries");
    (getCurrentSubscription as ReturnType<typeof vi.fn>).mockResolvedValue(
      subscription({ entitlements: { tailored_ats_scans_per_month: 10 } }),
    );
    const { createClient } = await import("@/lib/supabase/server");
    (createClient as ReturnType<typeof vi.fn>).mockResolvedValue(stubSupabase({ data: { used_count: 10 }, error: null }));

    const { checkUsageAllowed } = await import("@/lib/entitlements/service");
    const result = await checkUsageAllowed("user-1", "tailored_ats_scans_per_month");
    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
  });

  it("fails closed (not allowed) when the usage query itself errors", async () => {
    const { getCurrentSubscription } = await import("@/lib/billing/queries");
    (getCurrentSubscription as ReturnType<typeof vi.fn>).mockResolvedValue(
      subscription({ entitlements: { tailored_ats_scans_per_month: 10 } }),
    );
    const { createClient } = await import("@/lib/supabase/server");
    (createClient as ReturnType<typeof vi.fn>).mockResolvedValue(
      stubSupabase({ data: null, error: { message: "boom" } }),
    );

    const { checkUsageAllowed } = await import("@/lib/entitlements/service");
    const result = await checkUsageAllowed("user-1", "tailored_ats_scans_per_month");
    expect(result).toEqual({ allowed: false, limit: 10, used: 10, remaining: 0 });
  });
});

describe("consumeUsage / requireUsageAllowed", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns allowed with the row's used_count when the RPC allows it", async () => {
    const { getCurrentSubscription } = await import("@/lib/billing/queries");
    (getCurrentSubscription as ReturnType<typeof vi.fn>).mockResolvedValue(
      subscription({ entitlements: { tailored_ats_scans_per_month: 10 } }),
    );
    const { createAdminClient } = await import("@/lib/supabase/admin");
    (createAdminClient as ReturnType<typeof vi.fn>).mockReturnValue({
      rpc: vi.fn().mockResolvedValue({ data: [{ allowed: true, used_count: 5 }], error: null }),
    });

    const { consumeUsage } = await import("@/lib/entitlements/service");
    const result = await consumeUsage("user-1", "tailored_ats_scans_per_month");
    expect(result).toEqual({ allowed: true, limit: 10, used: 5, remaining: 5 });
  });

  it("handles the RPC returning a single row object rather than an array", async () => {
    const { getCurrentSubscription } = await import("@/lib/billing/queries");
    (getCurrentSubscription as ReturnType<typeof vi.fn>).mockResolvedValue(
      subscription({ entitlements: { tailored_ats_scans_per_month: 10 } }),
    );
    const { createAdminClient } = await import("@/lib/supabase/admin");
    (createAdminClient as ReturnType<typeof vi.fn>).mockReturnValue({
      rpc: vi.fn().mockResolvedValue({ data: { allowed: false, used_count: 10 }, error: null }),
    });

    const { consumeUsage } = await import("@/lib/entitlements/service");
    const result = await consumeUsage("user-1", "tailored_ats_scans_per_month");
    expect(result).toEqual({ allowed: false, limit: 10, used: 10, remaining: 0 });
  });

  it("throws if the RPC call itself errors", async () => {
    const { getCurrentSubscription } = await import("@/lib/billing/queries");
    (getCurrentSubscription as ReturnType<typeof vi.fn>).mockResolvedValue(
      subscription({ entitlements: { tailored_ats_scans_per_month: 10 } }),
    );
    const { createAdminClient } = await import("@/lib/supabase/admin");
    (createAdminClient as ReturnType<typeof vi.fn>).mockReturnValue({
      rpc: vi.fn().mockResolvedValue({ data: null, error: { message: "db down" } }),
    });

    const { consumeUsage } = await import("@/lib/entitlements/service");
    await expect(consumeUsage("user-1", "tailored_ats_scans_per_month")).rejects.toThrow(/db down/);
  });

  it("requireUsageAllowed throws EntitlementError with a 0-limit-specific message when the plan doesn't include the metric at all", async () => {
    const { getCurrentSubscription } = await import("@/lib/billing/queries");
    (getCurrentSubscription as ReturnType<typeof vi.fn>).mockResolvedValue(subscription({ entitlements: {} }));
    const { createAdminClient } = await import("@/lib/supabase/admin");
    (createAdminClient as ReturnType<typeof vi.fn>).mockReturnValue({
      rpc: vi.fn().mockResolvedValue({ data: [{ allowed: false, used_count: 0 }], error: null }),
    });

    const { requireUsageAllowed, EntitlementError } = await import("@/lib/entitlements/service");
    await expect(requireUsageAllowed("user-1", "tailored_ats_scans_per_month")).rejects.toThrow(EntitlementError);
    await expect(requireUsageAllowed("user-1", "tailored_ats_scans_per_month")).rejects.toThrow(
      "This isn't included in your current plan.",
    );
  });

  it("requireUsageAllowed throws EntitlementError with an allowance-specific message when the limit is exhausted", async () => {
    const { getCurrentSubscription } = await import("@/lib/billing/queries");
    (getCurrentSubscription as ReturnType<typeof vi.fn>).mockResolvedValue(
      subscription({ entitlements: { tailored_ats_scans_per_month: 10 } }),
    );
    const { createAdminClient } = await import("@/lib/supabase/admin");
    (createAdminClient as ReturnType<typeof vi.fn>).mockReturnValue({
      rpc: vi.fn().mockResolvedValue({ data: [{ allowed: false, used_count: 10 }], error: null }),
    });

    const { requireUsageAllowed } = await import("@/lib/entitlements/service");
    await expect(requireUsageAllowed("user-1", "tailored_ats_scans_per_month")).rejects.toThrow(
      "You've used all 10 of your allowance for this feature this month.",
    );
  });
});

describe("requireFeature", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("throws EntitlementError when the feature isn't included in the plan", async () => {
    const { getCurrentSubscription } = await import("@/lib/billing/queries");
    (getCurrentSubscription as ReturnType<typeof vi.fn>).mockResolvedValue(
      subscription({ entitlements: { cover_letter_generator: false } }),
    );

    const { requireFeature, EntitlementError } = await import("@/lib/entitlements/service");
    await expect(requireFeature("user-1", "cover_letter_generator")).rejects.toThrow(EntitlementError);
  });

  it("resolves without throwing when the feature is included", async () => {
    const { getCurrentSubscription } = await import("@/lib/billing/queries");
    (getCurrentSubscription as ReturnType<typeof vi.fn>).mockResolvedValue(
      subscription({ entitlements: { cover_letter_generator: true } }),
    );

    const { requireFeature } = await import("@/lib/entitlements/service");
    await expect(requireFeature("user-1", "cover_letter_generator")).resolves.toBeUndefined();
  });
});
