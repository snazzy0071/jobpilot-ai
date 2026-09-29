import { SidebarNav, type SidebarNavItem } from "@/components/layout/sidebar-nav";
import { SidebarShell } from "@/components/layout/sidebar-shell";
import type { AdminPermission } from "@/lib/admin/permission-types";

type AdminNavItem = SidebarNavItem & { permission?: AdminPermission };

// The full, unfiltered admin nav — kept here (not in the page-level
// route guards) purely as a single source of truth for "what nav item
// goes with what permission", so CurrentPageTitle (which needs every
// item's label for the header, regardless of what the current admin
// can see) and the actual filtered sidebar below both read from the
// same list. `permission: undefined` means visible to any admin — the
// overview has nothing specific to gate.
export const ADMIN_NAV_ITEMS: AdminNavItem[] = [
  { href: "/admin", label: "Dashboard", icon: "layout-dashboard" },
  { href: "/admin/users", label: "Users", icon: "users", permission: "manage_users" },
  { href: "/admin/institutions", label: "Institutions", icon: "building", permission: "manage_institutions" },
  { href: "/admin/plans", label: "Plans/Subscriptions", icon: "credit-card", permission: "view_plans" },
  { href: "/admin/access-codes", label: "Access Codes", icon: "key-round", permission: "manage_access_codes" },
  { href: "/admin/ai-usage", label: "AI Usage", icon: "sparkles", permission: "view_ai_usage" },
  { href: "/admin/sponsors", label: "Sponsors", icon: "shield", permission: "view_sponsor_sync" },
  { href: "/admin/graduate-schemes", label: "Graduate Schemes", icon: "graduation-cap", permission: "manage_graduate_schemes" },
  { href: "/admin/deadlines", label: "Deadlines", icon: "calendar-clock", permission: "manage_graduate_schemes" },
  { href: "/admin/jobs", label: "Jobs", icon: "briefcase", permission: "view_job_sync" },
  { href: "/admin/test-prep", label: "Test Prep", icon: "list-checks", permission: "manage_test_prep" },
  { href: "/admin/advice-hub", label: "Advice Hub", icon: "book-open", permission: "manage_advice_hub" },
  { href: "/admin/blog", label: "Blog", icon: "file-text", permission: "manage_blog" },
  { href: "/admin/compare", label: "Comparisons", icon: "scale", permission: "manage_comparisons" },
  { href: "/admin/auto-apply", label: "Auto-Apply", icon: "send", permission: "view_auto_apply" },
  { href: "/admin/leads", label: "Leads", icon: "mail", permission: "view_leads" },
  { href: "/admin/roles", label: "Roles", icon: "shield-check", permission: "manage_admin_roles" },
  { href: "/admin/settings", label: "Settings", icon: "settings", permission: "manage_settings" },
  { href: "/admin/system-health", label: "System Health", icon: "activity", permission: "view_system_health" },
];

/** Reachable pages (linked from System Health) that are deliberately not in the menu; they only supply the header title. */
export const ADMIN_UNLISTED_PAGES: SidebarNavItem[] = [{ href: "/admin/email-logs", label: "Email Logs", icon: "send" }];

/**
 * Renders only the nav items this specific admin actually has
 * permission for — the underlying pages are already guarded (each
 * section's own layout.tsx calls requirePermission()), so this isn't the
 * security boundary, but a nav item nobody can act on is a worse UI than
 * a shorter, honest list.
 *
 * The sidebar is admin-only: just this account's management pages. The
 * public-site link and sign out both still live in the header
 * (ViewPublicSiteLink, UserMenu) rather than duplicated here. The
 * user-workspace routes (/dashboard/*) still exist and keep their own
 * guards; they just aren't linked from here.
 */
export function AdminSidebar({ permissions }: { permissions: Set<AdminPermission> }) {
  const visibleItems = ADMIN_NAV_ITEMS.filter((item) => !item.permission || permissions.has(item.permission));

  return (
    <SidebarShell>
      <SidebarNav items={visibleItems} title="Administration" />
    </SidebarShell>
  );
}
