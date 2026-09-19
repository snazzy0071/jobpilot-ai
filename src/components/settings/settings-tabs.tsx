"use client";

import { useSyncExternalStore, type ComponentProps } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

// Same breakpoint the app's shells use for their desktop layout switch.
const DESKTOP_QUERY = "(min-width: 1024px)";

function subscribe(onChange: () => void) {
  const query = window.matchMedia(DESKTOP_QUERY);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

/**
 * The settings page's tabs as a two-column layout: a navigation list on
 * the left, the active section on the right (desktop), and the familiar
 * horizontal tab strip above the content on smaller screens. It is the
 * same Base UI Tabs underneath (same values, same `?tab=` deep links,
 * same panels), so every form inside keeps working untouched. The
 * orientation follows the breakpoint too, so arrow-key navigation matches
 * what's on screen (up/down in the sidebar, left/right in the strip).
 * The grid and list styling are plain CSS at `lg`, so the layout is right
 * from the first paint, before the orientation is known on the client.
 */
export function SettingsTabs({ className, ...props }: ComponentProps<typeof Tabs>) {
  const desktop = useSyncExternalStore(
    subscribe,
    () => window.matchMedia(DESKTOP_QUERY).matches,
    () => false,
  );
  return (
    <Tabs
      orientation={desktop ? "vertical" : "horizontal"}
      className={cn("lg:grid lg:grid-cols-[15rem_minmax(0,1fr)] lg:items-start lg:gap-8", className)}
      {...props}
    />
  );
}

/** Left column on desktop (sticky, so it stays in view while the section scrolls); a scrollable strip on mobile. */
export function SettingsTabsList({ className, ...props }: ComponentProps<typeof TabsList>) {
  return (
    <div className="max-w-full overflow-x-auto lg:sticky lg:top-0 lg:col-start-1 lg:row-start-1 lg:overflow-visible">
      <TabsList
        aria-label="Settings sections"
        className={cn("lg:h-auto lg:w-full lg:flex-col lg:items-stretch lg:gap-0.5 lg:p-1.5 lg:group-data-horizontal/tabs:h-auto", className)}
        {...props}
      />
    </div>
  );
}

export function SettingsTab({ className, ...props }: ComponentProps<typeof TabsTrigger>) {
  return (
    <TabsTrigger
      className={cn("px-3 lg:h-auto lg:flex-none lg:justify-start lg:py-2 lg:group-data-horizontal/tabs:h-auto", className)}
      {...props}
    />
  );
}

/** Right column on desktop. The panel's own top padding (for the stacked mobile layout) is dropped when it sits beside the list. */
export function SettingsPanel({ className, ...props }: ComponentProps<typeof TabsContent>) {
  return <TabsContent className={cn("min-w-0 lg:col-start-2 lg:row-start-1 lg:pt-0", className)} {...props} />;
}
