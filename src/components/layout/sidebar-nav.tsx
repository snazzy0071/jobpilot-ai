"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Users, FileText, Mail, ScanSearch, MessagesSquare, IdCard, Settings, GraduationCap, Briefcase, ClipboardList, ListChecks, Armchair, ShieldCheck, Palette, BarChart3, KeyRound, Building2, Sparkles, Shield, History, Activity, Send, CalendarClock, BookOpen, Scale, Globe, CreditCard } from "lucide-react";
import { cn } from "@/lib/utils";

// Icon *components* aren't serializable across the Server -> Client
// boundary ("Only plain objects can be passed to Client Components from
// Server Components") — every caller below (admin-sidebar.tsx,
// dashboard-sidebar.tsx, institution-admin-sidebar.tsx) is a Server
// Component passing its nav config into this Client Component, so each
// item carries a plain string key instead of a Lucide component
// reference, resolved to a real icon here, inside the client boundary,
// where it's actually rendered.
const SIDEBAR_ICONS = {
  "layout-dashboard": LayoutDashboard,
  users: Users,
  "file-text": FileText,
  mail: Mail,
  "scan-search": ScanSearch,
  "messages-square": MessagesSquare,
  "id-card": IdCard,
  settings: Settings,
  "graduation-cap": GraduationCap,
  briefcase: Briefcase,
  "clipboard-list": ClipboardList,
  "list-checks": ListChecks,
  armchair: Armchair,
  "shield-check": ShieldCheck,
  palette: Palette,
  "bar-chart-3": BarChart3,
  "key-round": KeyRound,
  building: Building2,
  sparkles: Sparkles,
  shield: Shield,
  history: History,
  activity: Activity,
  send: Send,
  globe: Globe,
  "credit-card": CreditCard,
  "calendar-clock": CalendarClock,
  "book-open": BookOpen,
  scale: Scale,
} as const;

export type SidebarIconKey = keyof typeof SIDEBAR_ICONS;

export type SidebarNavItem = {
  href: string;
  label: string;
  icon: SidebarIconKey;
};

export function SidebarNav({
  items,
  title,
}: {
  items: SidebarNavItem[];
  title?: string;
}) {
  const pathname = usePathname();

  return (
    <div className="flex flex-col gap-1">
      {title && (
        <div className="mb-1 px-3 text-xs font-medium tracking-wide text-sidebar-foreground/50 uppercase">
          {title}
        </div>
      )}
      {items.map(({ href, label, icon }) => {
        const Icon = SIDEBAR_ICONS[icon];
        const active = pathname === href;
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "group/nav flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm transition-all duration-200",
              active
                ? "gradient-brand font-medium text-white shadow-[0_8px_20px_-8px_rgba(51,80,255,0.7)]"
                : "text-sidebar-foreground/75 hover:translate-x-0.5 hover:bg-white hover:text-sidebar-foreground hover:shadow-card",
            )}
          >
            {/* Tried a filled icon tile (gradient background) here — read as too heavy/dark. Just the glyph itself in
                brand blue now, no background, so nav rows still carry colour at rest without the visual weight of a
                filled tile on every row. Active rows keep a plain white icon (inherits the row's own white text
                colour), same as before. */}
            <Icon className={cn("h-4 w-4 shrink-0 transition-transform duration-200 group-hover/nav:scale-110", !active && "text-primary")} />
            {label}
          </Link>
        );
      })}
    </div>
  );
}
