"use client";

import { usePathname } from "next/navigation";
import type { SidebarNavItem } from "@/components/layout/sidebar-nav";

export function CurrentPageTitle({
  items,
  fallback,
}: {
  items: SidebarNavItem[];
  fallback: string;
}) {
  const pathname = usePathname();
  // Exact match first (`/dashboard/cvs`), else the longest nav item whose href is a real path
  // segment prefix of the current route (`/dashboard/cvs/abc123` -> "My CVs", not the generic
  // fallback) — a dynamic/nested page under a section should still show that section's label,
  // not fall back to a bare "Dashboard"/"Admin" every layout already uses for the true top level.
  const active =
    items.find((item) => item.href === pathname) ??
    items
      .filter((item) => item.href !== "/" && pathname.startsWith(`${item.href}/`))
      .sort((a, b) => b.href.length - a.href.length)[0];

  return <h1 className="font-heading text-base font-semibold">{active?.label ?? fallback}</h1>;
}
