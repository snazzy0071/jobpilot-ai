import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

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
export const getCurrentUser = cache(async () => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
});

export const getCurrentProfile = cache(async () => {
  const user = await getCurrentUser();
  if (!user) return null;

  const supabase = await createClient();
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

/** For dashboard-area pages: also bounces to /onboarding if it isn't
 * done yet. Onboarding's own pages must stay on plain requireUser()
 * instead — they're exactly what runs before onboarding is complete. */
export const requireOnboardedUser = cache(async () => {
  const user = await requireUser();
  const profile = await getCurrentProfile();

  if (profile && profile.onboarding_status !== "completed") {
    redirect("/onboarding");
  }

  return { user, profile };
});

const requireRole = cache(async (role: "admin" | "institution_admin") => {
  const user = await requireUser();
  const profile = await getCurrentProfile();

  if (!profile || profile.role !== role) redirect("/dashboard");

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

  const supabase = await createClient();
  const { data: membership } = await supabase
    .from("institution_members")
    .select("institution_id")
    .eq("user_id", user.id)
    .eq("role", "admin")
    .maybeSingle();

  if (!membership) redirect("/dashboard");

  return { user, profile, institutionId: membership.institution_id };
});
