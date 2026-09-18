-- Extends `cvs`/`cv_versions` (migration 0024) with what the My CVs list
-- (and the editor it links to) actually needs to display and manage:
-- which design template a CV uses, whether it's archived (hidden but
-- kept, distinct from actually deleting it), and the last computed ATS
-- match score for a version.
--
-- Only 3 templates exist as an actual concept right now — the visual
-- designs themselves are a future CV Builder task, not this one — so
-- this is a real, honest set of options users can pick between and see
-- reflected in the list, not a placeholder for a catalog that doesn't
-- exist yet.

create type public.cv_template as enum ('classic', 'modern', 'minimal');

alter table public.cvs
  add column template public.cv_template not null default 'classic',
  add column is_archived boolean not null default false,
  add column archived_at timestamptz;

-- Keeps the pairing the app relies on honest at the database level:
-- archived_at is set exactly when is_archived is true, never stale after
-- unarchiving and never missing while archived.
alter table public.cvs
  add constraint cvs_archived_at_matches_is_archived
  check ((is_archived and archived_at is not null) or (not is_archived and archived_at is null));

create index cvs_user_id_is_archived_idx on public.cvs (user_id, is_archived);

-- Written by a future ATS Scanner run against this specific version's
-- content; null until one has ever run for it. Nullable and otherwise
-- unconstrained beyond the score range — this migration only adds
-- somewhere real to store it, it doesn't run any scan itself.
alter table public.cv_versions
  add column ats_score smallint check (ats_score is null or (ats_score between 0 and 100));
