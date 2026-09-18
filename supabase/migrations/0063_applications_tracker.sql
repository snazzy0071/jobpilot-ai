-- Job application tracker — docs/BUILD_CHECKLIST.md's "Tracker (job
-- application kanban)" section, previously "Not started". Schema only
-- here, same stage every other jobs-adjacent feature began at this
-- session.
-- A deliberately separate concern from saved_jobs (migrations 0059/
-- 0062): a wishlist bookmark is "I might want this", an application is
-- "I actually applied, and I'm tracking it through a real process" —
-- different lifecycle, different fields, no shared table.
--
-- Three tables:
--   applications — one row per tracked application. Not tied to a
--     synced `jobs` row the way saved_jobs is: a user applies to jobs
--     from many sources, not just this app's own feed, so
--     company_name/job_title/url/location/salary are this table's own
--     fields, not a join — `job_id` is an optional link back to a real
--     listing when there happens to be one, nullable with `on delete
--     set null` for exactly the reason migration 0062 already fixed on
--     saved_jobs (a pruned job must never take a user's own tracked
--     application down with it).
--   application_status_history — one row per status change, written by
--     a trigger rather than left to application code to remember —
--     same "enforce the invariant in the database" reasoning as
--     cv_versions' demote-other-versions trigger (migration 0024) and
--     0020's atomic usage consumption: whichever code path changes
--     `applications.status` (a Server Action today, a future bulk
--     import or admin tool tomorrow), the history is guaranteed
--     accurate without every caller having to remember to log it
--     separately.
--   application_reminders — user-set follow-up reminders against a
--     tracked application ("follow up if no reply by Friday").
--
-- Every table's RLS is real ownership: `auth.uid() = user_id`, full
-- self-service CRUD via one `for all` policy, same pattern every
-- user-owned table since the CV tables (migration 0024) uses.
-- application_status_history/application_reminders denormalize
-- `user_id` onto the child row directly (same reasoning
-- cv_experience/cv_education etc. already give) rather than requiring
-- a join back through `applications` for every RLS check.

create type public.application_status as enum (
  'wishlist',
  'applied',
  'interview',
  'offer',
  'rejected',
  'withdrawn'
);

-- ---------------------------------------------------------------------
-- applications
-- ---------------------------------------------------------------------

create table public.applications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  job_id uuid references public.jobs (id) on delete set null,

  company_name text not null check (char_length(company_name) between 1 and 300),
  job_title text not null check (char_length(job_title) between 1 and 300),
  location text check (char_length(location) <= 200),
  -- Free text, not a numeric range — same reasoning jobs.salary
  -- (migration 0059) already gives: published figures are a single
  -- number, a band, or nothing at all.
  salary text check (char_length(salary) <= 200),
  url text check (url is null or (char_length(url) <= 2000 and url ~* '^https?://')),

  status public.application_status not null default 'wishlist',
  notes text check (char_length(notes) <= 4000),
  -- The date actually applied, distinct from created_at (when this
  -- tracker entry was made) — a job can sit at 'wishlist' for a while
  -- before that happens, or this row can be backfilled after the fact.
  applied_at date,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.applications enable row level security;

create policy "Users manage their own applications"
  on public.applications for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index applications_user_id_idx on public.applications (user_id, updated_at desc);
create index applications_user_id_status_idx on public.applications (user_id, status);
create index applications_job_id_idx on public.applications (job_id);

create trigger set_applications_updated_at
  before update on public.applications
  for each row execute procedure public.set_updated_at();

-- ---------------------------------------------------------------------
-- application_status_history — written by a trigger, not app code
-- ---------------------------------------------------------------------

create table public.application_status_history (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.applications (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  -- Null for the row logged when the application itself was first
  -- created — there's no real "from" status for that one.
  from_status public.application_status,
  to_status public.application_status not null,
  note text check (char_length(note) <= 1000),
  changed_at timestamptz not null default now()
);

alter table public.application_status_history enable row level security;

create policy "Users manage their own application status history"
  on public.application_status_history for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index application_status_history_application_id_idx
  on public.application_status_history (application_id, changed_at desc);
create index application_status_history_user_id_idx on public.application_status_history (user_id);

create function public.log_application_status_change()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.application_status_history (application_id, user_id, from_status, to_status)
    values (new.id, new.user_id, null, new.status);
  elsif tg_op = 'UPDATE' and new.status is distinct from old.status then
    insert into public.application_status_history (application_id, user_id, from_status, to_status)
    values (new.id, new.user_id, old.status, new.status);
  end if;
  return new;
end;
$$;

create trigger log_application_status_change_after_insert
  after insert on public.applications
  for each row execute procedure public.log_application_status_change();

create trigger log_application_status_change_after_update
  after update of status on public.applications
  for each row execute procedure public.log_application_status_change();

-- ---------------------------------------------------------------------
-- application_reminders
-- ---------------------------------------------------------------------

create table public.application_reminders (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.applications (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  remind_at timestamptz not null,
  message text not null check (char_length(message) between 1 and 500),
  -- Null while outstanding; set once acted on or dismissed — same
  -- "distinct done-state, not a plain boolean" pattern ats_rewrites'
  -- resolved_at already uses (migration 0031).
  completed_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.application_reminders enable row level security;

create policy "Users manage their own application reminders"
  on public.application_reminders for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index application_reminders_application_id_idx on public.application_reminders (application_id);
-- Partial: the real query this supports is "my outstanding reminders
-- due soonest first" — a completed reminder never needs to be found
-- this way again.
create index application_reminders_user_id_remind_at_idx
  on public.application_reminders (user_id, remind_at)
  where (completed_at is null);
