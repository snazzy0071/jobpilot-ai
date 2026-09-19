import { existsSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { TOOLS } from "@/config/tools";

// The dashboard's toolkit grid labels a tool "Not built yet" whenever it
// has no `appHref`. Three tools that were built (Job Tracker, Job Match,
// Grad Scheme Prep) were once left without one and showed exactly that
// label on a working dashboard; this keeps the config and the real routes
// in step.
describe("tool catalog", () => {
  it("links every tool to a real dashboard page", () => {
    for (const tool of TOOLS) {
      expect(tool.appHref, `${tool.slug} has no appHref, so the dashboard says "Not built yet"`).toBeTruthy();
      const page = path.join(process.cwd(), "src/app/(dashboard)", tool.appHref!, "page.tsx");
      expect(existsSync(page), `${tool.slug} points at ${tool.appHref}, but ${page} doesn't exist`).toBe(true);
    }
  });
});
