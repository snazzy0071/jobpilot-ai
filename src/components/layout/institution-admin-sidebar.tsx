import { SidebarNav, type SidebarNavItem } from "@/components/layout/sidebar-nav";
import { SidebarShell } from "@/components/layout/sidebar-shell";
import { SignOutButton } from "@/components/layout/sign-out-button";
import { ViewPublicSiteLink } from "@/components/layout/view-public-site-link";

export const INSTITUTION_ADMIN_NAV_ITEMS: SidebarNavItem[] = [
  { href: "/institution-admin", label: "Overview", icon: "layout-dashboard" },
  { href: "/institution-admin/members", label: "Students & members", icon: "users" },
  { href: "/institution-admin/seats", label: "Seats", icon: "armchair" },
  { href: "/institution-admin/invites", label: "Invites", icon: "mail" },
  { href: "/institution-admin/domains", label: "Email domains", icon: "globe" },
  { href: "/institution-admin/licence", label: "Licence", icon: "shield-check" },
  { href: "/institution-admin/branding", label: "Branding", icon: "palette" },
  { href: "/institution-admin/analytics", label: "Analytics", icon: "bar-chart-3" },
];

export function InstitutionAdminSidebar() {
  return (
    <SidebarShell footer={<SignOutButton />}>
      <ViewPublicSiteLink />
      <SidebarNav items={INSTITUTION_ADMIN_NAV_ITEMS} title="Institution" />
    </SidebarShell>
  );
}
