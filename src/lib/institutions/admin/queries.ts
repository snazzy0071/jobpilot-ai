import "server-only";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type {
  AdminInstitutionMember,
  AdminInstitutionInvite,
  InstitutionOverview,
  InstitutionLicenceSummary,
  InstitutionAnalytics,
} from "@/lib/institutions/admin/types";

const EMPTY_ANALYTICS: InstitutionAnalytics = {
  studentCount: 0,
  activatedStudents: 0,
  cvsBuilt: 0,
  atsScans: 0,
  interviewsCompleted: 0,
  applicationsTracked: 0,
  testSessionsCompleted: 0,
};

function firstOf<T>(value: T[] | T | null | undefined): T | undefined {
  return Array.isArray(value) ? value[0] : value ?? undefined;
}

/**
 * Regular (RLS-respecting) client throughout — institution_members'
 * own "view their institution's roster" policy, institutions' "view
 * their own institution" policy, and institution_licences'/
 * institution_invites' admin-scoped SELECT policies (migration 0072)
 * already restrict every one of these to `institutionId`'s own tenant
 * for the calling admin. The explicit `.eq("institution_id", ...)`
 * filters below are what target the right row, not what secures it —
 * RLS is what secures it.
 */
export async function getInstitutionOverview(institutionId: string): Promise<InstitutionOverview | null> {
  const supabase = await createClient();

  const [{ data: institution }, { data: licenceRow }, { data: memberRows }, { data: inviteRows }] = await Promise.all([
    supabase.from("institutions").select("id, name, slug, logo_url, primary_color, welcome_message").eq("id", institutionId).maybeSingle(),
    supabase
      .from("institution_licences")
      .select("id, seat_count, starts_at, expires_at, is_active, plans(name)")
      .eq("institution_id", institutionId)
      .eq("is_active", true)
      .maybeSingle(),
    supabase.from("institution_members").select("role").eq("institution_id", institutionId),
    supabase
      .from("institution_invites")
      .select("id")
      .eq("institution_id", institutionId)
      .is("accepted_at", null)
      .gt("expires_at", new Date().toISOString()),
  ]);

  if (!institution) return null;

  const members = memberRows ?? [];
  const adminCount = members.filter((member) => member.role === "admin").length;
  const memberCount = members.filter((member) => member.role === "member").length;
  const pendingInviteCount = (inviteRows ?? []).length;

  const plan = firstOf(licenceRow?.plans as { name: string }[] | { name: string } | null | undefined);
  const licence: InstitutionLicenceSummary | null = licenceRow
    ? {
        id: licenceRow.id,
        planName: plan?.name ?? "Unknown plan",
        seatCount: licenceRow.seat_count,
        startsAt: licenceRow.starts_at,
        expiresAt: licenceRow.expires_at,
        isActive: licenceRow.is_active,
      }
    : null;

  return {
    institution: {
      id: institution.id,
      name: institution.name,
      slug: institution.slug,
      logoUrl: institution.logo_url,
      primaryColor: institution.primary_color,
      welcomeMessage: institution.welcome_message,
    },
    licence,
    adminCount,
    memberCount,
    pendingInviteCount,
    seatsUsed: adminCount + memberCount + pendingInviteCount,
    seatsTotal: licence?.seatCount ?? null,
  };
}

/** Same as getInstitutionOverview's own licence lookup, standalone for the dedicated licence page. */
export async function getActiveLicence(institutionId: string): Promise<InstitutionLicenceSummary | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("institution_licences")
    .select("id, seat_count, starts_at, expires_at, is_active, plans(name)")
    .eq("institution_id", institutionId)
    .eq("is_active", true)
    .maybeSingle();
  if (error || !data) return null;

  const plan = firstOf(data.plans as { name: string }[] | { name: string } | null | undefined);
  return {
    id: data.id,
    planName: plan?.name ?? "Unknown plan",
    seatCount: data.seat_count,
    startsAt: data.starts_at,
    expiresAt: data.expires_at,
    isActive: data.is_active,
  };
}

/**
 * The one query in this module that needs the service-role client:
 * `profiles` has no email column (email lives in auth.users, which
 * PostgREST never exposes directly) and its own RLS is self-select
 * only (`auth.uid() = id`) — an institution admin has no RLS-granted
 * way to read another member's name/email at all. Resolving each
 * member's email via `auth.admin.getUserById` one at a time (in
 * parallel) is the same pattern src/lib/applications/reminders/
 * dispatch.ts already uses for exactly this "need another user's
 * email, server-side only" case; there's no bulk-by-ids admin API to
 * use instead. Because this bypasses RLS entirely, the explicit
 * `.eq("institution_id", institutionId)` below is the *only* thing
 * scoping it to one tenant — this is the one query in the module where
 * that filter is load-bearing, not just a target.
 */
export async function listInstitutionMembers(institutionId: string): Promise<AdminInstitutionMember[]> {
  const admin = createAdminClient();

  const { data: members, error } = await admin
    .from("institution_members")
    .select("id, user_id, role, joined_at")
    .eq("institution_id", institutionId)
    .order("joined_at", { ascending: true });
  if (error || !members || members.length === 0) return [];

  const userIds = members.map((member) => member.user_id);
  const { data: profiles } = await admin.from("profiles").select("id, full_name").in("id", userIds);
  const nameById = new Map((profiles ?? []).map((profile) => [profile.id, profile.full_name]));

  const emailById = new Map<string, string | null>();
  await Promise.all(
    members.map(async (member) => {
      const { data } = await admin.auth.admin.getUserById(member.user_id);
      emailById.set(member.user_id, data.user?.email ?? null);
    }),
  );

  return members.map((member) => ({
    id: member.id,
    userId: member.user_id,
    role: member.role,
    joinedAt: member.joined_at,
    fullName: nameById.get(member.user_id) ?? null,
    email: emailById.get(member.user_id) ?? null,
  }));
}

/** Invites carry their own `email` column directly (migration 0072) — no auth.users lookup needed, so the regular client is enough. */
export async function listInstitutionInvites(institutionId: string): Promise<AdminInstitutionInvite[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("institution_invites")
    .select("id, email, role, invited_by, expires_at, accepted_at, created_at")
    .eq("institution_id", institutionId)
    .order("created_at", { ascending: false });
  if (error || !data) return [];

  return data.map((row) => ({
    id: row.id,
    email: row.email,
    role: row.role,
    invitedBy: row.invited_by,
    expiresAt: row.expires_at,
    acceptedAt: row.accepted_at,
    createdAt: row.created_at,
  }));
}

/**
 * Privacy-safe institution analytics — every field is a pre-aggregated
 * count computed inside get_institution_analytics() (migration 0074);
 * this function never sees, and could never leak, a single row of
 * per-student activity, only the six/seven numbers that function
 * returns. Needs the service-role client purely because that RPC is
 * granted to `service_role` only — same calling convention as every
 * other cross-user function in this app (redeem_access_code,
 * accept_institution_invite).
 */
export async function getInstitutionAnalytics(institutionId: string): Promise<InstitutionAnalytics> {
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("get_institution_analytics", { p_institution_id: institutionId });
  if (error || !data) return EMPTY_ANALYTICS;

  return {
    studentCount: data.studentCount ?? 0,
    activatedStudents: data.activatedStudents ?? 0,
    cvsBuilt: data.cvsBuilt ?? 0,
    atsScans: data.atsScans ?? 0,
    interviewsCompleted: data.interviewsCompleted ?? 0,
    applicationsTracked: data.applicationsTracked ?? 0,
    testSessionsCompleted: data.testSessionsCompleted ?? 0,
  };
}
