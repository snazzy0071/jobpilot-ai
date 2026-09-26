import { describe, expect, it } from "vitest";
import { parseRedirectParam, toSafeRedirectPath } from "@/lib/auth/safe-redirect";

describe("redirect targets", () => {
  it("accepts ordinary same-site paths, with query and hash", () => {
    for (const ok of ["/dashboard", "/admin/users?tab=roles", "/institution-invite/abc_def-123", "/dashboard/cvs#top", "/graduate-schemes/e2e?x=1&y=2"]) expect(parseRedirectParam(ok), ok).toBe(ok);
  });
  it("rejects every way of reaching another host", () => {
    const bad = [
      "//evil.com",
      "https://evil.com",
      "/\\evil.com",
      "/\\/evil.com",
      "/\t/evil.com",
      "/\n/evil.com",
      "/\r/evil.com",
      "/ /evil.com",
      "/\u0000/evil.com",
      "javascript:alert(1)",
      "evil.com",
      "",
      "/a://b",
      "/" + "a".repeat(3000),
    ];
    for (const value of bad) expect(parseRedirectParam(value), JSON.stringify(value)).toBeNull();
    for (const value of [null, undefined, 5, {}, []]) expect(parseRedirectParam(value)).toBeNull();
  });
  it("falls back when there is nothing safe", () => {
    expect(toSafeRedirectPath("//evil.com")).toBe("/dashboard");
    expect(toSafeRedirectPath("/\\evil.com", "/home")).toBe("/home");
    expect(toSafeRedirectPath("/dashboard/cvs")).toBe("/dashboard/cvs");
  });
  it("anything accepted resolves to the same origin", () => {
    for (const ok of ["/dashboard", "/a/b?c=d"]) expect(new URL(ok, "https://site.test").origin).toBe("https://site.test");
  });
});
