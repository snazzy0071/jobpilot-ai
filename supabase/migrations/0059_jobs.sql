-- Job listings schema (src/app/(public)/features/jobmatch,
-- src/app/(public)/features/tracker — both currently marketing-only
-- previews backed by illustrative data; docs/BUILD_CHECKLIST.md's
-- "Jobs (match engine)" and "Tracker" sections are both "Not started").
-- Same stage 0049_sponsors.sql and 0056_graduate_schemes.sql started
-- at: schema only, no ingestion pipeline or UI wiring yet.
--
-- Four tables:
--   job_sources — a small reference/dimension table for where a job
--     listing came from (a feed, a partner, admin/manual entry). Jobs
--     reference it by FK rather than storing a free-text source name,
--     so "which sources actually feed this table" stays a real,
--     queryable, finite set instead of drifting into inconsistent
--     strings the way an unconstrained text column would.
--   jobs — the listings themselves. Every display field that's also a
--     real matching/dedup key (title, company, location) gets a
--     `_normalized` twin, same split sponsors' company_name/
--     company_name_normalized already established: one column for what
--     a human reads, one for what a query matches against.
--   saved_jobs — a user's own bookmarks, one row per (user, job).
--     Full self-service CRUD via a single `for all` policy, same
--     pattern every CV table (migration 0024) uses for user-owned
--     content.
--   job_matches — one row per AI-scored CV-vs-job assessment
--     (src/lib/ai/prompts/job-match.ts's jobMatchPrompt/jobMatchSchema
--     — this table mirrors that schema's own field names and verdict
--     vocabulary exactly, not a reinvented one). Append-only, same
--     "a new scan is a new row, history is the table itself" reasoning
--     as ats_scans (migration 0031), so a CV or job changing after a
--     match was scored never rewrites what was actually shown at the
--     time.

-- ---------------------------------------------------------------------
-- job_sources
-- ---------------------------------------------------------------------

