import { describe, expect, it } from "vitest";
import { deriveVerdict, VERDICT_THRESHOLDS } from "@/lib/jobs/matching/verdict";

describe("deriveVerdict", () => {
  it("classifies a score at or above the strong_match threshold as strong_match", () => {
    expect(deriveVerdict(VERDICT_THRESHOLDS.strongMatch)).toBe("strong_match");
    expect(deriveVerdict(100)).toBe("strong_match");
  });

  it("classifies a score at the worth_applying threshold, but just below strong_match, as worth_applying", () => {
    expect(deriveVerdict(VERDICT_THRESHOLDS.worthApplying)).toBe("worth_applying");
    expect(deriveVerdict(VERDICT_THRESHOLDS.strongMatch - 1)).toBe("worth_applying");
  });

  it("classifies a score at the stretch threshold, but just below worth_applying, as stretch", () => {
    expect(deriveVerdict(VERDICT_THRESHOLDS.stretch)).toBe("stretch");
    expect(deriveVerdict(VERDICT_THRESHOLDS.worthApplying - 1)).toBe("stretch");
  });

  it("classifies anything below the stretch threshold as not_a_fit", () => {
    expect(deriveVerdict(VERDICT_THRESHOLDS.stretch - 1)).toBe("not_a_fit");
    expect(deriveVerdict(0)).toBe("not_a_fit");
  });

  it("is a total function across the full 0-100 range with no gaps between bands", () => {
    for (let score = 0; score <= 100; score++) {
      expect(["strong_match", "worth_applying", "stretch", "not_a_fit"]).toContain(deriveVerdict(score));
    }
  });
});
