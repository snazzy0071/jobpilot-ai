import "server-only";
import { unstable_cache } from "next/cache";
import { createClient } from "@supabase/supabase-js";
import { getStripeEnv } from "@/lib/stripe/env";
import { sortPlans, type PublicPlan } from "@/lib/plans/plan-features";

// The plans table is publicly readable by design ("Anyone can view plans", migration 0015), so public marketing pages read it with
// the anon key and no cookies. That keeps them cacheable: refreshed every five minutes, and a database error yields an empty list
// (the callers then fall back to saying nothing rather than to invented numbers).
const fetchPlans = unstable_cache(
  async (): Promise<PublicPlan[]> => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !key) return [];
    const client = createClient(url, key, { auth: { persistSession: false } });
    const { data, error } = await client
      .from("plans")
      .select("slug, name, tier_order, monthly_price_pence, annual_price_pence, entitlements")
      .eq("is_active", true)
      .order("tier_order");
    if (error || !data) {
      console.error("getPublicPlans failed:", error?.message);
      return [];
    }
    return data.map((row) => ({
      slug: row.slug,
      name: row.name,
      tierOrder: row.tier_order,
      monthlyPence: row.monthly_price_pence,
      annualPence: row.annual_price_pence,
      entitlements: (row.entitlements ?? {}) as Record<string, unknown>,
    }));
  },
  ["public-plans"],
  { revalidate: 300 },
);

export async function getPublicPlans(): Promise<PublicPlan[]> {
  return sortPlans(await fetchPlans());
}

/** Whether checkout can actually run here: every Stripe key and price id is configured. Pages say "launching soon" only when this is false. */
export function isBillingConfigured(): boolean {
  try {
    getStripeEnv();
    return true;
  } catch {
    return false;
  }
}
