import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import CvsError from "./error";
import CvsLoading from "./loading";
import CvEditorError from "./[cvId]/error";
import CvEditorLoading from "./[cvId]/loading";
import CvNotFound from "./[cvId]/not-found";

// The CV routes' loading / error / not-found screens. They can't be reached on demand in a browser (a server
// render would have to fail), so what they must say and offer is checked here.

const error = Object.assign(new Error("boom"), { digest: "abc" });
const noop = () => {};

describe("CV route states", () => {
  it("the list's error screen is an alert that offers a retry and a way out, and doesn't leak the error", () => {
    const html = renderToStaticMarkup(createElement(CvsError, { error, reset: noop }));
    expect(html).toContain('role="alert"');
    expect(html).toContain("Couldn&#x27;t load your CVs");
    expect(html).toContain("Try again");
    expect(html).toContain('href="/dashboard"');
    expect(html).not.toContain("boom");
  });

  it("the editor's error screen reassures that typed work is saved, and offers a retry and the CV list", () => {
    const html = renderToStaticMarkup(createElement(CvEditorError, { error, reset: noop }));
    expect(html).toContain('role="alert"');
    expect(html).toContain("Couldn&#x27;t open this CV");
    expect(html).toContain("saved as you went");
    expect(html).toContain("Try again");
    expect(html).toContain('href="/dashboard/cvs"');
    expect(html).not.toContain("boom");
  });

  it("the not-found screen links back to the CV list", () => {
    const html = renderToStaticMarkup(createElement(CvNotFound));
    expect(html).toContain("data-cv-not-found");
    expect(html).toContain("We couldn&#x27;t find that CV");
    expect(html).toContain('href="/dashboard/cvs"');
  });

  it("the loading screens announce themselves as busy, for assistive tech", () => {
    for (const [Loading, name] of [[CvsLoading, "list"], [CvEditorLoading, "editor"]] as const) {
      const html = renderToStaticMarkup(createElement(Loading));
      expect(html).toContain('aria-busy="true"');
      expect(html).toContain('role="status"');
      expect(html).toContain(`data-cv-loading="${name}"`);
    }
  });
});
