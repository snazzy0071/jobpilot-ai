-- The automated, re-runnable form of this task's own manual audit: every
-- table in the schema, checked for RLS, on every run — not a one-time
-- finding that goes stale the moment a new migration adds a table.
-- Queries `pg_class`/`pg_policies` directly (stable Postgres system
-- catalogs, not a pgTAP-specific API), so this doesn't depend on any
-- particular pgTAP function existing.

begin;

create extension if not exists pgtap with schema extensions;

select plan(3);

-- 1) No table in the public schema is missing RLS entirely. This is the
-- single most important assertion in this whole suite: a new migration
-- that adds `create table public.whatever (...)` without the matching
-- `alter table ... enable row level security` fails this the moment it
-- lands, instead of silently shipping an unprotected table.
select is(
  (
    select count(*)::int
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relkind = 'r'
      and not c.relrowsecurity
  ),
  0,
  'every table in the public schema has RLS enabled'
);

-- 2) The sweep above isn't vacuously true because the query found no
-- tables at all (a bug in the query, or a misconfigured/empty
-- database) — confirms a real, non-trivial schema is actually being
-- checked. 80 real tables existed at the time this suite was written
-- (see the audit behind this task); 50 is a conservative floor that
-- still catches "the query silently matched nothing."
select ok(
  (
    select count(*)
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind = 'r'
  ) > 50,
  'the RLS sweep is checking a real, non-trivial number of tables'
);

-- 3) Every RLS-enabled table has at least one real policy, *except* the
-- small, explicitly documented set that is genuinely service-role-only
-- by design (access_codes, ai_rate_limit_windows, anonymous_rate_limits,
-- quick_scan_results — every write/read goes through a security-definer
-- function or the service-role client; see each one's own migration
-- comment). Catches the "RLS enabled but nobody ever added a policy, so
-- every request from every role is silently denied" availability bug —
-- different from finding #1, but still a real mistake worth catching
-- automatically. Adding a fifth deliberate service-role-only table means
-- adding it to this allowlist in the same change, not silently.
select is(
  (
    select count(*)::int
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relkind = 'r'
      and c.relrowsecurity
      and c.relname not in ('access_codes', 'ai_rate_limit_windows', 'anonymous_rate_limits', 'quick_scan_results')
      and not exists (
        select 1 from pg_policies p where p.schemaname = 'public' and p.tablename = c.relname
      )
  ),
  0,
  'every RLS-enabled table has at least one policy, except the documented service-role-only allowlist'
);

select * from finish();
rollback;
