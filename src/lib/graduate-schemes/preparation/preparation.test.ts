import { describe, expect, it } from "vitest";
import { ATS_READY_SCORE, journeyPercent, nextStep, stepStatuses, testRowReady, type JourneyInput, type TestRow } from "@/lib/graduate-schemes/preparation/progress";
import { computeCvReadiness } from "@/lib/graduate-schemes/preparation/readiness";
import { buildSchemeBrief } from "@/lib/graduate-schemes/preparation/brief";
import type { CvEditorData } from "@/lib/cvs/types";
import type { SchemeAssessment } from "@/lib/graduate-schemes/types";

const row = (over: Partial<TestRow> = {}): TestRow => ({ assessmentType: "numerical", testTypeSlug: "numerical-reasoning", name: "Numerical Reasoning", answers: 0, accuracy: null, ...over });

const empty: JourneyInput = {
  started: false,
  cv: null,
  ats: null,
  tests: [],
  testsLocked: false,
  interview: { total: 0, completed: 0, bestScore: null, inProgressId: null, latestCompletedId: null },
  tracker: null,
};
const with_ = (over: Partial<JourneyInput>): JourneyInput => ({ ...empty, ...over });

describe("stepStatuses", () => {
  it("starts with everything to do, and no applicable tests", () => {
    const s = stepStatuses(empty);
    expect(s).toEqual({ scheme: "todo", cv: "todo", ats: "todo", tests: "not_applicable", interview: "todo", tracker: "todo" });
    expect(nextStep(s)).toBe("scheme");
  });
  it("follows the flow scheme -> CV -> ATS -> tests -> interview -> tracker", () => {
    let input = with_({ started: true, tests: [row()] });
    expect(nextStep(stepStatuses(input))).toBe("cv");
    input = with_({ ...input, cv: { id: "c", title: "T", readinessPercent: 100, ready: true } });
    expect(nextStep(stepStatuses(input))).toBe("ats");
    input = with_({ ...input, ats: { scanId: "s", score: 82, createdAt: "" } });
    expect(nextStep(stepStatuses(input))).toBe("tests");
    input = with_({ ...input, tests: [row({ answers: 12, accuracy: 80 })] });
    expect(nextStep(stepStatuses(input))).toBe("interview");
    input = with_({ ...input, interview: { ...empty.interview, total: 1, completed: 1, bestScore: 70 } });
    expect(nextStep(stepStatuses(input))).toBe("tracker");
    input = with_({ ...input, tracker: { applicationId: "a", status: "wishlist" } });
    expect(nextStep(stepStatuses(input))).toBeNull();
    expect(journeyPercent(stepStatuses(input))).toBe(100);
  });
  it("a CV that isn't ready, or an ATS score under the bar, stays in progress", () => {
    const s = stepStatuses(with_({ started: true, cv: { id: "c", title: "T", readinessPercent: 60, ready: false }, ats: { scanId: "s", score: ATS_READY_SCORE - 1, createdAt: "" } }));
    expect(s.cv).toBe("in_progress");
    expect(s.ats).toBe("in_progress");
    expect(stepStatuses(with_({ ats: { scanId: "s", score: ATS_READY_SCORE, createdAt: "" } })).ats).toBe("done");
  });
  it("tests need enough answers AND accuracy for every type; some practice is in progress", () => {
    expect(testRowReady(row({ answers: 9, accuracy: 100 }))).toBe(false);
    expect(testRowReady(row({ answers: 10, accuracy: 69 }))).toBe(false);
    expect(testRowReady(row({ answers: 10, accuracy: 70 }))).toBe(true);
    expect(stepStatuses(with_({ tests: [row({ answers: 20, accuracy: 90 }), row({ testTypeSlug: "verbal-reasoning", assessmentType: "verbal", answers: 3, accuracy: 50 })] })).tests).toBe("in_progress");
    expect(stepStatuses(with_({ tests: [row()] })).tests).toBe("todo");
  });
  it("a plan without Test Prep locks the step, and it isn't counted against progress or offered as next", () => {
    const s = stepStatuses(with_({ started: true, cv: { id: "c", title: "T", readinessPercent: 100, ready: true }, ats: { scanId: "s", score: 90, createdAt: "" }, tests: [row()], testsLocked: true }));
    expect(s.tests).toBe("locked");
    expect(nextStep(s)).toBe("interview");
    expect(journeyPercent(s)).toBe(60); // 3 of 5 counted (scheme, cv, ats done; interview, tracker to do)
  });
  it("an interview counts once completed; one in progress is progress", () => {
    expect(stepStatuses(with_({ interview: { ...empty.interview, total: 1 } })).interview).toBe("in_progress");
    expect(stepStatuses(with_({ interview: { ...empty.interview, total: 2, completed: 1 } })).interview).toBe("done");
  });
});

