import type { ContentBlock } from "@/lib/content/blocks";

export type AdminBlogCategory = { id: string; slug: string; name: string };
export type AdminBlogAuthor = { id: string; slug: string; name: string; bio: string | null };

export type AdminBlogPostSummary = {
  id: string;
  slug: string;
  title: string;
  categoryName: string;
  authorName: string;
  publishedAt: string | null;
};

export type AdminBlogPost = {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  categoryId: string;
  authorId: string;
  content: ContentBlock[];
  publishedAt: string | null;
};
