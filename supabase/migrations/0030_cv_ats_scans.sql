-- ATS pre-flight scans run from inside the CV editor — a user pastes (or
-- reuses) a job description and gets a real, persisted match score plus
-- keyword gaps, scoped to the CV version they scanned (same
-- cv_version_id convention as every other cv_* content table in
-- 0024_cvs.sql). History is kept, not just the latest row, so "select a
-- previous job" can offer a user's own past job descriptions back to
-- them — across any of their CVs, not just this one, since the same job
-- description is often scanned against more than one CV.

create table public.cv_ats_scans (
  id uuid primary key default gen_random_uuid(),
  cv_version_id uuid not null references public.cv_versions (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  job_description text not null check (char_length(job_description) between 1 and 20000),
  match_score smallint not null check (match_score between 0 and 100),
  matched_keywords jsonb not null default '[]'::jsonb,
  missing_keywords jsonb not null default '[]'::jsonb,
  strengths jsonb not null default '[]'::jsonb,
  improvements jsonb not null default '[]'::jsonb,
  summary text not null check (char_length(summary) <= 600),
  created_at timestamptz not null default now()
);

alter table public.cv_ats_scans enable row level security;

create policy "Users manage their own CV ATS scans"
  on public.cv_ats_scans for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index cv_ats_scans_cv_version_id_idx on public.cv_ats_scans (cv_version_id, created_at desc);
-- Backs "reuse a previous job description" — the most recent scans across
-- all of a user's CVs, regardless of which version.
create index cv_ats_scans_user_id_idx on public.cv_ats_scans (user_id, created_at desc);
