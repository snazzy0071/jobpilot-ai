import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/ai/rate-limit", () => ({ consumeRateLimit: vi.fn() }));
vi.mock("@/lib/entitlements/service", () => ({
  requireFeature: vi.fn(),
  requireUsageAllowed: vi.fn(),
  releaseUsage: vi.fn(),
  EntitlementError: class EntitlementError extends Error {},
}));
vi.mock("@/lib/ai/service", () => ({ generateText: vi.fn(), generateStructured: vi.fn() }));

/**
 * The real value this suite is checking: `runAtsScan`
 * (src/lib/cvs/ats-actions.ts) and every other metered AI feature
 * enforce their monthly limit purely by calling
 * generateStructuredGated({ meteredKey: ... }) — the limit enforcement
 * *is* this gateway's guard ordering, not something each feature
 * re-implements. A stateful counter here (not a canned mock return)
 * proves the atomic-consume-then-refund-on-failure cycle actually holds
 * across a real call sequence through the gateway, the same reasoning
 * src/lib/billing/sync.test.ts applies to Stripe idempotency.
 */
function stubEntitlements(limit: number) {
  let used = 0;
  return {
    used: () => used,
    consume: async () => {
      if (used >= limit) return { allowed: false, limit, used, remaining: 0 };
      used += 1;
      return { allowed: true, limit, used, remaining: limit - used };
    },
    release: async () => {
      used = Math.max(0, used - 1);
    },
  };
}

