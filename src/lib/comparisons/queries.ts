import "server-only";
import { createClient } from "@/lib/supabase/server";
import { createPublicClient } from "@/lib/supabase/public";
import type { ComparisonDifference, ComparisonFaq, ComparisonFeature, ComparisonPage, ComparisonPricing } from "@/lib/comparisons/types";

// The two public-facing reads below (getLiveComparisons/getLiveComparisonBySlug) use createPublicClient() — a plain
// anon-key client with no cookies and no session, matching the "Anyone can view live comparison pages" RLS policy
// (migration 0117) exactly, and letting /compare and /compare/[slug] use ISR instead of being forced fully dynamic
// just for touching cookies(). The two admin-only functions below still filter nothing (drafts included) and stay
// on the session-bound createClient() they already used — an admin browsing /compare itself still sees what a
// visitor sees (both public functions filter published_at explicitly either way).

const FIELDS = "id, slug, competitor_name, competitor_website, intro, features, pricing, differences, faqs, updated_on, published_at, created_at, updated_at";

type Row = {
  id: string;
  slug: string;
  competitor_name: string;
  competitor_website: string | null;
  intro: string | null;
  features: ComparisonFeature[];
  pricing: ComparisonPricing[];
  differences: ComparisonDifference[];
  faqs: ComparisonFaq[];
  updated_on: string;
  published_at: string | null;
  created_at: string;
  updated_at: string;
};

export function toComparison(row: Row): ComparisonPage {
  return {
    id: row.id,
    slug: row.slug,
    competitorName: row.competitor_name,
    competitorWebsite: row.competitor_website,
    intro: row.intro,
    features: row.features ?? [],
    pricing: row.pricing ?? [],
    differences: row.differences ?? [],
    faqs: row.faqs ?? [],
    updatedOn: row.updated_on,
    publishedAt: row.published_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/** Every live comparison, A–Z. A database error is thrown (and logged) — never an empty list or a 404. */
export async function getLiveComparisons(): Promise<ComparisonPage[]> {
  const supabase = createPublicClient();
  const { data, error } = await supabase.from("comparison_pages").select(FIELDS).not("published_at", "is", null).lte("published_at", new Date().toISOString()).order("competitor_name").limit(200);
  if (error) {
    console.error("getLiveComparisons failed:", error.message);
    throw new Error("Couldn't load the comparisons.");
  }
  return ((data ?? []) as unknown as Row[]).map(toComparison);
}

export async function getLiveComparisonBySlug(slug: string): Promise<ComparisonPage | null> {
  const supabase = createPublicClient();
  const { data, error } = await supabase.from("comparison_pages").select(FIELDS).eq("slug", slug).not("published_at", "is", null).lte("published_at", new Date().toISOString()).maybeSingle();
  if (error) {
    console.error("getLiveComparisonBySlug failed:", error.message);
    throw new Error("Couldn't load that comparison.");
  }
  return data ? toComparison(data as unknown as Row) : null;
}

/** Admin only (behind requirePermission("manage_comparisons")): drafts and scheduled pages included. */
export async function listAllComparisonsForAdmin(): Promise<ComparisonPage[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("comparison_pages").select(FIELDS).order("competitor_name").limit(500);
  if (error) {
    console.error("listAllComparisonsForAdmin failed:", error.message);
    throw new Error("Couldn't load the comparisons.");
  }
  return ((data ?? []) as unknown as Row[]).map(toComparison);
}

export async function getComparisonById(id: string): Promise<ComparisonPage | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("comparison_pages").select(FIELDS).eq("id", id).maybeSingle();
  if (error || !data) return null;
  return toComparison(data as unknown as Row);
}
