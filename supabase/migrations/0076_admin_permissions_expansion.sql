-- Two new fixed permission keys for the admin management surfaces this
-- task adds (src/lib/admin/permission-types.ts's own ADMIN_PERMISSIONS
-- is the code-side source of truth; this migration only updates the
-- *data* — which roles grant them): `manage_access_codes` (access-code
-- CRUD, /admin/access-codes) and `manage_institutions` (global
-- institution provisioning — creating a new institution, its first
-- licence, and its first admin — /admin/institutions; distinct from
-- src/lib/institutions/admin/* which is an institution admin's own
-- self-service area for their one tenant).
--
-- Appended onto the existing `super_admin` role (seeded in migration
-- 0075) so every account that already holds it gains access to these
-- new sections automatically, same "don't lock out existing admins
-- when shipping a new permission-gated page" reasoning that seed
-- itself already documents. jsonb `||` concatenation, not a full
-- replace, so this can't accidentally drop whatever `super_admin`'s
-- permissions already were by the time this runs.
update public.admin_roles
set permissions = permissions || '["manage_access_codes", "manage_institutions"]'::jsonb
where slug = 'super_admin';
