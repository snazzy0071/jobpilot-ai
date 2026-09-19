import "server-only";
import { cookies } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";

// Deliberately not imported from src/lib/auth/session.ts or
// src/lib/supabase/server.ts, and does not import either of them —
// both of those files import FROM this one (session.ts to resolve the
// "effective" user during impersonation, server.ts to decide whether
// to hand back a service-role client). Importing either back would
// create a module cycle, so every check here takes the real,
// already-authenticated user id as a plain parameter instead of
// resolving it itself.

export const IMPERSONATION_COOKIE = "jp_impersonation_id";
const MAX_IMPERSONATION_DURATION_MS = 60 * 60 * 1000; // 1 hour — a deliberately short leash, not configurable; see getActiveImpersonation.

const IMPERSONATION_COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
};

export type ActiveImpersonation = {
  id: string;
  adminUserId: string;
  targetUserId: string;
  startedAt: string;
};

/**
 * Re-verifies, server-side, that this specific real admin still holds
 * both the base 'admin' role and the manage_users permission — called
 * on every single read of an active impersonation session, not just at
 * start, so a permission revoked mid-session ends access on the very
 * next request rather than whenever the admin happens to sign out.
 * Uses the DB's own has_admin_permission() (migration 0075) via RPC
 * rather than importing src/lib/admin/permissions.ts, which imports
 * session.ts and would reintroduce the same cycle this file exists to
 * avoid.
 */
async function isCurrentlyPermittedToImpersonate(realUserId: string): Promise<boolean> {
  const admin = createAdminClient();
  const { data: profile } = await admin.from("profiles").select("role").eq("id", realUserId).maybeSingle();
  if (profile?.role !== "admin") return false;

  const { data: permitted } = await admin.rpc("has_admin_permission", {
    p_user_id: realUserId,
    p_permission: "manage_users",
  });
  return permitted === true;
}

type EndableRow = { id: string; admin_user_id: string; target_user_id: string; started_at: string };

/**
 * Every "View as user" session that ends must leave an audit record, not
 * only the ones the admin ended by hand (that path logs its own
 * `user.impersonate_end` in the exit route). Sessions that end on their
 * own — expiry, a revoked permission, or being replaced by a newer one —
 * are recorded here. Written through the service role: this can run while
 * the admin isn't the one making the request (a stale cookie reaching a
 * page), so the audit table's "actors log their own entries" policy
 * isn't the right door. Best-effort like every audit write in this app —
 * it must never turn a fail-closed session end into an error.
 */
async function recordAutomaticEnd(row: EndableRow, endedAt: string, reason: string): Promise<void> {
  try {
    const admin = createAdminClient();
    const [{ data: actor }, { data: target }] = await Promise.all([
      admin.auth.admin.getUserById(row.admin_user_id),
      admin.auth.admin.getUserById(row.target_user_id),
    ]);
    await admin.from("admin_audit_logs").insert({
      actor_id: row.admin_user_id,
      actor_email: actor.user?.email ?? null,
      action: "user.impersonate_end",
      entity_type: "user",
      entity_id: row.target_user_id,
      metadata: {
        impersonationSessionId: row.id,
        targetEmail: target.user?.email ?? null,
        startedAt: row.started_at,
        endedAt,
        reason,
      },
    });
  } catch (error) {
    console.error("Could not record automatic impersonation end:", error);
  }
}

async function endImpersonationRow(row: EndableRow, reason: string): Promise<void> {
  const admin = createAdminClient();
  const endedAt = new Date().toISOString();
  const { data: ended } = await admin
    .from("admin_impersonation_sessions")
    .update({ ended_at: endedAt, end_reason: reason })
    .eq("id", row.id)
    .is("ended_at", null)
    .select("id")
    .maybeSingle();
  // Only the caller that actually closed the row logs it, so concurrent requests can't double-record.
  if (ended) await recordAutomaticEnd(row, endedAt, reason);
}

/**
 * The one function every impersonation-aware read goes through
 * (src/lib/auth/session.ts's getEffectiveUser/getEffectiveProfile,
 * src/lib/supabase/server.ts's createClient). Fails closed — any
 * missing/invalid/stale/no-longer-permitted state returns null
 * ("treat as not impersonating"), never throws, since a lookup hiccup
 * must never accidentally grant or extend access.
 *
 * `realUserId` must be the id from a fresh, real
 * `supabase.auth.getUser()` call on the actual session cookies — never
 * a value trusted from anywhere else. The cookie this reads is just a
 * pointer to a row; the row is only ever honoured if its own
 * `admin_user_id` equals this real id, which is what makes a forged or
 * replayed cookie value on a different, unrelated browser session
 * worthless.
 */
