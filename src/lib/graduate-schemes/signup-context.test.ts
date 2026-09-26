import { describe, expect, it } from "vitest";
import { GRAD_SCHEME_METADATA_KEY, parseSchemeSignupParams, parseSchemeSlug, readPendingSchemeSlug, schemePreparePath, schemeSignupPath } from "@/lib/graduate-schemes/signup-context";
import { isPathValidForRole } from "@/lib/auth/role-redirect";

describe("parseSchemeSlug", () => {
  it("accepts a lower-case slug (and normalises case/space)", () => {
    expect(parseSchemeSlug("acme-tech-grad-2027")).toBe("acme-tech-grad-2027");
    expect(parseSchemeSlug("  Acme-Tech ")).toBe("acme-tech");
  });
  it("rejects anything that isn't a slug — paths, scripts, urls, empty, non-strings", () => {
    for (const bad of ["../admin", "a/b", "<script>", "a b", "https://evil.test", "-a", "a--b", "", "   ", 5, null, undefined, {}, "x".repeat(201)]) {
      expect(parseSchemeSlug(bad), String(bad)).toBeNull();
    }
  });
  it("takes the first value when a parameter is repeated", () => {
    expect(parseSchemeSlug(["a-b", "c-d"])).toBe("a-b");
  });
});

describe("parseSchemeSignupParams", () => {
  it("needs from=grad AND a valid scheme", () => {
    expect(parseSchemeSignupParams({ from: "grad", scheme: "a-b" })).toBe("a-b");
    expect(parseSchemeSignupParams({ scheme: "a-b" })).toBeNull();
    expect(parseSchemeSignupParams({ from: "other", scheme: "a-b" })).toBeNull();
    expect(parseSchemeSignupParams({ from: "grad" })).toBeNull();
    expect(parseSchemeSignupParams({ from: "grad", scheme: "../x" })).toBeNull();
    expect(parseSchemeSignupParams({})).toBeNull();
  });
});

describe("paths", () => {
  it("builds the signup and preparation paths", () => {
    expect(schemeSignupPath("a-b")).toBe("/signup?from=grad&scheme=a-b");
    expect(schemePreparePath("a-b")).toBe("/dashboard/graduate-schemes/a-b/prepare");
  });
  it("the preparation path is valid for a normal user and never for an admin's area", () => {
    expect(isPathValidForRole("user", schemePreparePath("a-b"))).toBe(true);
    expect(isPathValidForRole("admin", schemePreparePath("a-b"))).toBe(false);
  });
});

describe("readPendingSchemeSlug", () => {
  it("reads a valid slug from account metadata and ignores anything else", () => {
    expect(readPendingSchemeSlug({ user_metadata: { [GRAD_SCHEME_METADATA_KEY]: "a-b" } })).toBe("a-b");
    expect(readPendingSchemeSlug({ user_metadata: { [GRAD_SCHEME_METADATA_KEY]: "/admin" } })).toBeNull();
    expect(readPendingSchemeSlug({ user_metadata: {} })).toBeNull();
    expect(readPendingSchemeSlug({ user_metadata: null })).toBeNull();
    expect(readPendingSchemeSlug(null)).toBeNull();
  });
});
