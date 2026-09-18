-- Rounds out the jobs schema (0059) with what real scheduled ingestion
-- needs: an audit log per run (`job_imports`, same "never delete
-- historical import evidence blindly" spirit as `sponsor_imports`),
-- cross-source deduplication (`jobs.duplicate_of_job_id`), and a
-- freshness signal that doesn't depend on a source's feed giving an
-- expiry date (`jobs.last_seen_at`).
--
-- Deliberately NOT the sponsor register's "did this run see it or not"
-- deactivation logic: that only works because a sponsor sync downloads
-- the *entire* register every run. An Adzuna/Reed sync only pulls a
-- bounded page window per invocation (src/lib/jobs/adapters/*/sync.ts's
-- own maxPages cap, kept small so a run fits one serverless
-- invocation) — a job's external_id being absent from *today's* fetched
-- batch says nothing about whether it's still live, only that it wasn't
-- on the page(s) this run happened to request. `last_seen_at` (bumped
-- every time a sync's batch actually includes a job, regardless of
-- whether that's a create or an update) is the honest substitute: "we
-- last confirmed this job still exists on [date]" is a real fact this
-- schema can support; "this run didn't return it, so it must be gone"
-- isn't, given how it's fetched.

-- ---------------------------------------------------------------------
-- job_imports — one row per ingestion or maintenance run
-- ---------------------------------------------------------------------

create type public.job_import_status as enum ('pending', 'processing', 'completed', 'failed');
create type public.job_import_run_type as enum ('sync', 'maintenance');

create table public.job_imports (
  id uuid primary key default gen_random_uuid(),

  -- A 'sync' run always belongs to exactly one source; a 'maintenance'
  -- run (expiry sweep, pruning — src/lib/jobs/maintenance.ts) is
  -- cross-source by definition, since it operates over every job
  -- regardless of where it came from.
  run_type public.job_import_run_type not null default 'sync',
  source_id uuid references public.job_sources (id),

  status public.job_import_status not null default 'pending',

  -- Null until the run actually finishes — real result counts, not a
  -- guess made up front, same as sponsor_imports. Not every count
  -- applies to every run_type (a 'maintenance' run never creates/
  -- updates/finds duplicates; a 'sync' run never prunes) — left
  -- nullable rather than forced to 0, so "never applicable to this run"
  -- stays distinguishable from "ran and found zero".
  fetched_count integer check (fetched_count is null or fetched_count >= 0),
  created_count integer check (created_count is null or created_count >= 0),
  updated_count integer check (updated_count is null or updated_count >= 0),
  duplicate_count integer check (duplicate_count is null or duplicate_count >= 0),
  deactivated_count integer check (deactivated_count is null or deactivated_count >= 0),
  pruned_count integer check (pruned_count is null or pruned_count >= 0),

  error_message text check (char_length(error_message) <= 2000),

  started_at timestamptz not null default now(),
  completed_at timestamptz,
  created_at timestamptz not null default now(),

  check (status not in ('completed', 'failed') or completed_at is not null),
  check ((run_type = 'sync' and source_id is not null) or (run_type = 'maintenance' and source_id is null))
);

alter table public.job_imports enable row level security;

-- Public read, same reasoning as sponsor_imports: an ingestion log is
-- operational transparency ("when did this last sync, did it
-- succeed"), not sensitive data. No insert/update/delete policy — only
-- the service-role sync/maintenance code writes here.
create policy "Anyone can view job imports"
  on public.job_imports for select
  using (true);

create index job_imports_source_id_idx on public.job_imports (source_id);
create index job_imports_run_type_status_idx on public.job_imports (run_type, status, started_at desc);

-- ---------------------------------------------------------------------
-- jobs — dedup + last-seen columns
-- ---------------------------------------------------------------------

alter table public.jobs
  add column last_seen_at timestamptz not null default now(),
  -- Points at the canonical row for a job this schema believes is the
  -- same real-world listing seen from more than one source (or,
  -- eventually, the same source under a new external_id). Never
  -- cascaded away by deleting the canonical row's history — `on delete
  -- set null` demotes a duplicate back to "not currently linked" rather
  -- than losing the row, matching this migration's own append-only
  -- spirit for job_imports. A duplicate is real DB-level uncertainty,
  -- not a hard uniqueness invariant (two different real openings can
  -- legitimately share a title/company/location), so this is a nullable
  -- link decided by application logic (src/lib/jobs/dedupe.ts), not a
  -- unique constraint.
  add column duplicate_of_job_id uuid references public.jobs (id) on delete set null;

create index jobs_last_seen_at_idx on public.jobs (last_seen_at);
create index jobs_duplicate_of_job_id_idx on public.jobs (duplicate_of_job_id);

-- Supports the dedup check every new (source_id, external_id) job runs
-- before insert: "is there already a visible, non-duplicate job with
-- this same title/company/location, from any source?"
create index jobs_dedup_lookup_idx
  on public.jobs (company_name_normalized, title_normalized, location_normalized)
  where (is_active and duplicate_of_job_id is null);

-- Replaces migration 0059's public select policy with the same
-- condition plus "and it isn't a known duplicate" — a duplicate row
-- still exists (for provenance/audit — see duplicate_of_job_id's own
-- comment above) but was never meant to show up as a second listing
-- next to its canonical row.
drop policy "Anyone can view active, unexpired jobs" on public.jobs;

create policy "Anyone can view active, unexpired, non-duplicate jobs"
  on public.jobs for select
  using (is_active and (expires_at is null or expires_at > now()) and duplicate_of_job_id is null);

-- ---------------------------------------------------------------------
-- job_source_sync_status — one row per source, its last successful sync
-- ---------------------------------------------------------------------

-- Same "ready row instead of a query every caller reconstructs by hand"
-- reasoning as sponsor_sync_status — but one row *per source* here
-- (distinct on source_id), not a single global row, since unlike the
-- sponsor register there's more than one job source. No RLS of its
-- own: a plain view runs with the querying user's own permissions
-- against job_imports by default (security_invoker), so it inherits
-- that table's existing public-read policy.
create view public.job_source_sync_status as
select distinct on (source_id)
  source_id,
  id as import_id,
  fetched_count,
  created_count,
  updated_count,
  duplicate_count,
  completed_at,
  now() - completed_at as time_since_last_success
from public.job_imports
where run_type = 'sync' and status = 'completed' and source_id is not null
order by source_id, completed_at desc;
