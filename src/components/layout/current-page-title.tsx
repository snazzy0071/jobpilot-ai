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
  const active = items.find((item) => item.href === pathname);

  return <h1 className="font-heading text-base font-semibold">{active?.label ?? fallback}</h1>;
}