create table public.job_sources (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (char_length(slug) <= 60 and slug = lower(slug)),
  name text not null check (char_length(name) <= 200),
  base_url text check (base_url is null or (char_length(base_url) <= 500 and base_url ~* '^https?://')),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.job_sources enable row level security;

-- Public read, like sponsor_imports/blog_categories — attribution data
-- ("found via LinkedIn"), not sensitive, and useful to show even for a
-- source that's since gone inactive. No insert/update/delete policy:
-- only a service-role process or a future admin tool writes here,
-- same "curated, not user-submitted" reasoning graduate_schemes started
-- with before its own admin-write follow-up (migration 0058).
create policy "Anyone can view job sources"
  on public.job_sources for select
  using (true);

create trigger set_job_sources_updated_at
  before update on public.job_sources
  for each row execute procedure public.set_updated_at();

-- Seeded with the one source this schema can actually populate today
-- (admin/manual entry) — a real feed source (LinkedIn, Indeed, a
-- partner API) gets its own row exactly when a real integration for it
-- exists, not invented ahead of one.
insert into public.job_sources (slug, name, is_active) values ('manual', 'Manually added', true);

-- ---------------------------------------------------------------------
-- jobs
-- ---------------------------------------------------------------------

create table public.jobs (
  id uuid primary key default gen_random_uuid(),
  source_id uuid not null references public.job_sources (id),
  -- The source's own id/reference for this listing, so a re-import can
  -- upsert instead of duplicating — nullable for a manually-entered job
  -- that has no such reference; multiple nulls are fine under a plain
  -- unique constraint (Postgres never treats two nulls as equal).
  external_id text check (char_length(external_id) <= 300),

  title text not null check (char_length(title) between 1 and 300),
  title_normalized text not null check (char_length(title_normalized) between 1 and 300),
  company_name text not null check (char_length(company_name) between 1 and 300),
  company_name_normalized text not null check (char_length(company_name_normalized) between 1 and 300),
  -- Nullable: a genuinely remote-only listing may have no fixed
  -- location to give, same optionality sponsors.town_city allows.
  location text check (char_length(location) <= 200),
  location_normalized text check (location_normalized is null or char_length(location_normalized) <= 200),

  description text not null check (char_length(description) between 1 and 50000),
  -- The canonical link back to the real posting — every job here must
  -- be traceable to something a candidate can actually go and read,
  -- same "never assert from nothing" principle graduate_schemes'
  -- required source_url already applies to a sponsorship claim.
  url text not null check (char_length(url) <= 2000 and url ~* '^https?://'),

  -- The source's own "posted" date, distinct from created_at (when
  -- this app's row itself was written) — nullable since not every
  -- source gives one; never defaulted to "now" when unknown, which
  -- would fabricate a freshness signal that isn't real.
  posted_at timestamptz,
  -- When the listing itself says it closes — nullable, since not every
  -- posting gives an expiry. `is_active` below is the *real* current
  -- visibility flag; expires_at is evidence toward it, not the only
  -- source of truth (a source can also explicitly report a listing as
  -- closed before its stated expiry hits).
  expires_at timestamptz,
  is_active boolean not null default true,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  check (title_normalized = lower(title_normalized)),
  check (company_name_normalized = lower(company_name_normalized)),
  check (location_normalized is null or location_normalized = lower(location_normalized)),
  check (posted_at is null or expires_at is null or expires_at >= posted_at),

  unique (source_id, external_id)
);

alter table public.jobs enable row level security;

-- Public read, gated on real current visibility — active and (no
-- stated expiry, or not yet expired). `now()` can't appear in an index
-- predicate (not immutable), but it's fine in an RLS `using` clause,
-- which is evaluated per-query rather than baked into an index.
create policy "Anyone can view active, unexpired jobs"
  on public.jobs for select
  using (is_active and (expires_at is null or expires_at > now()));

create index jobs_source_id_idx on public.jobs (source_id);
create index jobs_title_normalized_idx on public.jobs (title_normalized);
create index jobs_company_name_normalized_idx on public.jobs (company_name_normalized);
create index jobs_location_normalized_idx on public.jobs (location_normalized);
create index jobs_expires_at_idx on public.jobs (expires_at);

-- Supports the query a live listings page actually runs: newest active
-- jobs first. Partial on the static `is_active` flag (not on
-- `expires_at > now()`, which can't be indexed) — same shape as
-- sponsors_active_town_city_idx.
create index jobs_active_posted_at_idx
  on public.jobs (posted_at desc)
  where (is_active);

create trigger set_jobs_updated_at
  before update on public.jobs
  for each row execute procedure public.set_updated_at();

-- ---------------------------------------------------------------------
-- saved_jobs — a user's own bookmarks
-- ---------------------------------------------------------------------

create table public.saved_jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  job_id uuid not null references public.jobs (id) on delete cascade,
  notes text check (char_length(notes) <= 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, job_id)
);

alter table public.saved_jobs enable row level security;

create policy "Users manage their own saved jobs"
  on public.saved_jobs for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index saved_jobs_user_id_idx on public.saved_jobs (user_id);
create index saved_jobs_job_id_idx on public.saved_jobs (job_id);

create trigger set_saved_jobs_updated_at
  before update on public.saved_jobs
  for each row execute procedure public.set_updated_at();

-- ---------------------------------------------------------------------
-- job_matches — one row per AI-scored CV-vs-job assessment
-- ---------------------------------------------------------------------

-- Matches src/lib/ai/prompts/job-match.ts's jobMatchSchema.verdict
-- exactly.
create type public.job_match_verdict as enum ('strong_match', 'worth_applying', 'stretch', 'not_a_fit');

create table public.job_matches (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  job_id uuid not null references public.jobs (id) on delete cascade,
  -- Which CV version was actually scored — nullable with `on delete set
  -- null` rather than cascade, so deleting a CV version never erases
  -- match history, matching ats_rewrites.scan_id's own reasoning
  -- (migration 0031) for a similar "don't lose history when the thing
  -- it references goes away" case.
  cv_version_id uuid references public.cv_versions (id) on delete set null,

  match_score smallint not null check (match_score between 0 and 100),
  verdict public.job_match_verdict not null,
  reasons jsonb not null default '[]'::jsonb,
  gaps jsonb not null default '[]'::jsonb,

  -- Which version of jobMatchPrompt produced this — same traceability
  -- convention as ats_scans.prompt_version.
  prompt_version text not null check (char_length(prompt_version) <= 20),

  created_at timestamptz not null default now()
);

alter table public.job_matches enable row level security;

create policy "Users manage their own job matches"
  on public.job_matches for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index job_matches_user_id_idx on public.job_matches (user_id, created_at desc);
create index job_matches_job_id_idx on public.job_matches (job_id);
create index job_matches_cv_version_id_idx on public.job_matches (cv_version_id);
