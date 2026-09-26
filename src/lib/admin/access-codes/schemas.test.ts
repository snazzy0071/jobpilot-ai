import { describe, expect, it } from "vitest";
import { createAccessCodeSchema } from "@/lib/admin/access-codes/schemas";

const blank = { code: "", label: "Cohort", maxRedemptions: "", expiresAt: "", institutionId: undefined, grantedPlanId: undefined };

describe("createAccessCodeSchema", () => {
  it("accepts a code with no institution and no plan, as the form sends it when both are left on None", () => {
    const parsed = createAccessCodeSchema.safeParse(blank);
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data).toMatchObject({ code: null, label: "Cohort", institutionId: null, grantedPlanId: null, expiresAt: null });
  });

  it("upper-cases a typed code and reads the numeric limit", () => {
    const parsed = createAccessCodeSchema.safeParse({ ...blank, code: " manc2026 ", maxRedemptions: "25" });
    expect(parsed.success && parsed.data.code).toBe("MANC2026");
    expect(parsed.success && parsed.data.maxRedemptions).toBe(25);
  });

  it("refuses a missing label, a non-positive limit and ids that are not UUIDs", () => {
    expect(createAccessCodeSchema.safeParse({ ...blank, label: " " }).success).toBe(false);
    expect(createAccessCodeSchema.safeParse({ ...blank, maxRedemptions: "0" }).success).toBe(false);
    expect(createAccessCodeSchema.safeParse({ ...blank, institutionId: "nope" }).success).toBe(false);
    expect(createAccessCodeSchema.safeParse({ ...blank, grantedPlanId: "nope" }).success).toBe(false);
  });
});