describe("computeCvReadiness", () => {
  const cv = (over: Partial<CvEditorData> = {}) =>
    ({
      cvId: "c", cvTitle: "T", template: "classic", versionId: "v", versionNumber: 1, atsScore: null, sectionOrder: [],
      personal: { fullName: "A B", email: "a@b.co" }, summary: { content: "A long enough professional summary that says something useful." },
      experience: [{ id: "e", jobTitle: "Analyst", employer: "X", description: "Did a lot of useful work that involved several things.", isVisible: true }],
      education: [{ id: "d", institution: "Uni", degree: "BSc", isVisible: true }], skills: [{ id: "s", name: "SQL", isVisible: true }], projects: [], certifications: [], languages: [], customSections: [],
      ...over,
    }) as unknown as CvEditorData;

  it("a complete CV is ready", () => {
    const r = computeCvReadiness(cv());
    expect(r.percent).toBe(100);
    expect(r.checks.every((c) => c.ok)).toBe(true);
  });
  it("names what is missing and is not ready", () => {
    const r = computeCvReadiness(cv({ summary: null, skills: [] }));
    expect(r.percent).toBe(60);
    expect(r.checks.filter((c) => !c.ok).map((c) => c.key)).toEqual(["summary", "skills"]);
    expect(r.ready).toBe(false);
  });
  it("an empty CV is 0%", () => {
    expect(computeCvReadiness(cv({ personal: null, summary: null, experience: [], education: [], skills: [] })).percent).toBe(0);
  });
});

describe("buildSchemeBrief", () => {
  const a = (type: SchemeAssessment["type"], over: Partial<SchemeAssessment> = {}): SchemeAssessment => ({ id: type, schemeId: "s", type, label: null, provider: null, notes: null, isRequired: true, displayOrder: 0, sourceUrl: "https://e.com", sourceDate: "2026-01-01", verifiedAt: "2026-01-02", ...over });
  const base = { employer: "Acme", schemeName: "Grad Programme", sector: "technology" as const, description: null, studyStages: [], locations: [], salary: null, assessments: [] };

  it("uses only fields the record has", () => {
    const brief = buildSchemeBrief(base);
    expect(brief).toBe("Grad Programme at Acme.\nSector: Technology.");
    expect(brief.length).toBeGreaterThanOrEqual(30); // enough for the ATS scan's minimum
  });
  it("includes what is present, and only required assessments", () => {
    const brief = buildSchemeBrief({ ...base, description: "Two-year rotation.", studyStages: ["final_year"], locations: ["Leeds", "London"], salary: "£30,000", assessments: [a("numerical"), a("watson_glaser", { isRequired: false }), a("other", { label: "Group exercise" })] });
    expect(brief).toContain("Two-year rotation.");
    expect(brief).toContain("Open to: Final-year students.");
    expect(brief).toContain("Locations: Leeds, London.");
    expect(brief).toContain("Salary: £30,000.");
    expect(brief).toContain("Selection process: Numerical reasoning test, Group exercise.");
    expect(brief).not.toContain("Watson");
  });
});
