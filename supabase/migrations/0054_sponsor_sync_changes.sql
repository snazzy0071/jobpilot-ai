-- Per-sponsor change log for the sync job, plus a "last successful run"
-- convenience view — both purely additive, neither touches how
-- sponsors/sponsor_routes/sponsor_aliases/sponsor_imports already work.
--
-- Why a separate log table rather than just the aggregate counts
-- sponsor_imports already had (sponsor_count/route_count/alias_count,
-- migrations 0049/0053): those say *how many* changed, never *which*
-- ones or *how* — no way to answer "which sponsors dropped off the
-- register this week" without one. sponsor_sync_changes answers that,
-- one row per sponsor whose *existence state* changed in a given
-- import — newly seen, reactivated after having dropped off, or
-- deactivated because this import didn't see it. Deliberately scoped to
-- that (not e.g. "this sponsor's rating changed") — a full field-level
-- diff is real, separate follow-up work, not needed for "which sponsors
-- came or went".
--
-- Append-only and never deleted by anything this schema defines —
-- "never delete historical import evidence blindly" applies to this
-- exactly as much as to sponsor_imports itself. `sponsor_id` is left at
-- Postgres's default `on delete restrict` (not cascade, unlike
-- `sponsors.import_id -> sponsor_imports`) deliberately: a sponsor row
-- can never be hard-deleted while it still has change history
-- referencing it — nothing in this importer ever deletes a `sponsors`
-- row today (only upserts/deactivates), so this is a safety net against
-- a *future* change quietly discarding history via cascade, not a
-- workaround for something that currently happens.
--
-- `company_name` is a snapshot, not a live join back to `sponsors` —
-- that row's own name can be overwritten by a later import ("last row
-- wins", scripts/import-sponsors.mjs), but a change-log entry describes
-- what happened *at that import*, so it must keep saying what the name
-- was then, not whatever it is now.

create type public.sponsor_change_type as enum ('added', 'reactivated', 'deactivated');

create table public.sponsor_sync_changes (
  id uuid primary key default gen_random_uuid(),
  import_id uuid not null references public.sponsor_imports (id) on delete cascade,
  sponsor_id uuid not null references public.sponsors (id),
  change_type public.sponsor_change_type not null,
  company_name text not null check (char_length(company_name) between 1 and 300),
  created_at timestamptz not null default now()
);

alter table public.sponsor_sync_changes enable row level security;

-- Public read, same as sponsor_imports itself — this is a log of public
-- register facts ("company X was added/removed on date Y"), not
-- sensitive data. No insert/update/delete policy: only the importer's
-- service-role client ever writes here.
create policy "Anyone can view sponsor sync changes"
  on public.sponsor_sync_changes for select
  using (true);

create index sponsor_sync_changes_import_id_idx on public.sponsor_sync_changes (import_id);
create index sponsor_sync_changes_sponsor_id_idx on public.sponsor_sync_changes (sponsor_id);
create index sponsor_sync_changes_change_type_idx on public.sponsor_sync_changes (change_type);

-- Rounds out sponsor_imports' result counts with the same three numbers
-- sponsor_sync_changes now tracks in detail — a cheap, indexed-free way
-- to read "how many changed" without counting change rows, matching the
-- existing sponsor_count/route_count/alias_count columns' own shape.
alter table public.sponsor_imports
  add column added_count integer check (added_count is null or added_count >= 0),
  add column reactivated_count integer check (reactivated_count is null or reactivated_count >= 0),
  add column deactivated_count integer check (deactivated_count is null or deactivated_count >= 0);

-- "Last-success metadata" as one ready row instead of a query every
-- caller would otherwise have to reconstruct by hand (status =
-- 'completed', order by completed_at desc, limit 1). A plain view, not
-- a table — nothing to keep in sync, it's always exactly what
-- sponsor_imports itself says. No RLS of its own: Postgres views run
-- with the querying user's own permissions against the underlying
-- table by default (security_invoker), so this transparently inherits
-- sponsor_imports' existing public-read policy rather than needing one
-- restated.
create view public.sponsor_sync_status as
select
  id as import_id,
  source_date,
  sponsor_count,
  route_count,
  alias_count,
  added_count,
  reactivated_count,
  deactivated_count,
  completed_at,
  now() - completed_at as time_since_last_success
from public.sponsor_imports
where status = 'completed'
order by completed_at desc
limit 1;
