import { existsSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

// Every area of the app has the three shared states, and each dynamic detail area has a not-found. A route with none of these shows a
// blank screen, a raw stack trace or Next's default 404.
const app = path.join(process.cwd(), "src", "app");
const AREAS = ["(dashboard)/dashboard", "admin", "institution-admin"];

describe("route-level states", () => {
  for (const area of AREAS) {
    it(`${area} has loading, error and not-found`, () => {
      for (const file of ["loading.tsx", "error.tsx", "not-found.tsx"]) expect(existsSync(path.join(app, ...area.split("/"), file)), `${area}/${file}`).toBe(true);
    });
  }
  it("the app has a branded root 404 and a last-resort error boundary", () => {
    for (const file of ["not-found.tsx", "error.tsx", "global-error.tsx"]) expect(existsSync(path.join(app, file)), file).toBe(true);
  });
});
