import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { InstitutionMemberRole } from "@/lib/institutions/types";

export type CurrentInstitutionMembership = { institutionId: string; institutionName: string; role: InstitutionMemberRole };

/** This user's own membership, if any — RLS (institution_members' own "view their institution's roster" policy) already scopes it to rows the caller is allowed to see, which for a plain member is exactly their own row. */
export async function getCurrentInstitutionMembership(userId: string): Promise<CurrentInstitutionMembership | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("institution_members")
    .select("institution_id, role, institutions(name)")
    .eq("user_id", userId)
    .maybeSingle();
  if (error || !data) return null;

  const institutions = data.institutions as { name: string }[] | { name: string } | null;
  const institution = Array.isArray(institutions) ? institutions[0] : institutions;
  return { institutionId: data.institution_id, institutionName: institution?.name ?? "Your institution", role: data.role };
}

export type CurrentInstitutionBranding = {
  name: string;
  logoUrl: string | null;
  primaryColor: string | null;
  welcomeMessage: string | null;
};

/**
 * For co-branded onboarding (/onboarding's own layout) — returns null
 * for a user with no institution membership at all, which is most
 * users; the caller renders nothing extra in that case. Reads through
 * the same RLS as getCurrentInstitutionMembership above, so this can
 * never surface another institution's branding to the wrong member.
 */
export async function getCurrentInstitutionBranding(userId: string): Promise<CurrentInstitutionBranding | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("institution_members")
    .select("institutions(name, logo_url, primary_color, welcome_message)")
    .eq("user_id", userId)
    .maybeSingle();
  if (error || !data) return null;

  const institutions = data.institutions as
    | { name: string; logo_url: string | null; primary_color: string | null; welcome_message: string | null }[]
    | { name: string; logo_url: string | null; primary_color: string | null; welcome_message: string | null }
    | null;
  const institution = Array.isArray(institutions) ? institutions[0] : institutions;
  if (!institution) return null;

  return {
    name: institution.name,
    logoUrl: institution.logo_url,
    primaryColor: institution.primary_color,
    welcomeMessage: institution.welcome_message,
  };
}
