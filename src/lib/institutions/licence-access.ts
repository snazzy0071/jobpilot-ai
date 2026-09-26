import "server-only";
import { cache } from "react";
import { createAdminClient } from "@/lib/supabase/admin";

export type InstitutionLicencePlan = {
  planSlug: string;
  planName: string;
  entitlements: Record<string, unknown>;
  institutionId: string;
};

/**
 * The plan a user gets through their institution's licence: only while they are a member, and only while that licence is switched
 * on, has started and has not expired (get_institution_licence_plan, migration 0119 — the same rule the seat trigger uses). The
 * moment the licence expires, is deactivated, or the person is removed, this returns null and they fall back to their own plan.
 *
 * Fails closed: any error means "no licence plan", never a guess.
 */
export const getInstitutionLicencePlan = cache(async (userId: string): Promise<InstitutionLicencePlan | null> => {
  const { data, error } = await createAdminClient().rpc("get_institution_licence_plan", { p_user_id: userId });
  if (error) {
    console.error("getInstitutionLicencePlan failed:", error.message);
    return null;
  }
  if (!data || typeof data !== "object") return null;
  const row = data as { slug?: string; name?: string; entitlements?: Record<string, unknown>; institutionId?: string };
  if (!row.slug || !row.entitlements || !row.institutionId) return null;
  return { planSlug: row.slug, planName: row.name ?? row.slug, entitlements: row.entitlements, institutionId: row.institutionId };
});