describe("generateStructuredGated — usage-limit orchestration (the ATS scan limit path)", () => {
  beforeEach(() => vi.clearAllMocks());

  it("consumes one unit of usage before the AI call, and never refunds it when the call succeeds", async () => {
    const { consumeRateLimit } = await import("@/lib/ai/rate-limit");
    (consumeRateLimit as ReturnType<typeof vi.fn>).mockResolvedValue({ allowed: true });
    const entitlements = stubEntitlements(1);
    const { requireUsageAllowed, releaseUsage } = await import("@/lib/entitlements/service");
    (requireUsageAllowed as ReturnType<typeof vi.fn>).mockImplementation(entitlements.consume);
    (releaseUsage as ReturnType<typeof vi.fn>).mockImplementation(entitlements.release);
    const { generateStructured } = await import("@/lib/ai/service");
    (generateStructured as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: true });

    const { generateStructuredGated } = await import("@/lib/ai/gateway");
    const result = await generateStructuredGated(
      { userId: "user-1", meteredKey: "tailored_ats_scans_per_month" },
      { operation: "ats_scan", prompt: "x", schema: { safeParse: () => ({ success: true, data: {} }) } as never },
    );

    expect(result).toEqual({ ok: true });
    expect(entitlements.used()).toBe(1);
    expect(releaseUsage).not.toHaveBeenCalled();
  });

  it("refunds the consumed usage when the AI call itself fails, so a failure never permanently costs the allowance", async () => {
    const { consumeRateLimit } = await import("@/lib/ai/rate-limit");
    (consumeRateLimit as ReturnType<typeof vi.fn>).mockResolvedValue({ allowed: true });
    const entitlements = stubEntitlements(1);
    const { requireUsageAllowed, releaseUsage } = await import("@/lib/entitlements/service");
    (requireUsageAllowed as ReturnType<typeof vi.fn>).mockImplementation(entitlements.consume);
    (releaseUsage as ReturnType<typeof vi.fn>).mockImplementation(entitlements.release);
    const { generateStructured } = await import("@/lib/ai/service");
    (generateStructured as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("model call failed"));

    const { generateStructuredGated } = await import("@/lib/ai/gateway");
    await expect(
      generateStructuredGated(
        { userId: "user-1", meteredKey: "tailored_ats_scans_per_month" },
        { operation: "ats_scan", prompt: "x", schema: {} as never },
      ),
    ).rejects.toThrow("model call failed");

    expect(entitlements.used()).toBe(0); // consumed then refunded — net zero
    expect(releaseUsage).toHaveBeenCalledTimes(1);
  });

  it("blocks a second call once the monthly limit is exhausted, without ever reaching the AI service", async () => {
    const { consumeRateLimit } = await import("@/lib/ai/rate-limit");
    (consumeRateLimit as ReturnType<typeof vi.fn>).mockResolvedValue({ allowed: true });
    const entitlements = stubEntitlements(1);
    const { requireUsageAllowed } = await import("@/lib/entitlements/service");
    (requireUsageAllowed as ReturnType<typeof vi.fn>).mockImplementation(async () => {
      const outcome = await entitlements.consume();
      if (!outcome.allowed) throw new (await import("@/lib/entitlements/service")).EntitlementError("limit reached");
      return outcome;
    });
    const { generateStructured } = await import("@/lib/ai/service");
    (generateStructured as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: true });

    const { generateStructuredGated } = await import("@/lib/ai/gateway");
    const guard = { userId: "user-1", meteredKey: "tailored_ats_scans_per_month" } as const;
    const options = { operation: "ats_scan", prompt: "x", schema: {} as never };

    await generateStructuredGated(guard, options); // first scan: allowed
    await expect(generateStructuredGated(guard, options)).rejects.toThrow("limit reached"); // second: blocked
    expect(generateStructured).toHaveBeenCalledTimes(1); // the AI was only ever actually called once
  });

  it("checks the rate limit before entitlements — a rate-limited request never even reaches the usage check", async () => {
    const { consumeRateLimit } = await import("@/lib/ai/rate-limit");
    (consumeRateLimit as ReturnType<typeof vi.fn>).mockResolvedValue({ allowed: false });
    const { requireUsageAllowed } = await import("@/lib/entitlements/service");

    const { generateStructuredGated } = await import("@/lib/ai/gateway");
    await expect(
      generateStructuredGated({ userId: "user-1", meteredKey: "tailored_ats_scans_per_month" }, { operation: "ats_scan", prompt: "x", schema: {} as never }),
    ).rejects.toThrow(/sending requests too quickly/);

    expect(requireUsageAllowed).not.toHaveBeenCalled();
  });

  it("skips every guard for an anonymous call, and passes userId: null through to the AI service", async () => {
    const { consumeRateLimit } = await import("@/lib/ai/rate-limit");
    const { requireFeature, requireUsageAllowed } = await import("@/lib/entitlements/service");
    const { generateStructured } = await import("@/lib/ai/service");
    (generateStructured as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: true });

    const { generateStructuredGated } = await import("@/lib/ai/gateway");
    await generateStructuredGated({ anonymous: true }, { operation: "quick_scan", prompt: "x", schema: {} as never });

    expect(consumeRateLimit).not.toHaveBeenCalled();
    expect(requireFeature).not.toHaveBeenCalled();
    expect(requireUsageAllowed).not.toHaveBeenCalled();
    expect(generateStructured).toHaveBeenCalledWith(expect.objectContaining({ userId: null }));
  });

  it("never calls releaseUsage for a call with no meteredKey at all, even when the AI call fails", async () => {
    const { consumeRateLimit } = await import("@/lib/ai/rate-limit");
    (consumeRateLimit as ReturnType<typeof vi.fn>).mockResolvedValue({ allowed: true });
    const { requireFeature, requireUsageAllowed, releaseUsage } = await import("@/lib/entitlements/service");
    const { generateStructured } = await import("@/lib/ai/service");
    (generateStructured as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("boom"));

    const { generateStructuredGated } = await import("@/lib/ai/gateway");
    await expect(
      generateStructuredGated({ userId: "user-1" }, { operation: "no_metered_key_op", prompt: "x", schema: {} as never }),
    ).rejects.toThrow("boom");

    expect(requireFeature).not.toHaveBeenCalled();
    expect(requireUsageAllowed).not.toHaveBeenCalled();
    expect(releaseUsage).not.toHaveBeenCalled();
  });
});
