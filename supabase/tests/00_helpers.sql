-- Shared pgTAP test helpers for RLS/tenant-isolation tests. NOT itself a
-- pgTAP test file (no plan()/finish()) — it creates real, persisted
-- objects that every numbered file after this one depends on. Filename
-- prefix (`00_`) is what makes it run first: `supabase test db` (via
-- pg_prove) runs every file in supabase/tests/ in lexical order against
-- the SAME database, so objects created here without a rollback are
-- still there for `10_`, `20_`, etc. Matches the "simulate a PostgREST
-- request via request.jwt.claims + set local role" idiom already
-- established in this repo's own supabase/tests/
-- profiles_privilege_escalation.sql, generalized into reusable
-- functions now that many more files need the same mechanism.
--
-- Run with either:
--   supabase start && supabase test db
-- or, against any Postgres with pgtap and a full Supabase auth schema/
-- roles (anon/authenticated/service_role) already available:
--   psql "$DATABASE_URL" -f supabase/tests/00_helpers.sql -f supabase/tests/10_cross_user_isolation.sql ...
--
-- NOTE: not executed in the environment this was written in — no
-- Docker/Supabase CLI/local Postgres was available there (same standing
-- blocker as every other task this session; see
-- supabase/tests/profiles_privilege_escalation.sql's own note for the
-- precedent). Every table/column/enum/policy/function referenced across
-- this whole suite was checked against the real migration files, not
-- guessed — but it should be run for real before being trusted blind.

begin;

create extension if not exists pgtap with schema extensions;

create schema if not exists tests;

-- ---------------------------------------------------------------------
-- Identity simulation
-- ---------------------------------------------------------------------

create or replace function tests.authenticate_as(p_user_id uuid)
returns void
language plpgsql
as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p_user_id, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
end;
$$;

create or replace function tests.authenticate_as_anon()
returns void
language plpgsql
as $$
begin
  perform set_config('request.jwt.claims', '', true);
  execute 'set local role anon';
end;
$$;

create or replace function tests.authenticate_as_service_role()
returns void
language plpgsql
as $$
begin
  perform set_config('request.jwt.claims', json_build_object('role', 'service_role')::text, true);
  execute 'set local role service_role';
end;
$$;

-- Back to the superuser/table-owner role fixtures are created under —
-- always call this between "act as user X" blocks and the next fixture
-- insert, same as the existing profiles_privilege_escalation.sql's own
-- `reset role;` calls.
create or replace function tests.clear_authentication()
returns void
language plpgsql
as $$
begin
  execute 'reset role';
  perform set_config('request.jwt.claims', '', true);
end;
$$;

-- ---------------------------------------------------------------------
-- Fixture helper: a minimal, real auth.users row (fires the real
-- handle_new_user() trigger, creating a matching profiles row) — not a
-- hand-built profiles row, so every test exercises the actual signup
-- trigger chain, same reasoning profiles_privilege_escalation.sql's own
-- fixture comment gives.
-- ---------------------------------------------------------------------

create or replace function tests.create_user(p_user_id uuid, p_email text)
returns void
language sql
as $$
  insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at)
  values ('00000000-0000-0000-0000-000000000000', p_user_id, 'authenticated', 'authenticated', p_email, 'not-a-real-password', now(), now(), now());
$$;

-- ---------------------------------------------------------------------
-- Generic assertions — dynamic SQL against a caller-given table, run
-- under whatever role/claims are currently set (via authenticate_as
-- above). `p_table` is `regclass`, not `text`: format()'s `%s` on a
-- regclass value always yields the correctly quoted, schema-qualified
-- identifier, so this can't be turned into SQL injection the way
-- interpolating a raw table-name string could.
-- ---------------------------------------------------------------------

create or replace function tests.assert_select_denied(p_table regclass, p_id_column text, p_id_value uuid, p_description text)
returns text
language plpgsql
as $$
declare
  v_count integer;
begin
  execute format('select count(*) from %s where %I = %L', p_table, p_id_column, p_id_value) into v_count;
  return ok(v_count = 0, p_description);
end;
$$;

create or replace function tests.assert_select_visible(p_table regclass, p_id_column text, p_id_value uuid, p_description text)
returns text
language plpgsql
as $$
declare
  v_count integer;
begin
  execute format('select count(*) from %s where %I = %L', p_table, p_id_column, p_id_value) into v_count;
  return ok(v_count = 1, p_description);
end;
$$;

create or replace function tests.assert_update_denied(p_table regclass, p_id_column text, p_id_value uuid, p_set_sql text, p_description text)
returns text
language plpgsql
as $$
declare
  v_row_count integer;
begin
  execute format('update %s set %s where %I = %L', p_table, p_set_sql, p_id_column, p_id_value);
  get diagnostics v_row_count = row_count;
  return ok(v_row_count = 0, p_description);
end;
$$;

create or replace function tests.assert_delete_denied(p_table regclass, p_id_column text, p_id_value uuid, p_description text)
returns text
language plpgsql
as $$
declare
  v_row_count integer;
begin
  execute format('delete from %s where %I = %L', p_table, p_id_column, p_id_value);
  get diagnostics v_row_count = row_count;
  return ok(v_row_count = 0, p_description);
end;
$$;

-- The positive-control counterpart: confirms a delete that's *supposed*
-- to be allowed (e.g. a member leaving their own institution) actually
-- removed the row, rather than just checking "it's invisible now" —
-- which a genuinely successful delete and an RLS-hidden-for-other-
-- reasons row would both satisfy, making that check meaningless on its
-- own.
create or replace function tests.assert_delete_allowed(p_table regclass, p_id_column text, p_id_value uuid, p_description text)
returns text
language plpgsql
as $$
declare
  v_row_count integer;
begin
  execute format('delete from %s where %I = %L', p_table, p_id_column, p_id_value);
  get diagnostics v_row_count = row_count;
  return ok(v_row_count = 1, p_description);
end;
$$;

commit;
