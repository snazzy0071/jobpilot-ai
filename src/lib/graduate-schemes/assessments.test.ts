import { describe, expect, it } from "vitest";
import { parseAssessmentCsv, resolveAssessmentType, saveAssessmentSchema } from "@/lib/graduate-schemes/assessment-schemas";
import { ASSESSMENT_PREP } from "@/config/assessment-prep";
import { ASSESSMENT_LABELS, ASSESSMENT_SHORT_LABELS, ASSESSMENT_TYPES } from "@/lib/graduate-schemes/types";

const base = { schemeId: "3f0c1f9e-6f2e-4b7e-9a51-0f3a5d6b7c8d", type: "numerical", sourceUrl: "https://example.com/selection", sourceDate: "2026-01-01", verifiedAt: "2026-01-02" };

describe("assessment types", () => {
  it("supports exactly the nine kinds asked for, each with names and a prep entry", () => {
    expect([...ASSESSMENT_TYPES]).toEqual(["sjt", "numerical", "verbal", "watson_glaser", "hirevue", "hackerrank", "case_interview", "assessment_centre", "other"]);
    for (const type of ASSESSMENT_TYPES) {
      expect(ASSESSMENT_LABELS[type]).toBeTruthy();
      expect(ASSESSMENT_SHORT_LABELS[type]).toBeTruthy();
      expect(ASSESSMENT_PREP[type].summary).toBeTruthy();
    }
  });
  it("only claims JobPilot practice that exists", () => {
    // Coding tests, case interviews and unclassified stages have nothing built, and must not link anywhere.
    for (const type of ["hackerrank", "case_interview", "other"] as const) {
      expect(ASSESSMENT_PREP[type].coverage).toBe("none");
      expect(ASSESSMENT_PREP[type].links).toEqual([]);
    }
    // The five aptitude formats map to real Test Prep types.
    expect(ASSESSMENT_PREP.sjt.links[0].testTypeSlug).toBe("situational-judgement");
    expect(ASSESSMENT_PREP.numerical.links[0].testTypeSlug).toBe("numerical-reasoning");
    expect(ASSESSMENT_PREP.verbal.links[0].testTypeSlug).toBe("verbal-reasoning");
    expect(ASSESSMENT_PREP.watson_glaser.links[0].testTypeSlug).toBe("critical-thinking");
    // Video interviews and centres are only partial and say what isn't covered.
    expect(ASSESSMENT_PREP.hirevue.coverage).toBe("partial");
    expect(ASSESSMENT_PREP.hirevue.summary).toMatch(/does not reproduce/);
    expect(ASSESSMENT_PREP.assessment_centre.summary).toMatch(/aren't covered/);
  });
});

describe("saveAssessmentSchema", () => {
  it("accepts an assessment with its evidence and defaults to required", () => {
    const parsed = saveAssessmentSchema.parse(base);
    expect(parsed.isRequired).toBe(true);
    expect(parsed.label).toBeNull();
    expect(parsed.provider).toBeNull();
  });
  it("requires a source and coherent dates", () => {
    expect(saveAssessmentSchema.safeParse({ ...base, sourceUrl: "" }).success).toBe(false);
    expect(saveAssessmentSchema.safeParse({ ...base, sourceUrl: "javascript:alert(1)" }).success).toBe(false);
    expect(saveAssessmentSchema.safeParse({ ...base, sourceDate: undefined }).success).toBe(false);
    expect(saveAssessmentSchema.safeParse({ ...base, verifiedAt: "2025-12-01" }).success).toBe(false);
    expect(saveAssessmentSchema.safeParse({ ...base, verifiedAt: "2099-01-01" }).success).toBe(false);
  });
  it("needs a name for 'other' and rejects unknown kinds", () => {
    expect(saveAssessmentSchema.safeParse({ ...base, type: "other" }).success).toBe(false);
    expect(saveAssessmentSchema.safeParse({ ...base, type: "other", label: "Group exercise" }).success).toBe(true);
    expect(saveAssessmentSchema.safeParse({ ...base, type: "personality" }).success).toBe(false);
  });
});

describe("assessment CSV", () => {
  const header = "employer,scheme_name,assessment_type,label,provider,required,notes,source_url,source_date,verified_at";
  it("resolves keys and display names", () => {
    expect(resolveAssessmentType("numerical")).toBe("numerical");
    expect(resolveAssessmentType("Numerical reasoning test")).toBe("numerical");
    expect(resolveAssessmentType("Assessment centre")).toBe("assessment_centre");
    expect(resolveAssessmentType("psychometric")).toBeNull();
  });
  it("parses rows and refuses missing or unknown columns", () => {
    const ok = parseAssessmentCsv(`${header}\nA,B,sjt,,,yes,,https://e.com,2026-01-01,2026-01-02`);
    expect("rows" in ok && ok.rows[0].assessment_type).toBe("sjt");
    expect(parseAssessmentCsv("employer,scheme_name")).toHaveProperty("error");
    expect(parseAssessmentCsv(`${header},extra\nA,B,sjt,,,,,x,y,z,1`)).toHaveProperty("error");
  });
});
