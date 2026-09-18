import { describe, expect, it } from "vitest";
import { computeFormatIssues, buildCvPlainText } from "@/lib/cvs/ats-format-checks";
import type { CvTemplateContentData } from "@/components/cvs/templates/types";
import { SECTION_KEYS } from "@/lib/cvs/types";

function emptyCv(): CvTemplateContentData {
  return {
    personal: null,
    summary: null,
    experience: [],
    education: [],
    skills: [],
    projects: [],
    certifications: [],
    languages: [],
    customSections: [],
    sectionOrder: [...SECTION_KEYS],
  };
}

function withExperience(overrides: Partial<CvTemplateContentData["experience"][number]> = {}) {
  return {
    id: "exp-1",
    jobTitle: "Engineer",
    employer: "Acme",
    location: null,
    startDate: "2020-01-01",
    endDate: null,
    isCurrent: true,
    description: null,
    displayOrder: 0,
    ...overrides,
  };
}

describe("computeFormatIssues", () => {
  it("flags every missing section on a completely empty CV", () => {
    const issues = computeFormatIssues(emptyCv());
    const ids = issues.map((issue) => issue.id);
    expect(ids).toContain("personal-name");
    expect(ids).toContain("personal-contact");
    expect(ids).toContain("summary-missing");
    expect(ids).toContain("experience-missing");
    expect(ids).toContain("skills-missing");
  });

  it("does not flag a name that is only whitespace as present", () => {
    const cv = emptyCv();
    cv.personal = {
      id: "p1",
      fullName: "   ",
      headline: null,
      email: null,
      phone: null,
      location: null,
      websiteUrl: null,
      linkedinUrl: null,
      portfolioUrl: null,
    };
    const issues = computeFormatIssues(cv);
    expect(issues.map((i) => i.id)).toContain("personal-name");
  });

  it("accepts either an email or a phone for the contact check, not both", () => {
    const cv = emptyCv();
    cv.personal = {
      id: "p1",
      fullName: "Jane Doe",
      headline: null,
      email: null,
      phone: "07000000000",
      location: null,
      websiteUrl: null,
      linkedinUrl: null,
      portfolioUrl: null,
    };
    const issues = computeFormatIssues(cv);
    expect(issues.map((i) => i.id)).not.toContain("personal-contact");
  });

  it("warns on a missing summary but only infos on a short one", () => {
    const missing = computeFormatIssues(emptyCv());
    expect(missing.find((i) => i.id === "summary-missing")?.severity).toBe("warning");

    const short = emptyCv();
    short.summary = { id: "s1", content: "Too short." };
    const shortIssues = computeFormatIssues(short);
    expect(shortIssues.find((i) => i.id === "summary-short")?.severity).toBe("info");
    expect(shortIssues.map((i) => i.id)).not.toContain("summary-missing");
  });

  it("does not flag a summary at exactly the 40-character threshold", () => {
    const cv = emptyCv();
    cv.summary = { id: "s1", content: "x".repeat(40) };
    const issues = computeFormatIssues(cv);
    expect(issues.map((i) => i.id)).not.toContain("summary-short");
    expect(issues.map((i) => i.id)).not.toContain("summary-missing");
  });

  it("ignores an experience row with no job title or employer for the missing-experience check", () => {
    const cv = emptyCv();
    cv.experience = [withExperience({ jobTitle: "", employer: "" })];
    const issues = computeFormatIssues(cv);
    expect(issues.map((i) => i.id)).toContain("experience-missing");
  });

  it("flags a real experience row with no description, and only infos a thin one", () => {
    const cv = emptyCv();
    cv.experience = [withExperience({ id: "e1", description: null })];
    const missingDesc = computeFormatIssues(cv);
    const missing = missingDesc.find((i) => i.id === "experience-desc-e1");
    expect(missing?.severity).toBe("warning");

    cv.experience = [withExperience({ id: "e2", description: "Too short" })];
    const thin = computeFormatIssues(cv);
    expect(thin.find((i) => i.id === "experience-thin-e2")?.severity).toBe("info");
  });

  it("does not flag skills when at least one is visible", () => {
    const cv = emptyCv();
    cv.skills = [{ id: "sk1", name: "TypeScript", category: null, displayOrder: 0, isVisible: true }];
    const issues = computeFormatIssues(cv);
    expect(issues.map((i) => i.id)).not.toContain("skills-missing");
  });

  it("still flags missing skills when every skill row is hidden", () => {
    const cv = emptyCv();
    cv.skills = [{ id: "sk1", name: "TypeScript", category: null, displayOrder: 0, isVisible: false }];
    const issues = computeFormatIssues(cv);
    expect(issues.map((i) => i.id)).toContain("skills-missing");
  });
});

describe("buildCvPlainText", () => {
  it("renders sections in a stable, labeled order and skips empty ones", () => {
    const cv = emptyCv();
    cv.personal = {
      id: "p1",
      fullName: "Jane Doe",
      headline: "Software Engineer",
      email: "jane@example.com",
      phone: null,
      location: null,
      websiteUrl: null,
      linkedinUrl: null,
      portfolioUrl: null,
    };
    cv.summary = { id: "s1", content: "Experienced engineer." };
    cv.experience = [withExperience({ description: "Built things." })];
    cv.skills = [{ id: "sk1", name: "TypeScript", category: null, displayOrder: 0, isVisible: true }];

    const text = buildCvPlainText(cv);
    expect(text).toContain("Jane Doe — Software Engineer");
    expect(text).toContain("Summary:\nExperienced engineer.");
    expect(text).toContain("Experience:\n- Engineer at Acme: Built things.");
    expect(text).toContain("Skills:\nTypeScript");
    // No education/projects/certifications/languages content was set —
    // their headings must not appear at all, not just render empty.
    expect(text).not.toContain("Education:");
    expect(text).not.toContain("Projects:");
  });

  it("omits a hidden skill/project/certification/language from the plain text", () => {
    const cv = emptyCv();
    cv.skills = [{ id: "sk1", name: "Hidden Skill", category: null, displayOrder: 0, isVisible: false }];
    const text = buildCvPlainText(cv);
    expect(text).not.toContain("Hidden Skill");
    expect(text).not.toContain("Skills:");
  });

  it("truncates output to the maximum length rather than growing unbounded", () => {
    const cv = emptyCv();
    cv.summary = { id: "s1", content: "x".repeat(20000) };
    const text = buildCvPlainText(cv);
    expect(text.length).toBeLessThanOrEqual(12000);
  });
});
