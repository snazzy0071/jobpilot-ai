-- pgTAP test suite proving migration 0051_profiles_role_immutable.sql
-- actually does what it claims. Targets a real Supabase Postgres
-- instance (the `auth` schema, its roles, and auth.uid()/auth.role()
-- are Supabase-provided, not something a vanilla Postgres has) — run it
-- with either:
--   supabase start && supabase test db
-- or, against any Postgres that already has the pgtap extension and a
-- full Supabase auth schema/roles (anon/authenticated/service_role)
-- available:
--   psql "$DATABASE_URL" -f supabase/tests/profiles_privilege_escalation.sql
--
-- NOTE: this file has not been executed in the environment it was
-- written in — no Docker/Supabase CLI/local Postgres was available
-- there (see docs/BUILD_CHECKLIST.md's own note on this migration for
-- the full explanation). It's written to the same standard, well-
-- documented pattern real Supabase pgTAP suites use (simulating a
-- PostgREST request via `request.jwt.claims` + `set local role`), and
-- every column/enum value/function it references was checked against
-- the real migration files, not guessed — but it should be run for
-- real before being trusted blind.

begin;

create extension if not exists pgtap with schema extensions;

select plan(10);

-- ---------------------------------------------------------------------
-- Fixtures: two real users, created the same way a real signup would
-- (an auth.users insert, firing the real handle_new_user() trigger to
-- create the matching profiles row) — not a hand-built profiles row,
-- so this exercises the actual trigger chain, not a shortcut around it.
-- ---------------------------------------------------------------------

insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at)
values
  ('00000000-0000-0000-0000-000000000000', '11111111-1111-1111-1111-111111111111', 'authenticated', 'authenticated', 'normal-user@test.local', 'not-a-real-password', now(), now(), now()),
  ('00000000-0000-0000-0000-000000000000', '22222222-2222-2222-2222-222222222222', 'authenticated', 'authenticated', 'existing-admin@test.local', 'not-a-real-password', now(), now(), now());

-- existing-admin starts out admin via the one sanctioned path this
-- migration must not break: a privileged (non-anon/authenticated) role
-- writing profiles.role directly — exactly what scripts/promote-admin.mjs
-- and docs/ADMIN_PROMOTION.md's SQL-editor process both do.
update public.profiles set role = 'admin' where id = '22222222-2222-2222-2222-222222222222';

-- =======================================================================
-- 1) A normal user CAN update their own legitimate profile fields
-- =======================================================================

select set_config('request.jwt.claims', json_build_object('sub', '11111111-1111-1111-1111-111111111111', 'role', 'authenticated')::text, true);
set local role authenticated;

update public.profiles set full_name = 'Real Name' where id = '11111111-1111-1111-1111-111111111111';
select is(
  (select full_name from public.profiles where id = '11111111-1111-1111-1111-111111111111'),
  'Real Name',
  'a normal user can update their own full_name'
);

update public.profiles set onboarding_status = 'in_progress' where id = '11111111-1111-1111-1111-111111111111';
select is(
  (select onboarding_status::text from public.profiles where id = '11111111-1111-1111-1111-111111111111'),
  'in_progress',
  'a normal user can update their own onboarding_status'
);

-- =======================================================================
-- 2) A normal user CANNOT change their own role (or plan)
-- =======================================================================

select throws_ok(
  $$update public.profiles set role = 'admin' where id = '11111111-1111-1111-1111-111111111111'$$,
  '42501',
  'Changing role is not permitted.',
  'a normal user cannot change role from user to admin'
);

select is(
  (select role::text from public.profiles where id = '11111111-1111-1111-1111-111111111111'),
  'user',
  'role remains ''user'' after the rejected escalation attempt'
);

-- The realistic attack shape: a role change smuggled into an otherwise
-- legitimate-looking update. The whole statement must be rejected —
-- nothing partially applies.
select throws_ok(
  $$update public.profiles set full_name = 'Sneaky', role = 'admin' where id = '11111111-1111-1111-1111-111111111111'$$,
  '42501',
  'Changing role is not permitted.',
  'a role change bundled with a legitimate field change is rejected too'
);

select isnt(
  (select full_name from public.profiles where id = '11111111-1111-1111-1111-111111111111'),
  'Sneaky',
  'the bundled full_name change did not silently apply either'
);

select throws_ok(
  $$update public.profiles set plan = 'paid' where id = '11111111-1111-1111-1111-111111111111'$$,
  '42501',
  'Changing plan is not permitted.',
  'a normal user cannot change their own plan'
);

-- =======================================================================
-- 3) Existing admin authorization still works
-- =======================================================================

-- 3a) An already-admin user keeps their role through an ordinary
-- self-update — this migration must not reset or otherwise disturb an
-- existing admin's privilege as a side effect.
select set_config('request.jwt.claims', json_build_object('sub', '22222222-2222-2222-2222-222222222222', 'role', 'authenticated')::text, true);
set local role authenticated;

update public.profiles set full_name = 'Admin Person' where id = '22222222-2222-2222-2222-222222222222';
select is(
  (select role::text from public.profiles where id = '22222222-2222-2222-2222-222222222222'),
  'admin',
  'an existing admin keeps their role after updating an unrelated field'
);

-- 3b) service_role — the sanctioned path scripts/promote-admin.mjs and
-- every other trusted server-side write in this app already uses — can
-- still promote a user.
reset role;
select set_config('request.jwt.claims', json_build_object('sub', '11111111-1111-1111-1111-111111111111', 'role', 'service_role')::text, true);
set local role service_role;

update public.profiles set role = 'admin' where id = '11111111-1111-1111-1111-111111111111';
select is(
  (select role::text from public.profiles where id = '11111111-1111-1111-1111-111111111111'),
  'admin',
  'a service-role write can still change role'
);

-- 3c) a direct superuser/SQL-editor update (docs/ADMIN_PROMOTION.md's
-- documented alternative to the script) can still change role too.
reset role;
update public.profiles set role = 'user' where id = '11111111-1111-1111-1111-111111111111';
select is(
  (select role::text from public.profiles where id = '11111111-1111-1111-1111-111111111111'),
  'user',
  'a direct superuser/SQL-editor update can still change role'
);

select * from finish();
rollback;
