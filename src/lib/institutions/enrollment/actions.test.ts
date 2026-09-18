import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth/session", () => ({ requireUser: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn() }));

/**
 * `redeemInstitutionAccessCode` (src/lib/institutions/enrollment/
 * actions.ts) is a thin wrapper around the real redeem_access_code() SQL
 * function (see supabase/tests/60_access_code_redemption.sql for that
 * function's own one-time-use/expiry/atomicity guarantees, which need a
 * real Postgres and can't be meaningfully tested by mocking the RPC
 * call). What *is* worth testing here, with the RPC boundary mocked, is
 * the action's own job: correctly telling apart the RPC's four distinct
 * outcomes (a seat-capacity error, any other error, a clean "invalid/
 * expired/exhausted" null, and a real success) and mapping each to the
 * right caller-facing result.
 */
describe("redeemInstitutionAccessCode", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    const { requireUser } = await import("@/lib/auth/session");
    (requireUser as ReturnType<typeof vi.fn>).mockResolvedValue({ id: "user-1" });
  });

  async function mockRpc(result: { data: unknown; error: { message: string } | null }) {
    const { createAdminClient } = await import("@/lib/supabase/admin");
    (createAdminClient as ReturnType<typeof vi.fn>).mockReturnValue({ rpc: vi.fn().mockResolvedValue(result) });
  }

  it("rejects an empty code before ever calling the RPC", async () => {
    const { createAdminClient } = await import("@/lib/supabase/admin");
    const { redeemInstitutionAccessCode } = await import("@/lib/institutions/enrollment/actions");

    const result = await redeemInstitutionAccessCode({ code: "" });
    expect(result).toEqual({ error: "Enter an access code." });
    expect(createAdminClient).not.toHaveBeenCalled();
  });

  it("maps a null RPC result to a clear invalid/expired/exhausted message", async () => {
    await mockRpc({ data: null, error: null });
    const { redeemInstitutionAccessCode } = await import("@/lib/institutions/enrollment/actions");

    const result = await redeemInstitutionAccessCode({ code: "DEAD-CODE" });
    expect(result).toEqual({ error: "That access code is invalid, expired, or already used." });
  });

  it("gives a seat-capacity-specific message when the RPC's error names it, rather than the generic one", async () => {
    await mockRpc({ data: null, error: { message: "No seats remaining on this institution's licence." } });
    const { redeemInstitutionAccessCode } = await import("@/lib/institutions/enrollment/actions");

    const result = await redeemInstitutionAccessCode({ code: "GOOD-CODE" });
    expect(result).toEqual({
      error: expect.stringContaining("the institution has no seats available right now"),
    });
  });

  it("falls back to a generic retry message for any other RPC error", async () => {
    await mockRpc({ data: null, error: { message: "connection reset by peer" } });
    const { redeemInstitutionAccessCode } = await import("@/lib/institutions/enrollment/actions");

    const result = await redeemInstitutionAccessCode({ code: "GOOD-CODE" });
    expect(result).toEqual({ error: "Couldn't redeem that code — try again." });
  });

  it("returns the real institutionId and institutionJoined flag on success", async () => {
    await mockRpc({ data: { institution_id: "inst-1", institution_joined: true }, error: null });
    const { redeemInstitutionAccessCode } = await import("@/lib/institutions/enrollment/actions");

    const result = await redeemInstitutionAccessCode({ code: "GOOD-CODE" });
    expect(result).toEqual({ institutionId: "inst-1", institutionJoined: true });
  });

  it("reports institutionJoined: false for a plan-only code (no institution attached at all)", async () => {
    await mockRpc({ data: { institution_id: null, institution_joined: false }, error: null });
    const { redeemInstitutionAccessCode } = await import("@/lib/institutions/enrollment/actions");

    const result = await redeemInstitutionAccessCode({ code: "PLAN-ONLY-CODE" });
    expect(result).toEqual({ institutionId: null, institutionJoined: false });
  });
});
