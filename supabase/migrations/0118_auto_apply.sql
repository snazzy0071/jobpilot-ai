-- Assisted Auto-Apply: architecture for finding jobs that fit a user's own rules, preparing an application for each, and getting it
-- applied for — always with the user's review and consent, and never by getting around a site's protections.
--
--   settings   what the user wants (match threshold, roles, locations, salary, sponsor-only, daily limit, CV / cover letter)
--   queue      one row per candidate job, moving through a fixed set of statuses (pending_review -> approved -> ... -> applied)
--   events     append-only audit history of everything that happened to a queue item or the settings
--
-- All three are written by the server only (Server Actions that check the plan, ownership and the rules); users can read their own
-- rows but cannot write them through the API — a queue status is a record of what really happened, not something to set by hand.

create type public.auto_apply_status as enum (
  'pending_review',  -- prepared, waiting for the user to look at it
  'approved',        -- the user consented to this application
  'processing',      -- an adapter is working on it right now
  'needs_manual',    -- the user must apply themselves (unsupported site, protection met, retries used up)
  'applied',         -- done (submitted by an adapter, or confirmed by the user) and logged in the tracker
  'failed',          -- can't be completed and there is no way to apply by hand (e.g. no link)
  'skipped',         -- the user chose not to apply
  'cancelled'        -- withdrawn (paused/disabled, or the job went away before anything was sent)
);

create table public.auto_apply_settings (
  user_id uuid primary key references auth.users (id) on delete cascade,
  enabled boolean not null default false,
  paused boolean not null default false,
  min_match_score smallint not null default 75 check (min_match_score between 50 and 100),
  role_keywords text[] not null default '{}' check (cardinality(role_keywords) <= 10),
  locations text[] not null default '{}' check (cardinality(locations) <= 10),
  -- Listings from the job feeds carry no structured salary today, so this is applied only where a salary is known.
  min_salary integer check (min_salary is null or min_salary > 0),
  include_unknown_salary boolean not null default true,
  sponsor_only boolean not null default false,
  daily_limit smallint not null default 5 check (daily_limit between 1 and 25),
  cv_id uuid references public.cvs (id) on delete set null,
  cover_letter_id uuid references public.cover_letters (id) on delete set null,
  -- The user's acknowledgement of how this works (assisted: nothing is sent without their approval). Required before enabling.
  consent_at timestamptz,
  consent_version text check (consent_version is null or char_length(consent_version) <= 20),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (not enabled or consent_at is not null)
);

create trigger set_auto_apply_settings_updated_at
  before update on public.auto_apply_settings
  for each row execute procedure public.set_updated_at();

create table public.auto_apply_queue (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  -- Kept (set null) if the listing is later removed: the history below shouldn't vanish with it.
  job_id uuid references public.jobs (id) on delete set null,
  company_name text not null check (char_length(company_name) between 1 and 300),
  job_title text not null check (char_length(job_title) between 1 and 300),
  location text check (char_length(location) <= 200),
  apply_url text not null check (char_length(apply_url) <= 2000 and apply_url ~* '^https?://'),
  -- Same job seen through another feed (same employer + title) is the same application: one per user.
  dedupe_key text not null check (char_length(dedupe_key) between 1 and 200),
  status public.auto_apply_status not null default 'pending_review',
  match_score smallint check (match_score between 0 and 100),
  sponsor_status text check (sponsor_status is null or char_length(sponsor_status) <= 30),
  cv_id uuid references public.cvs (id) on delete set null,
  cover_letter_id uuid references public.cover_letters (id) on delete set null,
  -- Which adapter handled (or will handle) it, e.g. "assisted".
  adapter text check (adapter is null or char_length(adapter) <= 60),
  attempt_count smallint not null default 0 check (attempt_count between 0 and 20),
  max_attempts smallint not null default 3 check (max_attempts between 1 and 10),
  next_attempt_at timestamptz,
  last_error text check (last_error is null or char_length(last_error) <= 300),
  application_id uuid references public.applications (id) on delete set null,
  approved_at timestamptz,
  applied_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, dedupe_key),
  check (status not in ('approved', 'processing', 'applied') or approved_at is not null),
  check (status <> 'applied' or applied_at is not null)
);

create unique index auto_apply_queue_user_job_key on public.auto_apply_queue (user_id, job_id) where job_id is not null;
create index auto_apply_queue_user_status_idx on public.auto_apply_queue (user_id, status, created_at desc);
create index auto_apply_queue_approved_today_idx on public.auto_apply_queue (user_id, approved_at) where approved_at is not null;

create trigger set_auto_apply_queue_updated_at
  before update on public.auto_apply_queue
  for each row execute procedure public.set_updated_at();

create table public.auto_apply_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  queue_id uuid references public.auto_apply_queue (id) on delete set null,
  -- e.g. queued, approved, skipped, attempt_failed, handed_to_manual, applied, paused, resumed, settings_changed
  event text not null check (char_length(event) between 1 and 60),
  -- Safe detail only (status names, counts, adapter id, an error CATEGORY): never CV text, cover-letter text or credentials.
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index auto_apply_events_user_idx on public.auto_apply_events (user_id, created_at desc);
create index auto_apply_events_queue_idx on public.auto_apply_events (queue_id, created_at);

alter table public.auto_apply_settings enable row level security;
alter table public.auto_apply_queue enable row level security;
alter table public.auto_apply_events enable row level security;

create policy "Users read their own auto-apply settings" on public.auto_apply_settings for select using (auth.uid() = user_id);
create policy "Users read their own auto-apply queue" on public.auto_apply_queue for select using (auth.uid() = user_id);
create policy "Users read their own auto-apply history" on public.auto_apply_events for select using (auth.uid() = user_id);

-- A plan feature, off on Free and Pro.
update public.plans set entitlements = entitlements || '{"auto_apply": false}'::jsonb where slug in ('free', 'pro');
update public.plans set entitlements = entitlements || '{"auto_apply": true}'::jsonb where slug in ('premium', 'elite');
