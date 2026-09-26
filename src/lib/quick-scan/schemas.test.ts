import { describe, expect, it } from "vitest";
import { quickScanFieldsSchema } from "@/lib/quick-scan/schemas";

const EMAIL = "ada@example.com";
const REAL_JOB_DESCRIPTION = "We are hiring a Senior Platform Engineer with strong TypeScript and Kubernetes experience.";

describe("quickScanFieldsSchema", () => {
  it("accepts a real job description", () => {
    const parsed = quickScanFieldsSchema.parse({ email: EMAIL, jobDescription: REAL_JOB_DESCRIPTION });
    expect(parsed.jobDescription).toBe(REAL_JOB_DESCRIPTION);
  });

  it("treats an absent, empty, whitespace-only, null, or undefined job description as genuinely optional — not an error", () => {
    for (const value of [undefined, "", "   ", null]) {
      const parsed = quickScanFieldsSchema.parse({ email: EMAIL, jobDescription: value });
      expect(parsed.jobDescription).toBeUndefined();
    }
    // Omitted entirely (no key at all), the same as a real form submission with the field left blank.
    const parsed = quickScanFieldsSchema.parse({ email: EMAIL });
    expect(parsed.jobDescription).toBeUndefined();
  });

  it("still rejects a job description that's real text but too short to be an actual job description", () => {
    const result = quickScanFieldsSchema.safeParse({ email: EMAIL, jobDescription: "Too short." });
    expect(result.success).toBe(false);
  });

  it("still requires a real email either way", () => {
    expect(quickScanFieldsSchema.safeParse({ email: "", jobDescription: REAL_JOB_DESCRIPTION }).success).toBe(false);
    expect(quickScanFieldsSchema.safeParse({ email: "not-an-email" }).success).toBe(false);
  });

  it("caps the job description length", () => {
    expect(quickScanFieldsSchema.safeParse({ email: EMAIL, jobDescription: "x".repeat(20_001) }).success).toBe(false);
    expect(quickScanFieldsSchema.safeParse({ email: EMAIL, jobDescription: "x".repeat(20_000) }).success).toBe(true);
  });
});
