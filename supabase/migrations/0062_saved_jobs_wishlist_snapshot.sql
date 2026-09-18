-- Turns saved_jobs (migration 0059) into a real wishlist. The original
-- shape only stored `job_id` + `notes` — fine for "which job did they
-- bookmark", but meaningless the moment the underlying jobs row is
-- gone: src/lib/jobs/maintenance.ts's pruneOldInactiveJobs hard-deletes
-- anything inactive for 30+ days, and job_id had `on delete cascade`,
-- so a user's saved wishlist entry would silently vanish along with
-- the listing that produced it. Deleting someone's own saved bookmark
-- as a side effect of an unrelated maintenance sweep they have no
-- visibility into is exactly the kind of silent data loss this
-- project's tables generally go out of their way to avoid (see
-- sponsor_sync_changes' own "never delete historical import evidence
-- blindly" reasoning, migration 0054).
--
-- The fix: snapshot everything a "Save" click can know at the moment
-- it's clicked — company, title, the original posting URL, source,
-- sponsor state, and (when a CV was selected) the current match score
-- — directly onto the row. `url` in particular is the external
-- posting's own link, not an internal id, so a saved job stays fully
-- useful even once our own `jobs` row is gone. `job_id` itself is kept
-- as a "is this still live in our own feed" pointer, now nullable with
-- `on delete set null` instead of cascade — losing the live link is
-- fine; losing the user's own saved record isn't.
--
-- Sponsor state and match score are snapshots, not live values,
-- deliberately: the sponsor register and a CV's own match score can
-- both change after the fact, and a wishlist entry should keep saying
-- what was true when the user actually saved it, not silently update
-- underneath them every time they look at it again.

alter table public.saved_jobs
  drop constraint saved_jobs_job_id_fkey,
  alter column job_id drop not null,
  add constraint saved_jobs_job_id_fkey foreign key (job_id) references public.jobs (id) on delete set null;

alter table public.saved_jobs
  add column company_name text not null check (char_length(company_name) between 1 and 300),
  add column job_title text not null check (char_length(job_title) between 1 and 300),
  add column url text not null check (char_length(url) <= 2000 and url ~* '^https?://'),
  add column source_name text not null check (char_length(source_name) <= 200),
  -- Matches src/lib/jobs/sponsor-match.ts's JOB_SPONSOR_MATCH_STATUSES
  -- exactly — plain text with a check, not a shared Postgres enum with
  -- that module, since sponsor-match's own status values are an
  -- application-level computed result, never stored as a DB enum
  -- anywhere else either.
  add column sponsor_status text not null check (sponsor_status in ('confirmed_sponsor', 'unconfirmed', 'not_found')),
  -- Null specifically means "no CV was selected, or nothing had been
  -- scored yet, at the moment this was saved" — a real, distinct state
  -- from "scored and it was low", so this is never defaulted to a
  -- number.
  add column match_score smallint check (match_score is null or match_score between 0 and 100);
