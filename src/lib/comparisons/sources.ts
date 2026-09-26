import type { ComparisonPage, ComparisonSource } from "@/lib/comparisons/types";

/** "www.jobscan.co" from a URL; falls back to the raw text for anything unparseable. */
export function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

type Cited = { sourceUrl: string | null; sourceDate: string | null };

/** Every cited item on the page, in reading order: features, pricing, differences, then FAQs — the order the page shows them. */
function citedItems(page: Pick<ComparisonPage, "features" | "pricing" | "differences" | "faqs">): Cited[] {
  return [...page.features, ...page.pricing, ...page.differences, ...page.faqs];
}

/**
 * The page's sources, deduplicated by URL and numbered in order of first appearance. When one URL is cited more than once the
 * most recent check date wins. `numberFor` is what the tables use for their footnote markers, so a number always means the same source.
 */
export function collectSources(page: Pick<ComparisonPage, "features" | "pricing" | "differences" | "faqs">): { sources: ComparisonSource[]; numberFor: (url: string | null) => number | null } {
  const byUrl = new Map<string, ComparisonSource>();
  for (const item of citedItems(page)) {
    if (!item.sourceUrl) continue;
    const existing = byUrl.get(item.sourceUrl);
    if (existing) {
      if (item.sourceDate && item.sourceDate > existing.checkedOn) existing.checkedOn = item.sourceDate;
    } else {
      byUrl.set(item.sourceUrl, { number: byUrl.size + 1, url: item.sourceUrl, host: hostOf(item.sourceUrl), checkedOn: item.sourceDate ?? "", label: hostOf(item.sourceUrl) });
    }
  }
  const sources = [...byUrl.values()];
  return { sources, numberFor: (url) => (url ? (byUrl.get(url)?.number ?? null) : null) };
}

/** A page can go live only with something to compare and a source behind every competitor claim. Returns what's missing, or an empty list. */
export function publishBlockers(page: Pick<ComparisonPage, "features" | "pricing" | "differences" | "faqs" | "competitorName">): string[] {
  const problems: string[] = [];
  if (page.features.length + page.differences.length + page.pricing.length === 0) problems.push("Add at least one feature, pricing note or difference.");
  for (const feature of page.features) {
    if (feature.competitor !== "unknown" && !feature.sourceUrl) problems.push(`"${feature.label}" needs a source.`);
  }
  for (const item of [...page.pricing, ...page.differences]) {
    if (!item.sourceUrl) problems.push(`A ${"plan" in item ? "pricing note" : "difference"} needs a source.`);
  }
  return problems;
}
