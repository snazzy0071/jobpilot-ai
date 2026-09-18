import { describe, expect, it } from "vitest";
import { buildAtsRecommendations, groupAtsRecommendations } from "@/lib/cvs/ats-recommendations";
import type { CvAtsFormatIssue, CvAtsScan } from "@/lib/cvs/types";

function formatIssue(overrides: Partial<CvAtsFormatIssue> = {}): CvAtsFormatIssue {
  return {
    id: "issue-1",
    severity: "warning",
    message: "Add a summary.",
    sectionKey: "summary",
    ...overrides,
  };
}

function emptyScan(overrides: Partial<CvAtsScan> = {}): CvAtsScan {
  return {
    id: "scan-1",
    jobDescription: "",
    overallScore: 0,
    keywordScore: 0,
    structureScore: 0,
    formatScore: 0,
    sectionsScore: 0,
    strengths: [],
    summary: "",
    createdAt: new Date().toISOString(),
    matchedKeywords: [],
    missingKeywords: [],
    prioritizedFixes: [],
    ...overrides,
  };
}

describe("buildAtsRecommendations", () => {
  it("maps a deterministic warning to high priority and info to low", () => {
    const recs = buildAtsRecommendations(
      [formatIssue({ id: "a", severity: "warning" }), formatIssue({ id: "b", severity: "info" })],
      null,
    );
    expect(recs.find((r) => r.message.includes("Add a summary"))?.priority).toBeDefined();
    expect(recs[0].priority).toBe("high");
    expect(recs[1].priority).toBe("low");
  });

  it("sorts the merged list strictly by priority: high, then medium, then low", () => {
    const scan = emptyScan({
      prioritizedFixes: [
        { priority: "low", message: "low fix", sectionKey: "skills" },
        { priority: "high", message: "high fix", sectionKey: "experience" },
        { priority: "medium", message: "medium fix", sectionKey: "education" },
      ],
    });
    const recs = buildAtsRecommendations([], scan);
    expect(recs.map((r) => r.priority)).toEqual(["high", "medium", "low"]);
  });

  it("groups summary/experience/skills/education sections under their own name and everything else (including personal, and no section at all) under format", () => {
    const issues = [formatIssue({ id: "personal", sectionKey: "personal" }), formatIssue({ id: "experience", sectionKey: "experience" })];
    const scan = emptyScan({ prioritizedFixes: [{ priority: "low", message: "no section", sectionKey: null }] });
    const recs = buildAtsRecommendations(issues, scan);
    expect(recs.find((r) => r.id.endsWith("personal"))?.group).toBe("format");
    expect(recs.find((r) => r.id.endsWith("experience"))?.group).toBe("experience");
    expect(recs.find((r) => r.message === "no section")?.group).toBe("format");
  });

  it("returns nothing from missingKeywords/prioritizedFixes when scan is null, even with real formatIssues", () => {
    const recs = buildAtsRecommendations([formatIssue()], null);
    expect(recs).toHaveLength(1);
    expect(recs[0].keywordTerm).toBeNull();
  });

  it("carries the keyword term and occurrence count into the message for a missing keyword", () => {
    const scan = emptyScan({
      missingKeywords: [
        { term: "Kubernetes", importance: "high", occurrenceCount: 3, suggestedSection: "skills" },
        { term: "Terraform", importance: "medium", occurrenceCount: 0, suggestedSection: "skills" },
      ],
    });
    const recs = buildAtsRecommendations([], scan);
    const withCount = recs.find((r) => r.keywordTerm === "Kubernetes");
    const withoutCount = recs.find((r) => r.keywordTerm === "Terraform");
    expect(withCount?.message).toBe('Add "Kubernetes" — mentioned 3× in the job description.');
    expect(withoutCount?.message).toBe('Add "Terraform".');
  });
});

describe("groupAtsRecommendations", () => {
  it("preserves RECOMMENDATION_GROUP_ORDER and omits empty groups", () => {
    const recs = buildAtsRecommendations(
      [formatIssue({ id: "skills-issue", sectionKey: "skills" }), formatIssue({ id: "summary-issue", sectionKey: "summary" })],
      null,
    );
    const buckets = groupAtsRecommendations(recs);
    // Order defined as summary, experience, skills, education, format —
    // summary must come before skills in the output regardless of the
    // order the two issues were pushed in.
    expect(buckets.map((b) => b.group)).toEqual(["summary", "skills"]);
  });

  it("omits a group entirely when it has no recommendations", () => {
    const recs = buildAtsRecommendations([formatIssue({ sectionKey: "summary" })], null);
    const buckets = groupAtsRecommendations(recs);
    expect(buckets.find((b) => b.group === "experience")).toBeUndefined();
    expect(buckets).toHaveLength(1);
  });
});
