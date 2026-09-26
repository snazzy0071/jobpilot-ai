import { describe, expect, it } from "vitest";
import { INDUSTRY_OPTIONS, aboutStepSchema, industryFieldId, logisticsStepSchema, targetsStepSchema } from "@/lib/onboarding/schemas";

describe("industryFieldId", () => {
  it("gives every industry a valid, unique element id (no spaces or ampersands, which break the label link)", () => {
    const ids = INDUSTRY_OPTIONS.map(industryFieldId);
    for (const id of ids) expect(id).toMatch(/^industry-[a-z0-9]+(-[a-z0-9]+)*$/);
    expect(new Set(ids).size).toBe(ids.length);
    expect(industryFieldId("Finance & Banking")).toBe("industry-finance-banking");
  });
});

describe("onboarding steps", () => {
  it("about: needs a known career stage and goal", () => {
    expect(aboutStepSchema.safeParse({ careerStage: "recent_graduate", primaryGoal: "first_role" }).success).toBe(true);
    expect(aboutStepSchema.safeParse({ careerStage: "astronaut", primaryGoal: "first_role" }).success).toBe(false);
  });

  it("targets: splits and trims the roles, caps them at ten, and needs a role and an industry", () => {
    const parsed = targetsStepSchema.safeParse({ targetRoles: " Analyst , Researcher,, ", industries: ["Technology"] });
    expect(parsed.success && parsed.data.targetRoles).toEqual(["Analyst", "Researcher"]);
    const many = targetsStepSchema.safeParse({ targetRoles: Array.from({ length: 15 }, (_, i) => `R${i}`).join(","), industries: ["Law"] });
    expect(many.success && many.data.targetRoles).toHaveLength(10);
    expect(targetsStepSchema.safeParse({ targetRoles: " , ", industries: ["Law"] }).success).toBe(false);
    expect(targetsStepSchema.safeParse({ targetRoles: "Analyst", industries: [] }).success).toBe(false);
    expect(targetsStepSchema.safeParse({ targetRoles: "Analyst", industries: ["Not an industry"] }).success).toBe(false);
  });

  it("logistics: needs a location, a plausible graduation year and a sponsorship answer", () => {
    const ok = { location: "Leeds", graduationYear: "2025", visaSponsorshipPreference: "unsure" };
    expect(logisticsStepSchema.safeParse(ok).success).toBe(true);
    expect(logisticsStepSchema.safeParse({ ...ok, location: " " }).success).toBe(false);
    expect(logisticsStepSchema.safeParse({ ...ok, graduationYear: "1900" }).success).toBe(false);
    expect(logisticsStepSchema.safeParse({ ...ok, graduationYear: "abc" }).success).toBe(false);
    expect(logisticsStepSchema.safeParse({ ...ok, visaSponsorshipPreference: "maybe" }).success).toBe(false);
  });
});
