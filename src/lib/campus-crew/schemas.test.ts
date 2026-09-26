import { describe, expect, it } from "vitest";
import { campusCrewApplicationSchema } from "@/lib/campus-crew/schemas";

const valid = { name: "Sam Student", email: "sam@example.ac.uk", university: "University of Leeds", course: "", studyYear: "", motivation: "I run the careers society and want to help more people.", reach: "" };

describe("campusCrewApplicationSchema", () => {
  it("accepts a complete application and turns blank optional fields into null", () => {
    const parsed = campusCrewApplicationSchema.safeParse(valid);
    expect(parsed.success && parsed.data).toMatchObject({ course: null, studyYear: null, reach: null, university: "University of Leeds" });
  });
  it("needs a name, a valid email, a university and a real motivation", () => {
    expect(campusCrewApplicationSchema.safeParse({ ...valid, name: " " }).success).toBe(false);
    expect(campusCrewApplicationSchema.safeParse({ ...valid, email: "not-an-email" }).success).toBe(false);
    expect(campusCrewApplicationSchema.safeParse({ ...valid, university: "" }).success).toBe(false);
    expect(campusCrewApplicationSchema.safeParse({ ...valid, motivation: "too short" }).success).toBe(false);
    expect(campusCrewApplicationSchema.safeParse({ ...valid, motivation: "x".repeat(3001) }).success).toBe(false);
  });
});
