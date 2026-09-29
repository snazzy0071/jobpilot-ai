import { createPublicClient as createClient } from "@/lib/supabase/public";
import { getReadingTimeMinutes } from "@/lib/blog/reading-time";
import type { BlogAuthor, BlogCategory, BlogPost, BlogPostSummary, ContentBlock } from "@/lib/blog/types";

// There's no admin CMS yet, so posts are seeded via migration
// (supabase/migrations/0010_blog.sql). If that migration hasn't been
// applied to a given environment, these tables simply don't exist —
// every query here treats a Supabase error as "no data" instead of
// throwing, so the blog degrades to an empty state instead of a 500.

const POST_FIELDS = `
  id, slug, title, excerpt, published_at, content,
  category:blog_categories!inner ( id, slug, name ),
  author:blog_authors!inner ( id, slug, name, bio )
`;

type PostRow = {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  published_at: string;
  content: ContentBlock[];
  category: BlogCategory;
  author: BlogAuthor;
};

function toSummary(row: PostRow): BlogPostSummary {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    excerpt: row.excerpt,
    publishedAt: row.published_at,
    readingTimeMinutes: getReadingTimeMinutes(row.content),
    category: row.category,
    author: row.author,
  };
}

function toPost(row: PostRow): BlogPost {
  return {
    ...toSummary(row),
    content: row.content,
  };
}

export async function getBlogCategories(): Promise<BlogCategory[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("blog_categories")
    .select("id, slug, name")
    .order("name");

  if (error) {
    console.error("getBlogCategories failed:", error.message);
    return [];
  }
  return data ?? [];
}

export async function getBlogPosts(options: { categorySlug?: string } = {}): Promise<BlogPostSummary[]> {
  const supabase = await createClient();
  let query = supabase
    .from("blog_posts")
    .select(POST_FIELDS)
    .not("published_at", "is", null)
    .lte("published_at", new Date().toISOString())
    .order("published_at", { ascending: false });

  if (options.categorySlug) {
    query = query.eq("category.slug", options.categorySlug);
  }

  const { data, error } = await query;
  if (error) {
    console.error("getBlogPosts failed:", error.message);
    return [];
  }

  return ((data ?? []) as unknown as PostRow[]).map(toSummary);
}

export async function getBlogPostBySlug(slug: string): Promise<BlogPost | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("blog_posts")
    .select(POST_FIELDS)
    .eq("slug", slug)
    .not("published_at", "is", null)
    .lte("published_at", new Date().toISOString())
    .maybeSingle();

  if (error) {
    console.error("getBlogPostBySlug failed:", error.message);
    return null;
  }
  if (!data) return null;

  return toPost(data as unknown as PostRow);
}

export async function getRelatedPosts(post: BlogPost, limit = 3): Promise<BlogPostSummary[]> {
  const all = await getBlogPosts();
  const others = all.filter((candidate) => candidate.id !== post.id);
  const sameCategory = others.filter((candidate) => candidate.category.id === post.category.id);
  const rest = others.filter((candidate) => candidate.category.id !== post.category.id);
  return [...sameCategory, ...rest].slice(0, limit);
}
