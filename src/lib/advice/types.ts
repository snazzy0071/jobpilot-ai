import type { ContentBlock } from "@/lib/content/blocks";
import type { AdviceCategory } from "@/lib/advice/categories";

export type { ContentBlock };

export type AdviceGuide = {
  id: string;
  slug: string;
  title: string;
  summary: string;
  category: AdviceCategory;
  content: ContentBlock[];
  /** Lowest first; null = not featured. */
  featuredRank: number | null;
  relatedSlugs: string[];
  authorName: string | null;
  /** ISO date the advice was last checked. */
  reviewedOn: string | null;
  /** Null = draft; a future time = scheduled. */
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
  readingTimeMinutes: number;
};

/** Whether a guide is visible to the public right now. */
export function isLive(guide: Pick<AdviceGuide, "publishedAt">, now: Date = new Date()): boolean {
  return !!guide.publishedAt && new Date(guide.publishedAt) <= now;
}
