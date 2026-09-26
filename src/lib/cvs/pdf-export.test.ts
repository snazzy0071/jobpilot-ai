import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/cvs/queries", () => ({ getCvEditorData: vi.fn() }));
vi.mock("@/lib/pdf/launch-browser", () => ({ launchBrowser: vi.fn() }));
vi.mock("@/config/site", () => ({ siteConfig: { domain: "https://jobpilotai.com" } }));

describe("resolveRenderOrigin", () => {
  it("renders from the deployment that received the request, so the PDF is drawn by the same build as the preview", async () => {
    const { resolveRenderOrigin } = await import("@/lib/cvs/pdf-export");
    expect(resolveRenderOrigin("http://localhost:3100/api/cvs/x/export")).toBe("http://localhost:3100");
    expect(resolveRenderOrigin("https://jobpilot-git-feature-acme.vercel.app/api/cvs/x/export?template=oxford")).toBe(
      "https://jobpilot-git-feature-acme.vercel.app",
    );
    expect(resolveRenderOrigin("https://jobpilotai.com/api/cvs/x/export")).toBe("https://jobpilotai.com");
  });

  it("never sends the user's session cookies to a host taken from an untrusted request header", async () => {
    const { resolveRenderOrigin } = await import("@/lib/cvs/pdf-export");
    expect(resolveRenderOrigin("https://evil.example.com/api/cvs/x/export")).toBe("https://jobpilotai.com");
    expect(resolveRenderOrigin("https://jobpilotai.com.evil.example/api")).toBe("https://jobpilotai.com");
  });

  it("falls back to the configured domain with no or a malformed URL", async () => {
    const { resolveRenderOrigin } = await import("@/lib/cvs/pdf-export");
    expect(resolveRenderOrigin(undefined)).toBe("https://jobpilotai.com");
    expect(resolveRenderOrigin("not a url")).toBe("https://jobpilotai.com");
  });
});

describe("isTransientNavigationError", () => {
  it("retries only when the browser page went away, never for a real rendering problem", async () => {
    const { isTransientNavigationError } = await import("@/lib/cvs/pdf-export");
    expect(isTransientNavigationError(new Error("Navigating frame was detached"))).toBe(true);
    expect(isTransientNavigationError(new Error("boom", { cause: new Error("LifecycleWatcher disposed") }))).toBe(true);
    expect(isTransientNavigationError(new Error("Protocol error: Target closed"))).toBe(true);
    expect(isTransientNavigationError(new Error("Print page responded with 404"))).toBe(false);
    expect(isTransientNavigationError(new Error("The print page didn't say which template/version it rendered."))).toBe(false);
    expect(isTransientNavigationError("not an error")).toBe(false);
  });
});