export async function getActiveImpersonation(realUserId: string | null): Promise<ActiveImpersonation | null> {
  if (!realUserId) return null;

  const cookieStore = await cookies();
  const sessionId = cookieStore.get(IMPERSONATION_COOKIE)?.value;
  if (!sessionId) return null;

  const admin = createAdminClient();
  const { data: row } = await admin
    .from("admin_impersonation_sessions")
    .select("id, admin_user_id, target_user_id, started_at")
    .eq("id", sessionId)
    .is("ended_at", null)
    .maybeSingle();
  if (!row) return null;

  if (row.admin_user_id !== realUserId) return null;

  if (Date.now() - new Date(row.started_at).getTime() > MAX_IMPERSONATION_DURATION_MS) {
    await endImpersonationRow(row, "expired");
    return null;
  }

  if (!(await isCurrentlyPermittedToImpersonate(realUserId))) {
    await endImpersonationRow(row, "permission_revoked");
    return null;
  }

  return { id: row.id, adminUserId: row.admin_user_id, targetUserId: row.target_user_id, startedAt: row.started_at };
}

export type StartImpersonationResult = { id: string } | { error: string };

/**
 * Ends any of this admin's own still-active sessions first (there
 * should be at most one — this just guarantees it rather than assuming
 * it) so switching targets, or clicking "View as user" twice, never
 * leaves an orphaned row nothing will ever close. The actual role
 * check (target must be a plain 'user') is enforced twice: once here
 * as a friendly pre-check, again by the database trigger
 * (migration 0087) that would otherwise still reject the insert —
 * belt and suspenders on the one invariant that most directly matters
 * for "block privilege escalation".
 */
export async function startImpersonationSession(adminUserId: string, targetUserId: string): Promise<StartImpersonationResult> {
  if (adminUserId === targetUserId) {
    return { error: "You can't view your own account as an impersonation." };
  }

  const admin = createAdminClient();

  const { data: targetProfile } = await admin.from("profiles").select("role").eq("id", targetUserId).maybeSingle();
  if (!targetProfile) return { error: "That account no longer exists." };
  if (targetProfile.role !== "user") {
    return { error: "Only plain user accounts can be viewed this way — never an admin or institution admin account." };
  }

  const supersededAt = new Date().toISOString();
  const { data: superseded } = await admin
    .from("admin_impersonation_sessions")
    .update({ ended_at: supersededAt, end_reason: "superseded" })
    .eq("admin_user_id", adminUserId)
    .is("ended_at", null)
    .select("id, admin_user_id, target_user_id, started_at");
  for (const old of superseded ?? []) await recordAutomaticEnd(old, supersededAt, "superseded");

  const { data: row, error } = await admin
    .from("admin_impersonation_sessions")
    .insert({ admin_user_id: adminUserId, target_user_id: targetUserId })
    .select("id")
    .single();
  if (error || !row) return { error: "Couldn't start impersonation — please try again." };

  const cookieStore = await cookies();
  cookieStore.set(IMPERSONATION_COOKIE, row.id, IMPERSONATION_COOKIE_OPTIONS);

  return { id: row.id };
}

export type EndedImpersonation = ActiveImpersonation & { endedAt: string };

/** Ends the current cookie's session (if any) and clears the cookie regardless — safe to call even when nothing is active. */
export async function endActiveImpersonation(reason: string): Promise<EndedImpersonation | null> {
  const cookieStore = await cookies();
  const sessionId = cookieStore.get(IMPERSONATION_COOKIE)?.value;
  cookieStore.delete(IMPERSONATION_COOKIE);
  if (!sessionId) return null;

  const admin = createAdminClient();
  const endedAt = new Date().toISOString();
  const { data: row } = await admin
    .from("admin_impersonation_sessions")
    .update({ ended_at: endedAt, end_reason: reason })
    .eq("id", sessionId)
    .is("ended_at", null)
    .select("id, admin_user_id, target_user_id, started_at")
    .maybeSingle();
  if (!row) return null;

  return { id: row.id, adminUserId: row.admin_user_id, targetUserId: row.target_user_id, startedAt: row.started_at, endedAt };
}
