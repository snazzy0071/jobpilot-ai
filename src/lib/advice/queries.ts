import "server-only";
import { createClient } from "@/lib/supabase/server";
import { getReadingTimeMinutes } from "@/lib/blog/reading-time";
import type { AdviceCategory } from "@/lib/advice/categories";
import type { AdviceGuide, ContentBlock } from "@/lib/advice/types";

// Public, unauthenticated feature: the anon-respecting client, never the service role. RLS (migration 0114) lets everyone read
// live guides and admins read drafts, so the public functions also filter on published_at explicitly — an admin browsing the
// public hub must see exactly what a visitor sees.

const FIELDS = "id, slug, title, summary, category, content, featured_rank, related_slugs, author_name, reviewed_on, published_at, created_at, updated_at";

type Row = {
  id: string;
  slug: string;
  title: string;
  summary: string;
  category: AdviceCategory;
  content: ContentBlock[];
  featured_rank: number | null;
  related_slugs: string[];
  author_name: string | null;
  reviewed_on: string | null;
  published_at: string | null;
  created_at: string;
  updated_at: string;
};

export function toGuide(row: Row): AdviceGuide {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    summary: row.summary,
    category: row.category,
    content: row.content,
    featuredRank: row.featured_rank,
    relatedSlugs: row.related_slugs,
    authorName: row.author_name,
    reviewedOn: row.reviewed_on,
    publishedAt: row.published_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    readingTimeMinutes: getReadingTimeMinutes(row.content),
  };
}

/** Every live guide. A database error is thrown (and logged), never turned into an empty hub or a 404. */
export async function getLiveGuides(): Promise<AdviceGuide[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("advice_guides")
    .select(FIELDS)
    .not("published_at", "is", null)
    .lte("published_at", new Date().toISOString())
    .order("published_at", { ascending: false })
    .limit(500);
  if (error) {
    console.error("getLiveGuides failed:", error.message);
    throw new Error("Couldn't load the advice guides.");
  }
  return ((data ?? []) as unknown as Row[]).map(toGuide);
}

export async function getLiveGuideBySlug(slug: string): Promise<AdviceGuide | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("advice_guides").select(FIELDS).eq("slug", slug).not("published_at", "is", null).lte("published_at", new Date().toISOString()).maybeSingle();
  if (error) {
    console.error("getLiveGuideBySlug failed:", error.message);
    throw new Error("Couldn't load that guide.");
  }
  return data ? toGuide(data as unknown as Row) : null;
}

/** Every guide including drafts and scheduled — admin screens only (behind requirePermission("manage_advice_hub")). */
export async function listAllGuidesForAdmin(): Promise<AdviceGuide[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("advice_guides").select(FIELDS).order("updated_at", { ascending: false }).limit(1000);
  if (error) {
    console.error("listAllGuidesForAdmin failed:", error.message);
    throw new Error("Couldn't load the guides.");
  }
  return ((data ?? []) as unknown as Row[]).map(toGuide);
}

export async function getGuideById(id: string): Promise<AdviceGuide | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("advice_guides").select(FIELDS).eq("id", id).maybeSingle();
  if (error || !data) return null;
  return toGuide(data as unknown as Row);
}
