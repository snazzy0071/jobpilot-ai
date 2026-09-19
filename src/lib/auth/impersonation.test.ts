import { beforeEach, describe, expect, it, vi } from "vitest";

const cookieStore = new Map<string, string>();

vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({
    get: (name: string) => (cookieStore.has(name) ? { name, value: cookieStore.get(name)! } : undefined),
    set: (name: string, value: string) => {
      cookieStore.set(name, value);
    },
    delete: (name: string) => {
      cookieStore.delete(name);
    },
  })),
}));

type ImpersonationRow = {
  id: string;
  admin_user_id: string;
  target_user_id: string;
  started_at: string;
  ended_at: string | null;
};

/**
 * A minimal, in-memory stand-in for the admin_impersonation_sessions
 * table plus the one RPC call isCurrentlyPermittedToImpersonate makes
 * — enough to exercise every branch in getActiveImpersonation()/
 * startImpersonationSession() without a real database. `permitted`
 * lets each test control whether has_admin_permission would say yes.
 * `auditLogs` collects every admin_audit_logs insert, so tests can assert
 * that sessions ending on their own are audited.
 */
function stubAdminClient(rows: ImpersonationRow[], profiles: Record<string, { role: string }>, permitted: boolean) {
  const updates: Array<{ id: string; patch: Record<string, unknown> }> = [];
  const auditLogs: Array<Record<string, unknown>> = [];

  const client = {
    from(table: string) {
      if (table === "admin_impersonation_sessions") {
        return {
          select: () => ({
            eq: (_col: string, id: string) => ({
              is: () => ({
                maybeSingle: async () => {
                  const row = rows.find((r) => r.id === id && r.ended_at === null);
                  return { data: row ?? null, error: null };
                },
              }),
            }),
          }),
          update: (patch: Record<string, unknown>) => ({
            eq: (col: string, value: string) => {
              // Every still-active row matching the filter: a real UPDATE touches all of them.
              const applyAll = () => {
                const matched = rows.filter((r) => (col === "admin_user_id" ? r.admin_user_id === value : r.id === value) && r.ended_at === null);
                for (const row of matched) {
                  Object.assign(row, patch);
                  updates.push({ id: row.id, patch });
                }
                return matched;
              };
              return {
                // .update().eq().is() awaited directly, or continued with
                // .select() (optionally .maybeSingle()) to read back the rows it closed.
                is: () => ({
                  then: (resolve: (value: unknown) => void) => {
                    applyAll();
                    resolve({ data: null, error: null });
                  },
                  select: () => ({
                    maybeSingle: async () => ({ data: applyAll()[0] ?? null, error: null }),
                    then: (resolve: (value: unknown) => void) => resolve({ data: applyAll(), error: null }),
                  }),
                }),
              };
            },
          }),
          insert: (values: { admin_user_id: string; target_user_id: string }) => ({
            select: () => ({
              single: async () => {
                if (profiles[values.target_user_id]?.role !== "user") {
                  return { data: null, error: { message: "Impersonation target must be a plain user account." } };
                }
                const row: ImpersonationRow = {
                  id: `row-${rows.length + 1}`,
                  admin_user_id: values.admin_user_id,
                  target_user_id: values.target_user_id,
                  started_at: new Date().toISOString(),
                  ended_at: null,
                };
                rows.push(row);
                return { data: { id: row.id }, error: null };
              },
            }),
          }),
        };
      }
      if (table === "profiles") {
        return {
          select: () => ({
            eq: (_col: string, id: string) => ({
              maybeSingle: async () => ({ data: profiles[id] ?? null, error: null }),
            }),
          }),
        };
      }
      if (table === "admin_audit_logs") {
        return {
          insert: async (values: Record<string, unknown>) => {
            auditLogs.push(values);
            return { error: null };
          },
        };
      }
      throw new Error(`Unexpected table in test stub: ${table}`);
    },
    auth: { admin: { getUserById: async (id: string) => ({ data: { user: { email: `${id}@example.test` } }, error: null }) } },
    rpc: async (fn: string) => {
      if (fn === "has_admin_permission") return { data: permitted, error: null };
      throw new Error(`Unexpected rpc in test stub: ${fn}`);
    },
  };

  return { client, updates, auditLogs };
}

