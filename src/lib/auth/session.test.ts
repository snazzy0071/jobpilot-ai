import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn(), createRealSessionClient: vi.fn() }));
// None of these pre-existing tests are about impersonation — stubbed to
// "never active" so getEffectiveUser()/getEffectiveProfile() fall
// straight through to the real identity, same as before this feature
// existed. src/lib/auth/impersonation.test.ts covers the impersonation
// logic itself.
vi.mock("@/lib/auth/impersonation", () => ({
  getActiveImpersonation: vi.fn().mockResolvedValue(null),
  IMPERSONATION_COOKIE: "jp_impersonation_id",
}));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn() }));

type ProfileRow = { role: string; onboarding_status: string; full_name?: string } | null;

/** A single-table stub: `.from(table).select().eq().single()`/`.maybeSingle()` all resolve to `result`, and `auth.getUser()` resolves to `authResult`. Real `redeem_access_code`-style chaining isn't needed here — session.ts only ever does one filtered select per call. */
function stubSupabase(authUser: { id: string; email?: string } | null, profile: ProfileRow) {
  const builder: Record<string, (...args: never[]) => unknown> = {};
  const chain = () => builder;
  builder.select = chain;
  builder.eq = chain;
  builder.single = () => Promise.resolve({ data: profile, error: null });
  builder.maybeSingle = () => Promise.resolve({ data: profile, error: null });
  return {
    auth: { getUser: () => Promise.resolve({ data: { user: authUser } }) },
    from: (_table: string) => {
      if (_table === "institution_members") {
        // requireInstitutionAdmin's second lookup — reuses the same
        // `profile` slot's presence as "a real membership exists" for
        // tests that need it; overridden per-test via a dedicated stub
        // where that distinction matters (see the institution-admin
        // describe block below).
        return builder;
      }
      return builder;
    },
  };
}

/** Sets both session.ts's client factories to the same stub — getCurrentUser() now calls createRealSessionClient() directly, while getEffectiveProfile()/requireInstitutionAdmin() call createClient() (which, unmocked-impersonation, is equivalent for these tests). */
async function stubBothClients(stub: ReturnType<typeof stubSupabase>) {
  const { createClient, createRealSessionClient } = await import("@/lib/supabase/server");
  (createClient as ReturnType<typeof vi.fn>).mockResolvedValue(stub);
  (createRealSessionClient as ReturnType<typeof vi.fn>).mockResolvedValue(stub);
}

/** Reads the target path Next's real `redirect()` encoded, from the error it throws — the exact same mechanism a real request-time redirect uses, not a mocked stand-in for it. */
function redirectTargetOf(err: unknown): string {
  const digest = (err as { digest?: string } | undefined)?.digest ?? "";
  // Format: "NEXT_REDIRECT;<type>;<url>;<statusCode>;"
  const parts = digest.split(";");
  return parts[2] ?? "";
}

describe("getCurrentUser / requireUser", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns null when there is no session, without redirecting", async () => {
    await stubBothClients(stubSupabase(null, null));

    const { getCurrentUser } = await import("@/lib/auth/session");
    expect(await getCurrentUser()).toBeNull();
  });

  it("returns the real user object when a session exists", async () => {
    await stubBothClients(stubSupabase({ id: "user-1", email: "a@b.com" }, null));

    const { getCurrentUser } = await import("@/lib/auth/session");
    expect(await getCurrentUser()).toEqual({ id: "user-1", email: "a@b.com" });
  });

  it("requireUser redirects to /login when there is no session", async () => {
    await stubBothClients(stubSupabase(null, null));

    const { requireUser } = await import("@/lib/auth/session");
    await expect(requireUser()).rejects.toSatisfy((err: unknown) => redirectTargetOf(err) === "/login");
  });

  it("requireUser returns the user, unredirected, when a session exists", async () => {
    await stubBothClients(stubSupabase({ id: "user-1" }, null));

    const { requireUser } = await import("@/lib/auth/session");
    expect(await requireUser()).toEqual({ id: "user-1" });
  });
});

describe("requireOnboardedUser", () => {
  beforeEach(() => vi.clearAllMocks());

  it("redirects to /login when there is no session", async () => {
    await stubBothClients(stubSupabase(null, null));

    const { requireOnboardedUser } = await import("@/lib/auth/session");
    await expect(requireOnboardedUser()).rejects.toSatisfy((err: unknown) => redirectTargetOf(err) === "/login");
  });

  it("redirects to /onboarding when the profile hasn't completed it yet", async () => {
    await stubBothClients(stubSupabase({ id: "user-1" }, { role: "user", onboarding_status: "in_progress" }));

    const { requireOnboardedUser } = await import("@/lib/auth/session");
    await expect(requireOnboardedUser()).rejects.toSatisfy((err: unknown) => redirectTargetOf(err) === "/onboarding");
  });

  it("returns the user and profile, unredirected, once onboarding is completed", async () => {
    await stubBothClients(stubSupabase({ id: "user-1" }, { role: "user", onboarding_status: "completed" }));

    const { requireOnboardedUser } = await import("@/lib/auth/session");
    const result = await requireOnboardedUser();
    expect(result.user).toEqual({ id: "user-1" });
    expect(result.profile?.onboarding_status).toBe("completed");
  });

  it("does not redirect to /onboarding when there is simply no profile row at all", async () => {
    // Mirrors the real guard's own `if (profile && ...)` check — a
    // missing profile isn't treated the same as "not yet onboarded".
    await stubBothClients(stubSupabase({ id: "user-1" }, null));

    const { requireOnboardedUser } = await import("@/lib/auth/session");
    const result = await requireOnboardedUser();
    expect(result.profile).toBeNull();
  });
});

