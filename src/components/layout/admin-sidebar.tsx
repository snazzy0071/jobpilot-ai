import { SidebarNav, type SidebarNavItem } from "@/components/layout/sidebar-nav";
import { SidebarShell } from "@/components/layout/sidebar-shell";
import { SignOutButton } from "@/components/layout/sign-out-button";
import { ViewPublicSiteLink } from "@/components/layout/view-public-site-link";
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
  { href: "/admin", label: "Overview", icon: "layout-dashboard" },
  { href: "/admin/users", label: "Users", icon: "users", permission: "manage_users" },
  { href: "/admin/graduate-schemes", label: "Graduate Schemes", icon: "graduation-cap", permission: "manage_graduate_schemes" },
  { href: "/admin/test-prep", label: "Test Prep", icon: "list-checks", permission: "manage_test_prep" },
  { href: "/admin/ai-usage", label: "AI Usage", icon: "sparkles", permission: "view_ai_usage" },
  { href: "/admin/access-codes", label: "Access Codes", icon: "key-round", permission: "manage_access_codes" },
  { href: "/admin/institutions", label: "Institutions", icon: "building", permission: "manage_institutions" },
  { href: "/admin/sponsors", label: "Sponsor Sync", icon: "shield", permission: "view_sponsor_sync" },
  { href: "/admin/jobs", label: "Job Feed", icon: "briefcase", permission: "view_job_sync" },
  { href: "/admin/blog", label: "Blog", icon: "file-text", permission: "manage_blog" },
  { href: "/admin/leads", label: "Leads", icon: "mail", permission: "view_leads" },
  { href: "/admin/settings", label: "Settings", icon: "settings", permission: "manage_settings" },
  { href: "/admin/roles", label: "Admin Roles", icon: "shield-check", permission: "manage_admin_roles" },
  { href: "/admin/audit-log", label: "Audit Log", icon: "history", permission: "view_audit_logs" },
  { href: "/admin/system-health", label: "System Health", icon: "activity", permission: "view_system_health" },
  { href: "/admin/email-logs", label: "Email Logs", icon: "send", permission: "view_email_logs" },
];

// The same real, in-app tools dashboard-sidebar.tsx links a signed-in
// user to — repeated here rather than imported from there, since an
// admin's reason for wanting this list (support/QA access to the real
// product) is different from a user's own workspace nav, and the two
// shouldn't have to stay in lockstep if one changes later. These are
// the exact same routes, gated by the exact same guards
// (requireOnboardedUser()/requireUser() on each dashboard-area
// layout/page) as any other visit — an admin account gets no
// permission shortcut into them, it's just a convenience link to a
// page it could already reach by typing the URL.
const USER_WORKSPACE_ITEMS: SidebarNavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: "layout-dashboard" },
  { href: "/dashboard/cvs", label: "CV Builder", icon: "file-text" },
  { href: "/dashboard/ats-scanner", label: "ATS Scanner", icon: "scan-search" },
  { href: "/dashboard/cover-letters", label: "Cover Letters", icon: "mail" },
  { href: "/dashboard/interview", label: "Interview Coach", icon: "messages-square" },
  { href: "/dashboard/linkedin", label: "LinkedIn Optimiser", icon: "id-card" },
  { href: "/dashboard/jobs", label: "Job Search/Match", icon: "briefcase" },
  { href: "/dashboard/applications", label: "Job Tracker", icon: "clipboard-list" },
  { href: "/dashboard/test-prep", label: "Test Prep", icon: "list-checks" },
  { href: "/dashboard/settings", label: "Settings", icon: "settings" },
];

/**
 * Renders only the nav items this specific admin actually has
 * permission for — the "roles should be configurable, not hardcoded
 * throughout UI" half of this: the underlying pages are already
 * guarded (each section's own layout.tsx calls requirePermission()),
 * so this isn't the security boundary, but a nav item nobody can act
 * on is a worse UI than a shorter, honest list.
 *
 * Three sections, top to bottom: a plain link back to the public
 * marketing site (an admin still needs to see what a logged-out
 * visitor sees), the same user-facing tools every dashboard account
 * gets (User Workspace), then this account's own admin-only management
 * pages (Admin Dashboard) — kept visually and structurally separate
 * from User Workspace so it's never ambiguous which items are
 * admin-only versus ordinary product features.
 */
export function AdminSidebar({ permissions }: { permissions: Set<AdminPermission> }) {
  const visibleItems = ADMIN_NAV_ITEMS.filter((item) => !item.permission || permissions.has(item.permission));

  return (
    <SidebarShell footer={<SignOutButton />}>
      <ViewPublicSiteLink />
      <SidebarNav items={USER_WORKSPACE_ITEMS} title="User Workspace" />
      <SidebarNav items={visibleItems} title="Admin Dashboard" />
    </SidebarShell>
  );
}
