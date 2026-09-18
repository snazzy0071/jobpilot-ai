-- One more fixed permission key for the new AI usage dashboard
-- (src/lib/admin/permission-types.ts's own ADMIN_PERMISSIONS is the
-- code-side source of truth) — `view_ai_usage`, deliberately named
-- "view" rather than "manage": this dashboard is read-only, nothing
-- under it writes to ai_usage_logs or anything else. Appended onto the
-- seeded `super_admin` role, same "don't lock out existing admins when
-- shipping a new permission-gated page" reasoning migrations 0075/0076
-- already establish.
update public.admin_roles
set permissions = permissions || '["view_ai_usage"]'::jsonb
where slug = 'super_admin';
