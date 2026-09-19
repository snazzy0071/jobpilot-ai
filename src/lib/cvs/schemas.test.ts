import { describe, expect, it } from "vitest";
import { educationSchema, experienceSchema, personalSchema, projectSchema } from "@/lib/cvs/schemas";

const VERSION_ID = "11111111-1111-4111-8111-111111111111";

// The autosave forms send a FormData snapshot on every change, so the
// server sees `""` for every blank text/date input — and `null` for a field
// that isn't rendered at all (End date while "I currently work here" is
// ticked). Both must mean "no value". A blank end date used to reach the
// database as the string "" and fail with `invalid input syntax for type
// date: ""`, so any role without an end date that wasn't ticked "current"
// (which is every role being typed in, until the end date is filled) could
// not be saved.
describe("blank and missing optional fields mean 'no value'", () => {
  const experience = { versionId: VERSION_ID, jobTitle: "Engineer", employer: "Acme", startDate: "2022-01-01", isCurrent: false };

  it("treats a blank end date as no end date (never the empty string)", () => {
    const parsed = experienceSchema.parse({ ...experience, endDate: "", location: "", description: "" });
    expect(parsed.endDate).toBeUndefined();
    expect(parsed.location).toBeUndefined();
    expect(parsed.description).toBeUndefined();
  });

  it("treats an end date that isn't in the form at all (a current role) as no end date", () => {
    const parsed = experienceSchema.parse({ ...experience, isCurrent: true, endDate: null, location: null, description: null });
    expect(parsed.endDate).toBeUndefined();
    expect(parsed.isCurrent).toBe(true);
  });

  it("treats whitespace-only text as blank", () => {
    expect(experienceSchema.parse({ ...experience, location: "   " }).location).toBeUndefined();
  });

  it("keeps real values, trimmed", () => {
    const parsed = experienceSchema.parse({ ...experience, endDate: " 2023-05-01 ", location: " Leeds " });
    expect(parsed.endDate).toBe("2023-05-01");
    expect(parsed.location).toBe("Leeds");
  });

  it("still rejects an end date before the start date, and an end date on a current role", () => {
    expect(experienceSchema.safeParse({ ...experience, endDate: "2021-01-01" }).success).toBe(false);
    expect(experienceSchema.safeParse({ ...experience, isCurrent: true, endDate: "2023-01-01" }).success).toBe(false);
  });

  it("applies to education dates too", () => {
    const parsed = educationSchema.parse({
      versionId: VERSION_ID,
      institution: "Uni",
      qualification: "BSc",
      startDate: "",
      endDate: null,
      isCurrent: false,
    });
    expect(parsed.startDate).toBeUndefined();
    expect(parsed.endDate).toBeUndefined();
  });

  it("applies to personal details: blank/missing email, phone and links are simply absent", () => {
    const parsed = personalSchema.parse({
      versionId: VERSION_ID,
      fullName: "Ada",
      headline: "",
      email: "",
      phone: null,
      location: "",
      websiteUrl: "",
      linkedinUrl: null,
      portfolioUrl: "",
    });
    expect(parsed).toMatchObject({ fullName: "Ada" });
    for (const key of ["headline", "email", "phone", "location", "websiteUrl", "linkedinUrl", "portfolioUrl"] as const) {
      expect(parsed[key], key).toBeUndefined();
    }
  });

  it("still validates values that are present", () => {
    const base = { versionId: VERSION_ID, fullName: "Ada" };
    expect(personalSchema.safeParse({ ...base, email: "not-an-email" }).success).toBe(false);
    expect(personalSchema.safeParse({ ...base, websiteUrl: "example.com" }).success).toBe(false);
    expect(personalSchema.safeParse({ ...base, email: "ada@example.com", websiteUrl: "https://example.com" }).success).toBe(true);
    expect(personalSchema.safeParse({ ...base, fullName: "" }).success).toBe(false);
  });

  it("applies to project links", () => {
    const parsed = projectSchema.parse({ versionId: VERSION_ID, name: "Site", url: "" });
    expect(parsed.url).toBeUndefined();
  });
});
