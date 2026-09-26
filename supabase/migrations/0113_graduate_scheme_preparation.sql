-- Graduate scheme preparation journey (scheme -> CV -> ATS -> tests -> interview -> tracker), persisted per user and scheme.
--
-- One row per (user, scheme) records that the user started preparing and which CV they chose. Everything else in the journey is
-- REAL work done in the existing tools, linked back to the scheme rather than copied: an ATS scan, mock interviews and a tracker
-- application each get a nullable `graduate_scheme_id`, and test progress is read from the user's practice history for the
-- scheme's required assessment types. So there is no second copy of any score or status that could drift.

create table public.graduate_scheme_preparations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  scheme_id uuid not null references public.graduate_schemes (id) on delete cascade,
  -- The CV being prepared for this scheme. Cleared (not deleted) if the CV is deleted.
  cv_id uuid references public.cvs (id) on delete set null,
  started_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, scheme_id)
);

create index graduate_scheme_preparations_user_idx on public.graduate_scheme_preparations (user_id, updated_at desc);
create index graduate_scheme_preparations_scheme_idx on public.graduate_scheme_preparations (scheme_id);

create trigger set_graduate_scheme_preparations_updated_at
  before update on public.graduate_scheme_preparations
  for each row execute procedure public.set_updated_at();

alter table public.graduate_scheme_preparations enable row level security;

create policy "Users read their own scheme preparations"
  on public.graduate_scheme_preparations for select
  using (auth.uid() = user_id);

-- The database itself checks what an id points at, so a request can't attach someone else's CV or a draft scheme:
-- the CV must be the caller's, and the scheme must be one they can see (published — the schemes select policy applies here).
create policy "Users start preparing published schemes"
  on public.graduate_scheme_preparations for insert
  with check (
    auth.uid() = user_id
    and exists (select 1 from public.graduate_schemes s where s.id = scheme_id)
    and (cv_id is null or exists (select 1 from public.cvs c where c.id = cv_id and c.user_id = auth.uid()))
  );

create policy "Users update their own scheme preparations"
  on public.graduate_scheme_preparations for update
  using (auth.uid() = user_id)
  with check (
    auth.uid() = user_id
    and (cv_id is null or exists (select 1 from public.cvs c where c.id = cv_id and c.user_id = auth.uid()))
  );

create policy "Users delete their own scheme preparations"
  on public.graduate_scheme_preparations for delete
  using (auth.uid() = user_id);

-- Links from the existing tools' rows back to the scheme they were done for.
alter table public.ats_scans add column graduate_scheme_id uuid references public.graduate_schemes (id) on delete set null;
alter table public.interview_sessions add column graduate_scheme_id uuid references public.graduate_schemes (id) on delete set null;
alter table public.applications add column graduate_scheme_id uuid references public.graduate_schemes (id) on delete set null;

create index ats_scans_scheme_idx on public.ats_scans (user_id, graduate_scheme_id, created_at desc) where graduate_scheme_id is not null;
create index interview_sessions_scheme_idx on public.interview_sessions (user_id, graduate_scheme_id, created_at desc) where graduate_scheme_id is not null;
-- One tracked application per scheme per user.
create unique index applications_one_per_scheme on public.applications (user_id, graduate_scheme_id) where graduate_scheme_id is not null;