describe("getActiveImpersonation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    cookieStore.clear();
  });

  it("returns null when there's no real user id at all", async () => {
    vi.doMock("@/lib/supabase/admin", () => ({
      createAdminClient: () => stubAdminClient([], {}, true).client,
    }));
    vi.resetModules();

    const { getActiveImpersonation } = await import("@/lib/auth/impersonation");
    expect(await getActiveImpersonation(null)).toBeNull();
  });

  it("returns null when no impersonation cookie is set", async () => {
    vi.doMock("@/lib/supabase/admin", () => ({
      createAdminClient: () => stubAdminClient([], {}, true).client,
    }));
    vi.resetModules();

    const { getActiveImpersonation } = await import("@/lib/auth/impersonation");
    expect(await getActiveImpersonation("admin-1")).toBeNull();
  });

  it("rejects a cookie pointing to a real, active row that belongs to a DIFFERENT admin — the core anti-forgery check", async () => {
    const rows: ImpersonationRow[] = [
      { id: "row-1", admin_user_id: "some-other-admin", target_user_id: "target-1", started_at: new Date().toISOString(), ended_at: null },
    ];
    vi.doMock("@/lib/supabase/admin", () => ({
      createAdminClient: () => stubAdminClient(rows, { "some-other-admin": { role: "admin" } }, true).client,
    }));
    vi.resetModules();

    cookieStore.set("jp_impersonation_id", "row-1");

    const { getActiveImpersonation } = await import("@/lib/auth/impersonation");
    // The real, currently-authenticated caller is "admin-1" — a
    // completely different account than the row's own admin_user_id.
    // A normal user who somehow obtained/guessed this cookie value
    // must get nothing from it.
    expect(await getActiveImpersonation("admin-1")).toBeNull();
  });

  it("accepts a valid, matching, unexpired, still-permitted session", async () => {
    const startedAt = new Date().toISOString();
    const rows: ImpersonationRow[] = [
      { id: "row-1", admin_user_id: "admin-1", target_user_id: "target-1", started_at: startedAt, ended_at: null },
    ];
    vi.doMock("@/lib/supabase/admin", () => ({
      createAdminClient: () => stubAdminClient(rows, { "admin-1": { role: "admin" } }, true).client,
    }));
    vi.resetModules();

    cookieStore.set("jp_impersonation_id", "row-1");

    const { getActiveImpersonation } = await import("@/lib/auth/impersonation");
    const result = await getActiveImpersonation("admin-1");
    expect(result).toEqual({ id: "row-1", adminUserId: "admin-1", targetUserId: "target-1", startedAt });
  });

  it("rejects and auto-ends a session older than the max duration", async () => {
    const startedAt = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(); // 2 hours ago
    const rows: ImpersonationRow[] = [
      { id: "row-1", admin_user_id: "admin-1", target_user_id: "target-1", started_at: startedAt, ended_at: null },
    ];
    const stub = stubAdminClient(rows, { "admin-1": { role: "admin" } }, true);
    vi.doMock("@/lib/supabase/admin", () => ({ createAdminClient: () => stub.client }));
    vi.resetModules();

    cookieStore.set("jp_impersonation_id", "row-1");

    const { getActiveImpersonation } = await import("@/lib/auth/impersonation");
    expect(await getActiveImpersonation("admin-1")).toBeNull();
    expect(rows[0].ended_at).not.toBeNull();
    // An expiry is audited like a manual exit, against the right admin and target.
    expect(stub.auditLogs).toHaveLength(1);
    expect(stub.auditLogs[0]).toMatchObject({
      actor_id: "admin-1",
      action: "user.impersonate_end",
      entity_type: "user",
      entity_id: "target-1",
      metadata: expect.objectContaining({ impersonationSessionId: "row-1", reason: "expired" }),
    });
  });

  it("rejects and auto-ends a session once the admin no longer holds the permission (revoked mid-session)", async () => {
    const rows: ImpersonationRow[] = [
      { id: "row-1", admin_user_id: "admin-1", target_user_id: "target-1", started_at: new Date().toISOString(), ended_at: null },
    ];
    const stub = stubAdminClient(rows, { "admin-1": { role: "admin" } }, false);
    vi.doMock("@/lib/supabase/admin", () => ({ createAdminClient: () => stub.client }));
    vi.resetModules();

    cookieStore.set("jp_impersonation_id", "row-1");

    const { getActiveImpersonation } = await import("@/lib/auth/impersonation");
    expect(await getActiveImpersonation("admin-1")).toBeNull();
    expect(rows[0].ended_at).not.toBeNull();
    expect(stub.auditLogs).toHaveLength(1);
    expect(stub.auditLogs[0]).toMatchObject({ action: "user.impersonate_end", metadata: expect.objectContaining({ reason: "permission_revoked" }) });
  });

  it("does not double-audit a session that a concurrent request already closed", async () => {
    const rows: ImpersonationRow[] = [
      { id: "row-1", admin_user_id: "admin-1", target_user_id: "target-1", started_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(), ended_at: null },
    ];
    const stub = stubAdminClient(rows, { "admin-1": { role: "admin" } }, true);
    vi.doMock("@/lib/supabase/admin", () => ({ createAdminClient: () => stub.client }));
    vi.resetModules();
    cookieStore.set("jp_impersonation_id", "row-1");

    const { getActiveImpersonation } = await import("@/lib/auth/impersonation");
    await getActiveImpersonation("admin-1");
    // A second request carrying the same cookie now finds no active row: nothing left to close, nothing more to record.
    cookieStore.set("jp_impersonation_id", "row-1");
    await getActiveImpersonation("admin-1");
    expect(stub.auditLogs).toHaveLength(1);
  });

  it("rejects once the real account's role is no longer 'admin' at all, even if manage_users would still say yes", async () => {
    const rows: ImpersonationRow[] = [
      { id: "row-1", admin_user_id: "demoted-1", target_user_id: "target-1", started_at: new Date().toISOString(), ended_at: null },
    ];
    vi.doMock("@/lib/supabase/admin", () => ({
      createAdminClient: () => stubAdminClient(rows, { "demoted-1": { role: "user" } }, true).client,
    }));
    vi.resetModules();

    cookieStore.set("jp_impersonation_id", "row-1");

    const { getActiveImpersonation } = await import("@/lib/auth/impersonation");
    expect(await getActiveImpersonation("demoted-1")).toBeNull();
  });
});

