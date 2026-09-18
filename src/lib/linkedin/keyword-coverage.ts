// Whether a keyword actually appears in a piece of text is exact,
// deterministic string matching — never asked of the model, same
// reasoning src/lib/cvs/ats-keyword-occurrences.ts's own doc comment
// gives for ATS. Reused directly rather than re-implemented: both
// features need the identical "case-insensitive whole-word/phrase
// match" semantics, and countTermOccurrences is already a pure,
// domain-agnostic string function despite living under lib/cvs.
import { countTermOccurrences } from "@/lib/cvs/ats-keyword-occurrences";
import type { LinkedinKeywordTerm, LinkedinKeywordImportance, LinkedinKeywordCoverage } from "@/lib/linkedin/types";

const IMPORTANCE_WEIGHT: Record<LinkedinKeywordImportance, number> = { high: 3, medium: 2, low: 1 };

/**
 * Checks a fixed keyword list against one piece of text and returns a
 * weighted coverage score (0-100) plus which terms were found/missing.
 * Called twice per draft render — once against the as-pasted original
 * text (the "before" score) and once against the current optimized
 * text (the "after" score, always live: it reflects whatever About/
 * Experience rewrites have been accepted so far, not a snapshot taken
 * at generation time) — same keyword list both times, so the two scores
 * are directly comparable.
 */
export function computeLinkedinKeywordCoverage(keywords: LinkedinKeywordTerm[], text: string): LinkedinKeywordCoverage {
  const found: LinkedinKeywordTerm[] = [];
  const missing: LinkedinKeywordTerm[] = [];
  let totalWeight = 0;
  let matchedWeight = 0;

  for (const keyword of keywords) {
    const weight = IMPORTANCE_WEIGHT[keyword.importance];
    totalWeight += weight;
    if (countTermOccurrences(keyword.term, text) > 0) {
      found.push(keyword);
      matchedWeight += weight;
    } else {
      missing.push(keyword);
    }
  }

  const score = totalWeight === 0 ? 0 : Math.round((matchedWeight / totalWeight) * 100);
  return { score, found, missing };
}
