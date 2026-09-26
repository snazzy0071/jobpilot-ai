// Plain constants/types only — no "server-only" import — since these
// are needed by client components too (src/components/admin/roles/
// role-form.tsx renders a checkbox per permission key). The actual
// permission-checking logic (src/lib/admin/permissions.ts) is
// server-only and imports from here, not the other way round.

export const ADMIN_PERMISSIONS = [
  "manage_users",
  "manage_graduate_schemes",
  "manage_test_prep",
  "manage_admin_roles",
  "manage_access_codes",
  "manage_institutions",
  "view_ai_usage",
  "view_sponsor_sync",
  "manage_sponsor_sync",
  "view_job_sync",
  "manage_blog",
  "manage_advice_hub",
  "manage_comparisons",
  "view_plans",
  "view_auto_apply",
  "view_leads",
  "manage_settings",
  "view_audit_logs",
  "view_system_health",
  "view_email_logs",
] as const;
export type AdminPermission = (typeof ADMIN_PERMISSIONS)[number];

export const ADMIN_PERMISSION_LABELS: Record<AdminPermission, string> = {
  manage_users: "Manage users",
  manage_graduate_schemes: "Manage graduate schemes",
  manage_test_prep: "Manage test prep content",
  manage_admin_roles: "Manage admin roles",
  manage_access_codes: "Manage access codes",
  manage_institutions: "Manage institutions",
  view_ai_usage: "View AI usage",
  view_sponsor_sync: "View sponsor sync",
  manage_sponsor_sync: "Run sponsor sync",
  view_job_sync: "View job sync",
  manage_blog: "Manage blog",
  manage_advice_hub: "Manage advice hub",
  manage_comparisons: "Manage comparison pages",
  view_plans: "View plans and subscriptions",
  view_auto_apply: "View Auto-Apply activity",
  view_leads: "View leads",
  manage_settings: "Manage global settings",
  view_audit_logs: "View audit logs",
  view_system_health: "View system health",
  view_email_logs: "View email logs",
};
