import "server-only";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { ContentBlock } from "@/lib/content/blocks";
import type { AdminBlogCategory, AdminBlogAuthor, AdminBlogPostSummary, AdminBlogPost } from "@/lib/admin/blog/types";

function firstOf<T>(value: T[] | T | null | undefined): T | undefined {
  return Array.isArray(value) ? value[0] : value ?? undefined;
}

/** `blog_categories`/`blog_authors` carry "Anyone can view" (migration 0010) — the regular client is enough for these two. */
export async function listBlogCategories(): Promise<AdminBlogCategory[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("blog_categories").select("id, slug, name").order("name");
  if (error || !data) return [];
  return data;
}

export async function listBlogAuthors(): Promise<AdminBlogAuthor[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("blog_authors").select("id, slug, name, bio").order("name");
  if (error || !data) return [];
  return data;
}

/** `blog_posts`' own RLS only shows *published* posts (migration 0010: "Anyone can view published posts") — an admin list needs to see drafts too, so this needs the service-role client. */
export async function listAdminBlogPosts(): Promise<AdminBlogPostSummary[]> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("blog_posts")
    .select("id, slug, title, published_at, blog_categories(name), blog_authors(name)")
    .order("created_at", { ascending: false });
  if (error || !data) return [];

  return data.map((row) => {
    const category = firstOf(row.blog_categories as { name: string }[] | { name: string } | null);
    const author = firstOf(row.blog_authors as { name: string }[] | { name: string } | null);
    return {
      id: row.id,
      slug: row.slug,
      title: row.title,
      categoryName: category?.name ?? "—",
      authorName: author?.name ?? "—",
      publishedAt: row.published_at,
    };
  });
}

export async function getAdminBlogPostById(id: string): Promise<AdminBlogPost | null> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("blog_posts")
    .select("id, slug, title, excerpt, category_id, author_id, content, published_at")
    .eq("id", id)
    .maybeSingle();
  if (error || !data) return null;
  return {
    id: data.id,
    slug: data.slug,
    title: data.title,
    excerpt: data.excerpt,
    categoryId: data.category_id,
    authorId: data.author_id,
    content: data.content as ContentBlock[],
    publishedAt: data.published_at,
  };
}
