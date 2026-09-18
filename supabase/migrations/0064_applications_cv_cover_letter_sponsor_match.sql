-- Rounds out applications (migration 0063) with the rest of what the
-- real create/edit form needs: a deadline, an optional link to which
-- CV and cover letter were actually used, and the same sponsor-state/
-- match-score snapshot fields saved_jobs already has (migration 0062)
-- — same reasoning: both describe what was actually true when the
-- application was last saved, not a live value that could silently
-- change underneath the user later.
--
-- cv_id/cover_letter_id are nullable with `on delete set null`, same
-- "losing the link is fine, losing the user's own tracked record isn't"
-- reasoning as `applications.job_id` itself (migration 0063) and
-- `saved_jobs.job_id` (migration 0062) — deleting a CV or cover letter
-- must never take a tracked application down with it. Ownership of
-- whichever cv_id/cover_letter_id is given isn't (and can't be)
-- enforced by the foreign key itself — a FK only checks the row
-- exists, not who owns it — so src/lib/applications/actions.ts checks
-- that server-side before ever saving one.

alter table public.applications
  add column deadline date,
  add column cv_id uuid references public.cvs (id) on delete set null,
  add column cover_letter_id uuid references public.cover_letters (id) on delete set null,
  -- Matches src/lib/jobs/sponsor-match.ts's JOB_SPONSOR_MATCH_STATUSES
  -- exactly, same as saved_jobs.sponsor_status (migration 0062) —
  -- nullable here (unlike that not-null column) since an application
  -- can be saved before a sponsor cross-reference has ever run for it.
  add column sponsor_status text check (sponsor_status is null or sponsor_status in ('confirmed_sponsor', 'unconfirmed', 'not_found')),
  -- Null means no CV was linked (or nothing had been scored yet) the
  -- last time this application was saved — distinct from a real low
  -- score, same reasoning saved_jobs.match_score already documents.
  add column match_score smallint check (match_score is null or match_score between 0 and 100);

create index applications_cv_id_idx on public.applications (cv_id);
create index applications_cover_letter_id_idx on public.applications (cover_letter_id);
