import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`REDIRECT:${url}`);
  },
}));
vi.mock("@/lib/auth/session", () => ({ requireUser: vi.fn().mockResolvedValue({ id: "user-1", email: "u@example.test" }) }));

const { requireFeature, FakeEntitlementError } = vi.hoisted(() => ({ requireFeature: vi.fn(), FakeEntitlementError: class extends Error {} }));
vi.mock("@/lib/entitlements/service", () => ({
  requireFeature: (...args: unknown[]) => requireFeature(...args),
  getCurrentCalendarPeriod: () => ({ periodStart: "2026-09-01T00:00:00.000Z", periodEnd: "2026-10-01T00:00:00.000Z" }),
  EntitlementError: FakeEntitlementError,
}));

const create = vi.hoisted(() => vi.fn());
vi.mock("@/lib/stripe/client", () => ({ getStripeClient: () => ({ checkout: { sessions: { create } } }) }));
vi.mock("@/lib/stripe/prices", () => ({ getVoiceTopupPriceId: () => "price_topup" }));
vi.mock("@/lib/stripe/customer", () => ({ resolveStripeCustomerId: vi.fn().mockResolvedValue("cus_1") }));

import { purchaseVoiceTopup } from "@/lib/interviews/topup-actions";
import { VOICE_TOPUP_CREDITS } from "@/lib/interviews/topup-config";

beforeEach(() => {
  vi.clearAllMocks();
  create.mockResolvedValue({ url: "https://checkout.stripe.test/topup" });
});

describe("purchaseVoiceTopup return URL", () => {
  it("only ever sends the buyer back to this site, whatever path the caller supplies", async () => {
    requireFeature.mockResolvedValue(undefined);
    for (const hostile of ["@evil.example/x", "//evil.example", "https://evil.example", "/\\evil.example"]) {
      create.mockClear();
      await expect(purchaseVoiceTopup(hostile, undefined, new FormData())).rejects.toThrow("REDIRECT:");
      const args = create.mock.calls[0][0];
      for (const key of ["success_url", "cancel_url"]) {
        const url = new URL(args[key]);
        expect(url.origin, hostile).toBe(new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "https://jobpilotai.com").origin);
        expect(url.pathname).toBe("/dashboard/settings");
      }
    }
  });
  it("adds the outcome as a query parameter next to an existing one", async () => {
    requireFeature.mockResolvedValue(undefined);
    await expect(purchaseVoiceTopup("/dashboard/settings?tab=billing", undefined, new FormData())).rejects.toThrow("REDIRECT:");
    const url = new URL(create.mock.calls[0][0].success_url);
    expect(url.searchParams.get("tab")).toBe("billing");
    expect(url.searchParams.get("topup")).toBe("success");
  });
});

describe("purchaseVoiceTopup", () => {
  it("is refused server-side for a plan without top-ups, before Stripe is touched", async () => {
    requireFeature.mockRejectedValue(new FakeEntitlementError("This feature isn't included in your current plan."));
    expect(await purchaseVoiceTopup("/dashboard/settings", undefined, new FormData())).toEqual({ error: "This feature isn't included in your current plan." });
    expect(requireFeature).toHaveBeenCalledWith("user-1", "voice_topups_allowed");
    expect(create).not.toHaveBeenCalled();
  });
  it("creates a one-time payment checkout whose credits and period are set by the server, not the client", async () => {
    requireFeature.mockResolvedValue(undefined);
    await expect(purchaseVoiceTopup("/dashboard/settings", undefined, new FormData())).rejects.toThrow("REDIRECT:https://checkout.stripe.test/topup");
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        mode: "payment",
        line_items: [{ price: "price_topup", quantity: 1 }],
        client_reference_id: "user-1",
        metadata: { supabase_user_id: "user-1", kind: "voice_topup", period_start: "2026-09-01T00:00:00.000Z", credits: String(VOICE_TOPUP_CREDITS) },
      }),
    );
  });
});
