-- One more fixed permission key (src/lib/admin/permission-types.ts is
-- the code-side source of truth) for /admin/system-health — the
-- internal, full-detail view of src/lib/health/checks.ts's six checks
-- (database, AI, Stripe, email, sponsor sync, job sync). Distinct from
-- the public /status page, which reads the exact same check functions
-- but only ever renders their coarse `status`, never the `detail` text
-- this permission gates. Appended onto `super_admin`, same pattern
-- every prior permission expansion in this app follows.
update public.admin_roles
set permissions = permissions || '["view_system_health"]'::jsonb
where slug = 'super_admin';
