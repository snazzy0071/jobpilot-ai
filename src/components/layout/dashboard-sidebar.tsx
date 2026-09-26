import { SidebarNav, type SidebarNavItem } from "@/components/layout/sidebar-nav";
import { SidebarShell } from "@/components/layout/sidebar-shell";
import { PlanUpgradeCard } from "@/components/layout/plan-upgrade-card";
import { SignOutButton } from "@/components/layout/sign-out-button";
import { ViewPublicSiteLink } from "@/components/layout/view-public-site-link";

const MAIN_NAV_ITEMS: SidebarNavItem[] = [
  { href: "/dashboard", label: "Overview", icon: "layout-dashboard" },
  { href: "/dashboard/cvs", label: "My CVs", icon: "file-text" },
  { href: "/dashboard/cover-letters", label: "Cover Letters", icon: "mail" },
  { href: "/dashboard/ats-scanner", label: "ATS Scanner", icon: "scan-search" },
  { href: "/dashboard/interview", label: "Interview Coach", icon: "messages-square" },
  { href: "/dashboard/linkedin", label: "LinkedIn Optimiser", icon: "id-card" },
  { href: "/dashboard/jobs", label: "Job Feed", icon: "briefcase" },
  { href: "/dashboard/applications", label: "Applications", icon: "clipboard-list" },
  { href: "/dashboard/auto-apply", label: "Auto-Apply", icon: "send" },
  { href: "/dashboard/test-prep", label: "Test Prep", icon: "list-checks" },
];

const FOOTER_NAV_ITEMS: SidebarNavItem[] = [
  { href: "/dashboard/settings", label: "Settings", icon: "settings" },
];

export const DASHBOARD_NAV_ITEMS = [...MAIN_NAV_ITEMS, ...FOOTER_NAV_ITEMS];

export function DashboardSidebar({ plan }: { plan: string }) {
  return (
    <SidebarShell
      footer={
        <>
          <div className="px-3">
            <p className="text-xs font-semibold tracking-wide text-primary uppercase">{plan}</p>
            <p className="text-xs text-sidebar-foreground/50">{plan === "free" ? "Free plan" : "Current plan"}</p>
          </div>
          {plan === "free" && <PlanUpgradeCard />}
          <SidebarNav items={FOOTER_NAV_ITEMS} />
          <SignOutButton />
        </>
      }
    >
      <ViewPublicSiteLink />
      <SidebarNav items={MAIN_NAV_ITEMS} title="Workspace" />
    </SidebarShell>
  );
}
