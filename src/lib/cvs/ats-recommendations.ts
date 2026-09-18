import type { CvAtsFormatIssue, CvAtsScan, CvAtsFixPriority, SectionKey } from "@/lib/cvs/types";

export type AtsRecommendationGroup = "summary" | "experience" | "skills" | "education" | "format";

export const RECOMMENDATION_GROUP_ORDER: AtsRecommendationGroup[] = [
  "summary",
  "experience",
  "skills",
  "education",
  "format",
];

export const RECOMMENDATION_GROUP_LABELS: Record<AtsRecommendationGroup, string> = {
  summary: "Summary",
  experience: "Experience",
  skills: "Skills",
  education: "Education",
  format: "Format",
};

export type AtsRecommendation = {
  id: string;
  group: AtsRecommendationGroup;
  priority: CvAtsFixPriority;
  message: string;
  /** The exact section a "Fix/Add in..." link jumps to — usually matches `group`, but a Format-group item (personal, projects, certifications, languages, customSections, or no section at all) still jumps to its own real section when it has one. */
  jumpSectionKey: SectionKey | null;
  /** The raw term for a missing-keyword recommendation, not parsed back out of `message` — what a "Suggest rewrite"/"Add to Skills" action (AtsPreflightPanel) actually needs; absent for a deterministic issue or a prioritized fix, neither of which is a single addable term. */
  keywordTerm: string | null;
};

const PRIORITY_ORDER: Record<CvAtsFixPriority, number> = { high: 0, medium: 1, low: 2 };

/**
 * Summary/Experience/Skills/Education get their own bucket regardless of
 * where a recommendation came from (AI or the deterministic checker) —
 * a "add a summary" fix belongs next to a "your summary is thin" one,
 * not split across two different UI sections just because one is
 * AI-sourced. Everything else — Personal, Projects, Certifications,
 * Languages, custom sections, or no section at all — falls into the
 * Format catch-all, the one group name that isn't a real CV content
 * section.
 */
function groupForSection(sectionKey: SectionKey | null): AtsRecommendationGroup {
  if (sectionKey === "summary" || sectionKey === "experience" || sectionKey === "skills" || sectionKey === "education") {
    return sectionKey;
  }
  return "format";
}

/**
 * Merges the pre-flight check's three independent recommendation
 * sources into one list, grouped the way a user actually edits a CV —
 * by section — rather than by which part of the system happened to
 * produce the suggestion:
 *
 *  - `formatIssues` — deterministic, always live (src/lib/cvs/
 *    ats-format-checks.ts), required here since it's available with no
 *    scan at all. Its two severities map onto the shared high/low ends
 *    of the three-level scale (`warning` → high, `info` → low) rather
 *    than inventing a false "medium" for a checker that only ever had
 *    two levels.
 *  - `scan.prioritizedFixes` and `scan.missingKeywords` — the AI's own
 *    judgment, only present once a real scan has run; `scan` is
 *    optional for exactly that reason.
 *
 * The merged list is priority-sorted once, up front — grouping (see
 * groupAtsRecommendations) then just filters it, which preserves that
 * order within each group for free.
 */
export function buildAtsRecommendations(formatIssues: CvAtsFormatIssue[], scan: CvAtsScan | null): AtsRecommendation[] {
  const recommendations: AtsRecommendation[] = [];

  formatIssues.forEach((issue, index) => {
    recommendations.push({
      id: `format-${index}-${issue.id}`,
      group: groupForSection(issue.sectionKey),
      priority: issue.severity === "warning" ? "high" : "low",
      message: issue.message,
      jumpSectionKey: issue.sectionKey,
      keywordTerm: null,
    });
  });

  if (scan) {
    scan.prioritizedFixes.forEach((fix, index) => {
      recommendations.push({
        id: `fix-${index}`,
        group: groupForSection(fix.sectionKey),
        priority: fix.priority,
        message: fix.message,
        jumpSectionKey: fix.sectionKey,
        keywordTerm: null,
      });
    });

    scan.missingKeywords.forEach((keyword, index) => {
      recommendations.push({
        id: `keyword-${index}`,
        group: groupForSection(keyword.suggestedSection),
        priority: keyword.importance,
        message:
          keyword.occurrenceCount > 0
            ? `Add "${keyword.term}" — mentioned ${keyword.occurrenceCount}× in the job description.`
            : `Add "${keyword.term}".`,
        jumpSectionKey: keyword.suggestedSection,
        keywordTerm: keyword.term,
      });
    });
  }

  return recommendations.sort((a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority]);
}

export type AtsRecommendationBucket = { group: AtsRecommendationGroup; items: AtsRecommendation[] };

/** RECOMMENDATION_GROUP_ORDER order, empty buckets omitted. */
export function groupAtsRecommendations(recommendations: AtsRecommendation[]): AtsRecommendationBucket[] {
  return RECOMMENDATION_GROUP_ORDER.map((group) => ({
    group,
    items: recommendations.filter((recommendation) => recommendation.group === group),
  })).filter((bucket) => bucket.items.length > 0);
}
