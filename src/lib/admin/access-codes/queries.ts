import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { AdminAccessCode, AdminAccessCodeOption, AdminPlanOption } from "@/lib/admin/access-codes/types";

function firstOf<T>(value: T[] | T | null | undefined): T | undefined {
  return Array.isArray(value) ? value[0] : value ?? undefined;
}

/** access_codes has RLS enabled with zero policies for anon/authenticated (migration 0005's own comment: "no legitimate reason for a client to read this directly") — every read/write needs the service-role client, not just the usual "self-select-only" cases elsewhere in this app. */
export async function listAccessCodes(): Promise<AdminAccessCode[]> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("access_codes")
    .select("id, code, label, max_redemptions, redemption_count, is_active, expires_at, created_at, institutions(name), plans(slug)")
    .order("created_at", { ascending: false });
  if (error || !data) return [];

  return data.map((row) => {
    const institution = firstOf(row.institutions as { name: string }[] | { name: string } | null);
    const plan = firstOf(row.plans as { slug: string }[] | { slug: string } | null);
    return {
      id: row.id,
      code: row.code,
      label: row.label,
      maxRedemptions: row.max_redemptions,
      redemptionCount: row.redemption_count,
      isActive: row.is_active,
      expiresAt: row.expires_at,
      institutionName: institution?.name ?? null,
      grantedPlanSlug: plan?.slug ?? null,
      createdAt: row.created_at,
    };
  });
}

/** institutions/plans both carry "Anyone can view" style policies (institutions: institution members + global admin; plans: anyone) — but since the caller here is always an admin already, the regular client is simplest and sufficient for these two option lists. */
export async function listInstitutionOptions(): Promise<AdminAccessCodeOption[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("institutions").select("id, name").order("name");
  if (error || !data) return [];
  return data;
}

export async function listPlanOptions(): Promise<AdminPlanOption[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("plans").select("id, slug, name").eq("is_active", true).order("tier_order");
  if (error || !data) return [];
  return data;
}
