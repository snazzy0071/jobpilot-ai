import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient, createRealSessionClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getRoleHomePath } from "@/lib/auth/role-redirect";
import { getActiveImpersonation, type ActiveImpersonation } from "@/lib/auth/impersonation";

// Every one of these is wrapped in React's `cache()`: a layout and its
// page (often several nested layouts) each call their own
// requireUser()/requireAdmin()/etc. independently — the normal App
// Router pattern, not a mistake — which without this means every single
// authenticated page load was firing 2+ identical `auth.getUser()` calls
// (a real network round trip to Supabase Auth) plus, for role-gated
// pages, 2+ identical `profiles` lookups. `cache()` dedupes calls with
// the same arguments to the same function within one request's render
// pass, so the real Supabase calls happen once regardless of how many
// layouts/pages ask for the same thing. Safe with `redirect()` inside:
// React caches the rejected promise too, so a second call in the same
// request just re-throws the same redirect rather than re-running
// anything.
//
// getCurrentUser()/getCurrentProfile() always use
// createRealSessionClient() (never the impersonation-aware
// createClient() from server.ts) — permission checks (requireAdmin,
// requireInstitutionAdmin, and the impersonation permission check
// itself) must always be based on who is *really* signed in, never on
// whatever identity a dashboard page render happens to be showing.
export const getCurrentUser = cache(async () => {
  const supabase = await createRealSessionClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
});

export const getCurrentProfile = cache(async () => {
  const user = await getCurrentUser();
  if (!user) return null;

  const supabase = await createRealSessionClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  return profile;
});

export const requireUser = cache(async () => {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
});

/**
 * Whether the real, currently-authenticated admin is actively viewing
 * as another user — cache()'d so every caller in one request (the
 * banner, requireOnboardedUser() below, the proxy-level write block)
 * shares one lookup.
 */
export const getImpersonationStatus = cache(async (): Promise<ActiveImpersonation | null> => {
  const realUser = await getCurrentUser();
  return getActiveImpersonation(realUser?.id ?? null);
});

/**
 * The identity a dashboard-area page should treat as "the current
 * user" for display/data purposes — the impersonation target while an
 * active, verified admin impersonation session exists, the real
 * signed-in user otherwise. Never used for anything permission-related
 * (requireAdmin/requireInstitutionAdmin/getCurrentUser above all stay
 * on the real session on purpose) — only for "whose data does this
 * page show". Resolved via the Admin API (the same privileged,
 * server-only credential every other cross-user lookup in this app
 * already uses — scripts/create-user.mjs, admin/users/queries.ts) since
 * there's no session token for the target to read this from directly.
 */
export const getEffectiveUser = cache(async () => {
  const real = await getCurrentUser();
  if (!real) return null;

  const impersonation = await getImpersonationStatus();
  if (!impersonation) return real;

  const admin = createAdminClient();
  const { data, error } = await admin.auth.admin.getUserById(impersonation.targetUserId);
  if (error || !data.user) return real;
  return data.user;
});

export const getEffectiveProfile = cache(async () => {
  const effectiveUser = await getEffectiveUser();
  if (!effectiveUser) return null;

  // createClient() (not createRealSessionClient()): while impersonating
  // this is the service-role client, which is what actually lets this
  // resolve the TARGET's profile rather than the real admin's — see
  // that function's own comment in src/lib/supabase/server.ts.
  const supabase = await createClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", effectiveUser.id)
    .single();

  return profile;
});

/** For dashboard-area pages: also bounces to /onboarding if it isn't
 * done yet. Onboarding's own pages must stay on plain requireUser()
 * instead — they're exactly what runs before onboarding is complete.
 * Returns the EFFECTIVE identity (see getEffectiveUser above) — every
 * dashboard page/action that destructures `{ user, profile }` from
 * this is transparently shown the impersonation target's own data
 * while a "View as user" session is active, with zero changes needed
 * to any individual page or query function. */
export const requireOnboardedUser = cache(async () => {
  const realUser = await requireUser();
  // getEffectiveUser() only ever returns null when there's no real
  // user at all (see its own definition above) — impossible here,
  // requireUser() just redirected if that were true — the `?? realUser`
  // fallback exists purely to keep this typed as non-null without an
  // unsafe assertion, not because it's expected to ever be used.
  const user = (await getEffectiveUser()) ?? realUser;
  const profile = await getEffectiveProfile();

  if (profile && profile.onboarding_status !== "completed") {
    redirect("/onboarding");
  }

  return { user, profile };
});

const requireRole = cache(async (role: "admin" | "institution_admin") => {
  const user = await requireUser();
  const profile = await getCurrentProfile();

  // Bounces to the CALLER'S OWN role home, not a hardcoded /dashboard —
  // an admin who follows a stale /institution-admin link belongs at
  // /admin, not the plain user dashboard. A profile with no matching
  // role (or missing entirely) still lands on /dashboard, via
  // getRoleHomePath's own default case.
  if (!profile || profile.role !== role) redirect(getRoleHomePath(profile?.role));

  return { user, profile };
});

export async function requireAdmin() {
  return requireRole("admin");
}

/**
 * Beyond the global `profiles.role === 'institution_admin'` gate every
 * other requireRole() caller stops at, this also resolves *which*
 * institution the caller actually administers (migration 0072's
 * institution_members, `role = 'admin'`) — the real tenant boundary.
 * Without this second check, "tenant-safe" would only be true at the
 * database's own RLS layer; every /institution-admin page needs the
 * resolved `institutionId` anyway to scope its own reads/writes, so
 * this is where that gets done once rather than in each page. A
 * profile flagged `institution_admin` with no matching membership row
 * (an orphaned/not-yet-provisioned account) bounces to /dashboard —
 * same as failing the role check outright, since there's no tenant to
 * show them.
 */
export const requireInstitutionAdmin = cache(async () => {
  const { user, profile } = await requireRole("institution_admin");

  // createRealSessionClient(), not createClient(): this resolves the
  // REAL admin's own tenant, which must never be affected by whatever
  // impersonation state happens to exist (it shouldn't, in practice —
  // impersonation is only ever active on dashboard-area routes — but
  // this has nothing to do with an impersonation target either way).
  const supabase = await createRealSessionClient();
  const { data: membership } = await supabase
    .from("institution_members")
    .select("institution_id")
    .eq("user_id", user.id)
    .eq("role", "admin")
    .maybeSingle();

  // Hardcoded /dashboard, not getRoleHomePath(profile.role): that would
  // resolve back to /institution-admin for this exact profile.role,
  // which would fail this same membership check again — a redirect
  // loop. /dashboard is genuinely the only usable home while the
  // membership row is missing.
  if (!membership) redirect("/dashboard");

  return { user, profile, institutionId: membership.institution_id };
});
