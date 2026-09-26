"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

/**
 * The signed-in shells scroll inside `#main-content`, not the window, so the framework's own scroll-to-top on navigation can land a
 * few pixels off (or not at all) once a page streams in behind a loading screen. Moving to a different page always starts at its top;
 * changing only the query string (a settings tab, a filter) keeps the position.
 */
export function ScrollReset() {
  const pathname = usePathname();
  useEffect(() => {
    document.getElementById("main-content")?.scrollTo({ top: 0 });
  }, [pathname]);
  return null;
}
