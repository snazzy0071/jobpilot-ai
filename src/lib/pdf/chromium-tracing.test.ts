import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { describe, expect, it } from "vitest";
import nextConfig from "../../../next.config";

// @sparticuz/chromium finds its binary via import.meta.url + "../bin", which Next's file tracing can't follow, so
// every route that launches a browser must list the bin folder in outputFileTracingIncludes or the deployed function
// has no Chromium (PDF export fails on Vercel while working locally). This keeps that list honest.

const ROOT = join(__dirname, "..", "..", "..");
const API_DIR = join(ROOT, "src", "app", "api");
const LAUNCHES_A_BROWSER = /generate(Cv|CoverLetter|QuickScan)Pdf|launchBrowser/;

/** Route path (e.g. /api/cvs/[cvId]/export) of every API route that launches a browser, directly or via a pdf-export module. */
function routesThatLaunchABrowser(dir = API_DIR): string[] {
  const routes: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      routes.push(...routesThatLaunchABrowser(path));
    } else if (entry.name === "route.ts" && LAUNCHES_A_BROWSER.test(readFileSync(path, "utf8"))) {
      routes.push("/api/" + relative(API_DIR, dir).split(sep).join("/"));
    }
  }
  return routes;
}

/** outputFileTracingIncludes keys are route globs, so brackets in dynamic segments are escaped. */
const toGlobKey = (route: string) => route.split("[").join("\\[").split("]").join("\\]");

const tracesChromium = expect.arrayContaining([expect.stringContaining("@sparticuz/chromium/bin")]);

describe("Chromium binary tracing", () => {
  it("ships the browser's bin folder with every route that launches one", () => {
    const includes = nextConfig.outputFileTracingIncludes ?? {};
    const routes = routesThatLaunchABrowser();
    expect(routes.length).toBeGreaterThanOrEqual(3);
    for (const route of routes) {
      expect(includes[toGlobKey(route)], `${route} launches Chromium but doesn't trace @sparticuz/chromium/bin`).toEqual(tracesChromium);
    }
    // The free ATS checker's server action emails the report PDF.
    expect(includes["/free-ats-checker"]).toEqual(tracesChromium);
  });

  it("points at a folder that really holds the compressed binaries", () => {
    const bin = join(ROOT, "node_modules", "@sparticuz", "chromium", "bin");
    expect(existsSync(bin)).toBe(true);
    expect(readdirSync(bin)).toEqual(expect.arrayContaining(["chromium.br"]));
  });
});
