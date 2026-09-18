-- Lets a user launch a new, targeted practice session for specific weak
-- competencies without touching the session that identified them as
-- weak — every interview_sessions row is already immutable once
-- created (nothing in this feature ever updates another session's own
-- rows), so "without overwriting historical sessions" was already true
-- by construction; what was missing was a way to *target* a new
-- session's questions at particular competencies, and a way to trace a
-- practice session back to the one that prompted it.
--
-- `practiced_from_session_id` mirrors ats_scans.reused_from_scan_id
-- (migration 0031) exactly — same self-referencing provenance shape,
-- `on delete set null` so a chain of practice sessions survives even if
-- an earlier one in it is ever removed.

alter table public.interview_sessions
  add column focus_competencies jsonb not null default '[]'::jsonb,
  add column practiced_from_session_id uuid references public.interview_sessions (id) on delete set null;

create index interview_sessions_practiced_from_idx on public.interview_sessions (practiced_from_session_id);
