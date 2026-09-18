export type { ContentBlock } from "@/lib/content/blocks";

import type { ContentBlock } from "@/lib/content/blocks";

export type BlogCategory = {
  id: string;
  slug: string;
  name: string;
};

export type BlogAuthor = {
  id: string;
  slug: string;
  name: string;
  bio: string | null;
};

export type BlogPost = {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  content: ContentBlock[];
  publishedAt: string;
  readingTimeMinutes: number;
  category: BlogCategory;
  author: BlogAuthor;
};

export type BlogPostSummary = Omit<BlogPost, "content">;
