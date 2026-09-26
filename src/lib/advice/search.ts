import type { AdviceCategory } from "@/lib/advice/categories";
import type { AdviceGuide, ContentBlock } from "@/lib/advice/types";

// Pure logic for the hub: search, category filter, featured, related, pagination. The catalogue is small (an editorial set, not a
// feed), so the whole live list is fetched once and worked on in memory — see src/lib/advice/queries.ts.

export const HUB_PAGE_SIZE = 12;

function textOf(block: ContentBlock): string {
  return block.type === "list" ? block.items.join(" ") : block.text;
}

function words(query: string): string[] {
  return query
    .toLowerCase()
    .split(/[^a-z0-9£%+#-]+/)
    .map((word) => word.replace(/^-+|-+$/g, ""))
    .filter((word) => word.length > 0);
}

const byNewest = (a: AdviceGuide, b: AdviceGuide) => (b.publishedAt ?? "").localeCompare(a.publishedAt ?? "") || a.title.localeCompare(b.title);

/**
 * Every word must appear somewhere in the guide (title, summary, headings or body); the ranking favours where it appears — a
 * title hit outweighs a heading hit, which outweighs the summary, which outweighs the body. Ties go to the more recent guide.
 * An empty query matches everything (newest first).
 */
export function searchGuides(guides: AdviceGuide[], query: string): AdviceGuide[] {
  const terms = words(query);
  if (terms.length === 0) return [...guides].sort(byNewest);

  const scored = guides
    .map((guide) => {
      const title = guide.title.toLowerCase();
      const summary = guide.summary.toLowerCase();
      const headings = guide.content.filter((block) => block.type === "heading").map(textOf).join(" ").toLowerCase();
      const body = guide.content.map(textOf).join(" ").toLowerCase();
      let score = 0;
      for (const term of terms) {
        const inTitle = title.includes(term);
        const inHeadings = headings.includes(term);
        const inSummary = summary.includes(term);
        const inBody = body.includes(term);
        if (!inTitle && !inHeadings && !inSummary && !inBody) return null; // every word must match somewhere
        score += (inTitle ? 8 : 0) + (inHeadings ? 4 : 0) + (inSummary ? 2 : 0) + (inBody ? 1 : 0);
      }
      return { guide, score };
    })
    .filter((entry): entry is { guide: AdviceGuide; score: number } => entry !== null);

  return scored.sort((a, b) => b.score - a.score || byNewest(a.guide, b.guide)).map((entry) => entry.guide);
}

export function filterByCategory(guides: AdviceGuide[], category: AdviceCategory | null): AdviceGuide[] {
  return category ? guides.filter((guide) => guide.category === category) : guides;
}

/** Featured guides in their editorial order. */
export function featuredGuides(guides: AdviceGuide[], limit = 3): AdviceGuide[] {
  return guides
    .filter((guide) => guide.featuredRank !== null)
    .sort((a, b) => (a.featuredRank ?? 0) - (b.featuredRank ?? 0) || a.title.localeCompare(b.title))
    .slice(0, limit);
}

export function categoryCounts(guides: AdviceGuide[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const guide of guides) counts[guide.category] = (counts[guide.category] ?? 0) + 1;
  return counts;
}

/** Hand-picked guides first (in the order given, only those that exist and are live), then the same category newest-first, then the rest newest-first. */
export function relatedGuides(guide: AdviceGuide, live: AdviceGuide[], limit = 3): AdviceGuide[] {
  const others = live.filter((candidate) => candidate.id !== guide.id);
  const bySlug = new Map(others.map((candidate) => [candidate.slug, candidate]));
  const manual = guide.relatedSlugs.map((slug) => bySlug.get(slug)).filter((candidate): candidate is AdviceGuide => !!candidate);
  const sameCategory = others.filter((candidate) => candidate.category === guide.category && !manual.includes(candidate)).sort(byNewest);
  const rest = others.filter((candidate) => candidate.category !== guide.category && !manual.includes(candidate)).sort(byNewest);
  return [...manual, ...sameCategory, ...rest].slice(0, limit);
}

export function paginate<T>(items: T[], page: number, size: number = HUB_PAGE_SIZE): { items: T[]; page: number; totalPages: number } {
  const totalPages = Math.max(1, Math.ceil(items.length / size));
  const current = Math.min(Math.max(1, page), totalPages);
  return { items: items.slice((current - 1) * size, current * size), page: current, totalPages };
}

export type HubParams = { q: string; category: AdviceCategory | null; page: number };

/** Reads the query string defensively: anything unrecognised is ignored rather than trusted. */
export function parseHubParams(params: Record<string, string | string[] | undefined>, isCategory: (value: unknown) => value is AdviceCategory): HubParams {
  const one = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value)?.trim() ?? "";
  const page = Number.parseInt(one(params.page), 10);
  const category = one(params.category);
  return { q: one(params.q).slice(0, 100), category: isCategory(category) ? category : null, page: Number.isInteger(page) && page > 0 ? Math.min(page, 1000) : 1 };
}

export function hubQuery(params: HubParams, overrides: Partial<HubParams> = {}): string {
  const p = { ...params, ...overrides };
  const search = new URLSearchParams();
  if (p.q) search.set("q", p.q);
  if (p.category) search.set("category", p.category);
  if (p.page > 1) search.set("page", String(p.page));
  return search.toString();
}
