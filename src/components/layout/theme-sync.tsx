"use client";

import { useLayoutEffect } from "react";

/**
 * Re-applies the theme class whenever the root layout mounts on the client.
 *
 * public/theme-init.js puts `.dark` on <html> before first paint, but React owns <html>: if hydration fails anywhere
 * on a page (a browser extension editing the DOM, or a reduced-motion branch that renders differently on the server),
 * React rebuilds the tree from scratch on the client and resets <html>'s className to what the layout rendered, which
 * has no `.dark`. The page then silently flips to light. This runs after that rebuild too, so the saved choice
 * (dark unless the visitor picked light; /print/* always light) always wins.
 */
export function ThemeSync() {
  useLayoutEffect(() => {
    let dark = true;
    try {
      if (localStorage.getItem("theme") === "light") dark = false;
    } catch {
      // Storage blocked: keep the default.
    }
    if (window.location.pathname.startsWith("/print/")) dark = false;
    document.documentElement.classList.toggle("dark", dark);
  }, []);
  return null;
}