describe("requireAdmin", () => {
  beforeEach(() => vi.clearAllMocks());

  it("redirects to /login when there is no session", async () => {
    await stubBothClients(stubSupabase(null, null));

    const { requireAdmin } = await import("@/lib/auth/session");
    await expect(requireAdmin()).rejects.toSatisfy((err: unknown) => redirectTargetOf(err) === "/login");
  });

  it("redirects to /dashboard when the signed-in user is not an admin", async () => {
    await stubBothClients(stubSupabase({ id: "user-1" }, { role: "user", onboarding_status: "completed" }));

    const { requireAdmin } = await import("@/lib/auth/session");
    await expect(requireAdmin()).rejects.toSatisfy((err: unknown) => redirectTargetOf(err) === "/dashboard");
  });

  it("returns the user and profile, unredirected, for a real admin", async () => {
    await stubBothClients(stubSupabase({ id: "user-1" }, { role: "admin", onboarding_status: "completed" }));

    const { requireAdmin } = await import("@/lib/auth/session");
    const result = await requireAdmin();
    expect(result.profile?.role).toBe("admin");
  });
});

describe("requireInstitutionAdmin", () => {
  beforeEach(() => vi.clearAllMocks());

  function stubWithMembership(profile: ProfileRow, membership: { institution_id: string } | null) {
    const base = stubSupabase({ id: "user-1" }, profile);
    return {
      ...base,
      from: (table: string) => {
        if (table === "institution_members") {
          return {
            select: () => ({
              eq: () => ({
                eq: () => ({ maybeSingle: () => Promise.resolve({ data: membership, error: null }) }),
              }),
            }),
          };
        }
        return base.from(table);
      },
    };
  }

  it("redirects to /dashboard when the profile role isn't institution_admin at all", async () => {
    await stubBothClients(stubWithMembership({ role: "user", onboarding_status: "completed" }, null));

    const { requireInstitutionAdmin } = await import("@/lib/auth/session");
    await expect(requireInstitutionAdmin()).rejects.toSatisfy((err: unknown) => redirectTargetOf(err) === "/dashboard");
  });

  it("redirects to /dashboard for an institution_admin-flagged profile with no real membership row (orphaned account)", async () => {
    await stubBothClients(stubWithMembership({ role: "institution_admin", onboarding_status: "completed" }, null));

    const { requireInstitutionAdmin } = await import("@/lib/auth/session");
    await expect(requireInstitutionAdmin()).rejects.toSatisfy((err: unknown) => redirectTargetOf(err) === "/dashboard");
  });

  it("resolves the real institutionId for a properly provisioned institution admin", async () => {
    await stubBothClients(stubWithMembership({ role: "institution_admin", onboarding_status: "completed" }, { institution_id: "inst-1" }));

    const { requireInstitutionAdmin } = await import("@/lib/auth/session");
    const result = await requireInstitutionAdmin();
    expect(result.institutionId).toBe("inst-1");
  });
});

describe("getEffectiveUser / getEffectiveProfile (impersonation)", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns the real user/profile when no impersonation is active", async () => {
    await stubBothClients(stubSupabase({ id: "admin-1", email: "admin@x.com" }, { role: "admin", onboarding_status: "completed" }));

    const { getActiveImpersonation } = await import("@/lib/auth/impersonation");
    (getActiveImpersonation as ReturnType<typeof vi.fn>).mockResolvedValue(null);

    const { getEffectiveUser, getEffectiveProfile } = await import("@/lib/auth/session");
    expect(await getEffectiveUser()).toEqual({ id: "admin-1", email: "admin@x.com" });
    expect((await getEffectiveProfile())?.role).toBe("admin");
  });

  it("returns the impersonation TARGET's identity when an active session exists", async () => {
    await stubBothClients(stubSupabase({ id: "admin-1", email: "admin@x.com" }, { role: "user", onboarding_status: "completed" }));

    const { getActiveImpersonation } = await import("@/lib/auth/impersonation");
    (getActiveImpersonation as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "imp-1",
      adminUserId: "admin-1",
      targetUserId: "target-1",
      startedAt: new Date().toISOString(),
    });

    const { createAdminClient } = await import("@/lib/supabase/admin");
    (createAdminClient as ReturnType<typeof vi.fn>).mockReturnValue({
      auth: {
        admin: {
          getUserById: () => Promise.resolve({ data: { user: { id: "target-1", email: "target@x.com" } }, error: null }),
        },
      },
    });

    const { createClient } = await import("@/lib/supabase/server");
    (createClient as ReturnType<typeof vi.fn>).mockResolvedValue(
      stubSupabase({ id: "target-1" }, { role: "user", onboarding_status: "completed", full_name: "Target Person" }),
    );

    const { getEffectiveUser, getEffectiveProfile } = await import("@/lib/auth/session");
    const effectiveUser = await getEffectiveUser();
    expect(effectiveUser?.id).toBe("target-1");
    expect(effectiveUser?.email).toBe("target@x.com");

    const effectiveProfile = await getEffectiveProfile();
    expect((effectiveProfile as { full_name?: string } | null)?.full_name).toBe("Target Person");
  });
});
