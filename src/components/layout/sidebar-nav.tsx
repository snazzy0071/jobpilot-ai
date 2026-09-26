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
              "flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors",
              active
                ? "bg-primary font-medium text-primary-foreground shadow-card"
                : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground",
            )}
          >
            <Icon className="h-4 w-4" />
            {label}
          </Link>
        );
      })}
    </div>
  );
}