describe("startImpersonationSession — privilege-escalation guards", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    cookieStore.clear();
  });

  it("refuses to impersonate an admin account", async () => {
    vi.doMock("@/lib/supabase/admin", () => ({
      createAdminClient: () => stubAdminClient([], { "target-admin": { role: "admin" } }, true).client,
    }));
    vi.resetModules();

    const { startImpersonationSession } = await import("@/lib/auth/impersonation");
    const result = await startImpersonationSession("admin-1", "target-admin");
    expect(result).toEqual({ error: expect.stringContaining("Only plain user accounts") });
  });

  it("refuses to impersonate an institution_admin account", async () => {
    vi.doMock("@/lib/supabase/admin", () => ({
      createAdminClient: () => stubAdminClient([], { "target-inst": { role: "institution_admin" } }, true).client,
    }));
    vi.resetModules();

    const { startImpersonationSession } = await import("@/lib/auth/impersonation");
    const result = await startImpersonationSession("admin-1", "target-inst");
    expect(result).toEqual({ error: expect.stringContaining("Only plain user accounts") });
  });

  it("refuses self-impersonation", async () => {
    vi.doMock("@/lib/supabase/admin", () => ({
      createAdminClient: () => stubAdminClient([], { "admin-1": { role: "admin" } }, true).client,
    }));
    vi.resetModules();

    const { startImpersonationSession } = await import("@/lib/auth/impersonation");
    const result = await startImpersonationSession("admin-1", "admin-1");
    expect(result).toEqual({ error: expect.stringContaining("own account") });
  });

  it("refuses a target that no longer exists", async () => {
    vi.doMock("@/lib/supabase/admin", () => ({
      createAdminClient: () => stubAdminClient([], {}, true).client,
    }));
    vi.resetModules();

    const { startImpersonationSession } = await import("@/lib/auth/impersonation");
    const result = await startImpersonationSession("admin-1", "ghost-user");
    expect(result).toEqual({ error: expect.stringContaining("no longer exists") });
  });

  it("closes and audits the admin's earlier active session as superseded", async () => {
    const rows: ImpersonationRow[] = [
      { id: "old-row", admin_user_id: "admin-1", target_user_id: "target-old", started_at: new Date().toISOString(), ended_at: null },
    ];
    const stub = stubAdminClient(rows, { "target-1": { role: "user" } }, true);
    vi.doMock("@/lib/supabase/admin", () => ({ createAdminClient: () => stub.client }));
    vi.resetModules();

    const { startImpersonationSession } = await import("@/lib/auth/impersonation");
    await startImpersonationSession("admin-1", "target-1");
    expect(rows.find((r) => r.id === "old-row")?.ended_at).not.toBeNull();
    expect(stub.auditLogs).toHaveLength(1);
    expect(stub.auditLogs[0]).toMatchObject({
      actor_id: "admin-1",
      action: "user.impersonate_end",
      entity_id: "target-old",
      metadata: expect.objectContaining({ impersonationSessionId: "old-row", reason: "superseded" }),
    });
  });

  it("succeeds for a genuine plain-user target and sets the cookie", async () => {
    vi.doMock("@/lib/supabase/admin", () => ({
      createAdminClient: () => stubAdminClient([], { "target-1": { role: "user" } }, true).client,
    }));
    vi.resetModules();

    const { startImpersonationSession, IMPERSONATION_COOKIE } = await import("@/lib/auth/impersonation");
    const result = await startImpersonationSession("admin-1", "target-1");
    expect(result).not.toHaveProperty("error");
    expect(cookieStore.get(IMPERSONATION_COOKIE)).toBe((result as { id: string }).id);
  });
});
