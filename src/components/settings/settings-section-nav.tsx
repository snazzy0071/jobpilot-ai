"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

export type SettingsNavItem = { id: string; label: string; description?: string };

/**
 * Left-hand navigation for a settings page whose sections live in ONE
 * form (so they can't be tabs: hidden panels would drop their fields
 * from the submit). Each entry jumps to its section, and the entry for
 * the section being read is highlighted as the content scrolls. On
 * mobile it becomes a compact row above the form.
 */
export function SettingsSectionNav({ items, label = "Settings sections" }: { items: SettingsNavItem[]; label?: string }) {
  const [active, setActive] = useState(items[0]?.id);

  useEffect(() => {
    const root = document.getElementById("main-content");
    const sections = items.map((item) => document.getElementById(item.id)).filter((el): el is HTMLElement => el !== null);
    if (sections.length === 0) return;
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((entry) => entry.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActive(visible[0].target.id);
      },
      // Whichever section is nearest the top of the scrolling area is "current". On desktop that area is <main>;
      // on mobile the page itself scrolls (main isn't a scroll container there).
      { root: root && root.scrollHeight > root.clientHeight ? root : null, rootMargin: "0px 0px -60% 0px", threshold: 0 },
    );
    for (const section of sections) observer.observe(section);
    return () => observer.disconnect();
  }, [items]);

  return (
    <nav aria-label={label} className="max-w-full overflow-x-auto lg:sticky lg:top-0 lg:overflow-visible">
      <ul className="flex gap-1 rounded-lg border border-border bg-muted p-1.5 lg:flex-col lg:gap-0.5">
        {items.map((item) => {
          const current = item.id === active;
          return (
            <li key={item.id} className="shrink-0">
              <a
                href={`#${item.id}`}
                aria-current={current ? "location" : undefined}
                onClick={() => setActive(item.id)}
                className={cn(
                  "block rounded-md border border-transparent px-3 py-2 text-sm font-medium whitespace-nowrap transition-colors focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none",
                  current ? "bg-background text-foreground shadow-sm" : "text-foreground/60 hover:text-foreground",
                )}
              >
                {item.label}
                {item.description && <span className="hidden text-xs font-normal text-muted-foreground lg:block">{item.description}</span>}
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
