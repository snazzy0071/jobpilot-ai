import { describe, expect, it } from "vitest";
import { getRoleHomePath, isPathValidForRole, resolvePostAuthPath } from "@/lib/auth/role-redirect";

describe("getRoleHomePath", () => {
  it("maps each role to its own home, defaulting to the user dashboard", () => {
    expect(getRoleHomePath("admin")).toBe("/admin");
    expect(getRoleHomePath("institution_admin")).toBe("/institution-admin");
    expect(getRoleHomePath("user")).toBe("/dashboard");
    expect(getRoleHomePath(undefined)).toBe("/dashboard");
  });
});

describe("resolvePostAuthPath", () => {
  it("uses the role home when nothing was requested", () => {
    expect(resolvePostAuthPath("admin", null)).toBe("/admin");
    expect(resolvePostAuthPath("institution_admin", undefined)).toBe("/institution-admin");
    expect(resolvePostAuthPath("user", null)).toBe("/dashboard");
  });

  it("keeps a requested path that belongs to the role, including query and hash", () => {
    expect(resolvePostAuthPath("admin", "/admin/users?q=a#top")).toBe("/admin/users?q=a#top");
    expect(resolvePostAuthPath("institution_admin", "/institution-admin/cohorts")).toBe("/institution-admin/cohorts");
    expect(resolvePostAuthPath("user", "/dashboard/cvs")).toBe("/dashboard/cvs");
    expect(resolvePostAuthPath("user", "/dashboard/settings?tab=billing")).toBe("/dashboard/settings?tab=billing");
  });

  it("never sends an admin to the user dashboard, or a user into another role's area", () => {
    expect(resolvePostAuthPath("admin", "/dashboard")).toBe("/admin");
    expect(resolvePostAuthPath("admin", "/dashboard/cvs")).toBe("/admin");
    expect(resolvePostAuthPath("admin", "/onboarding")).toBe("/admin");
    expect(resolvePostAuthPath("admin", "/institution-admin")).toBe("/admin");
    expect(resolvePostAuthPath("institution_admin", "/admin")).toBe("/institution-admin");
    expect(resolvePostAuthPath("institution_admin", "/dashboard")).toBe("/institution-admin");
    expect(resolvePostAuthPath("user", "/admin/users")).toBe("/dashboard");
    expect(resolvePostAuthPath("user", "/institution-admin")).toBe("/dashboard");
    expect(resolvePostAuthPath(null, "/admin")).toBe("/dashboard");
  });

  it("can't be tricked past the area check with dot segments, encoding or case", () => {
    expect(resolvePostAuthPath("user", "/dashboard/../admin")).toBe("/dashboard");
    expect(resolvePostAuthPath("user", "/%61dmin")).toBe("/dashboard");
    expect(resolvePostAuthPath("user", "/Admin/users")).toBe("/dashboard");
    expect(resolvePostAuthPath("admin", "/dashboard/%2e%2e/dashboard")).toBe("/admin");
  });

  it("keeps neutral pages for every role (public pages and the email-link flows)", () => {
    for (const role of ["admin", "institution_admin", "user"]) {
      expect(resolvePostAuthPath(role, "/reset-password")).toBe("/reset-password");
      expect(resolvePostAuthPath(role, "/signup/verified")).toBe("/signup/verified");
      expect(resolvePostAuthPath(role, "/pricing")).toBe("/pricing");
    }
  });

  it("rejects open-redirect shapes", () => {
    for (const bad of ["//evil.com", "https://evil.com", String.raw`/\evil.com`, "javascript:alert(1)", "evil.com"]) {
      expect(isPathValidForRole("user", bad)).toBe(false);
      expect(resolvePostAuthPath("admin", bad)).toBe("/admin");
    }
  });

  it("does not treat lookalike prefixes as the restricted area", () => {
    expect(resolvePostAuthPath("user", "/administrators")).toBe("/administrators");
    expect(resolvePostAuthPath("admin", "/dashboards")).toBe("/dashboards");
  });
});
