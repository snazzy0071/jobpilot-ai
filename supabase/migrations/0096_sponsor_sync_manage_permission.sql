-- A separate permission for *starting* a sponsor register sync from the admin area (view_sponsor_sync only lets an
-- admin look at it). Appended onto super_admin, the same pattern every earlier permission expansion follows.
-- src/lib/admin/permission-types.ts's ADMIN_PERMISSIONS is the code-side source of truth.
update public.admin_roles
set permissions = permissions || '["manage_sponsor_sync"]'::jsonb
where slug = 'super_admin'
  and not permissions @> '["manage_sponsor_sync"]'::jsonb;
