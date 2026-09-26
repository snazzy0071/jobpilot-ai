import { describe, expect, it } from "vitest";
import { isBearerMatch } from "@/lib/auth/bearer";

describe("isBearerMatch", () => {
  it("accepts exactly the configured secret", () => {
    expect(isBearerMatch("Bearer s3cret", "s3cret")).toBe(true);
  });
  it("refuses anything else, including a missing header, a wrong scheme, a prefix and an empty secret", () => {
    for (const header of [null, "", "s3cret", "Bearer s3cre", "Bearer s3crets", "bearer s3cret", "Basic s3cret"]) expect(isBearerMatch(header, "s3cret")).toBe(false);
    expect(isBearerMatch("Bearer ", "")).toBe(false);
  });
});
