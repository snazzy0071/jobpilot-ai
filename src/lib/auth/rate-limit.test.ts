import { beforeEach, describe, expect, it, vi } from "vitest";

// Sign-in must not lock everyone out when the rate-limit store itself is broken (bad service-role key, missing migration):
// that used to show "Too many attempts" on the very first login. A real over-the-limit result must still block.

const rpc = vi.fn();

vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({ rpc }) }));
vi.mock("next/headers", () => ({ headers: async () => new Headers({ "x-forwarded-for": "203.0.113.7" }) }));

import {
  consumeSignInAccountRateLimit,
  consumeSignInRateLimit,
  consumeSignUpRateLimit,
} from "@/lib/auth/rate-limit";

describe("sign-in rate limits", () => {
  beforeEach(() => {
    rpc.mockReset();
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("lets a sign-in through when the counter store errors", async () => {
    rpc.mockResolvedValue({ data: null, error: { message: "Invalid API key" } });
    expect(await consumeSignInRateLimit()).toBe(true);
    expect(await consumeSignInAccountRateLimit("admin@example.com")).toBe(true);
  });

  it("still blocks a sign-in that is genuinely over the limit", async () => {
    rpc.mockResolvedValue({ data: [{ allowed: false, request_count: 10 }], error: null });
    expect(await consumeSignInRateLimit()).toBe(false);
    expect(await consumeSignInAccountRateLimit("admin@example.com")).toBe(false);
  });

  it("allows a sign-in under the limit", async () => {
    rpc.mockResolvedValue({ data: [{ allowed: true, request_count: 1 }], error: null });
    expect(await consumeSignInRateLimit()).toBe(true);
  });

  it("keeps email-sending forms fail-closed when the store errors", async () => {
    rpc.mockResolvedValue({ data: null, error: { message: "boom" } });
    expect(await consumeSignUpRateLimit()).toBe(false);
  });
});
