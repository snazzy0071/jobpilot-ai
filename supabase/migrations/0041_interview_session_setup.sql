-- Adds the fields the interview setup flow actually collects/produces —
-- migration 0040 covered the practice-session lifecycle (role, company,
-- mode, status, duration) but had nowhere to record the job description
-- grounding a session, how hard the questions should be, or which CV
-- they were generated against. Same "input provenance" reasoning as
-- ats_scans.cv_version_id/cv_text_snapshot and cover_letter_versions'
-- equivalent columns: the CV keeps changing after a session is set up,
-- so without an immutable snapshot the generated questions become
-- unexplainable later.

create type public.interview_difficulty as enum ('easy', 'medium', 'hard');

alter table public.interview_sessions
  add column job_description text check (char_length(job_description) <= 20000),
  add column difficulty public.interview_difficulty not null default 'medium',
  add column cv_version_id uuid references public.cv_versions (id) on delete cascade,
  add column cv_text_snapshot text check (char_length(cv_text_snapshot) <= 12000);

create index interview_sessions_cv_version_id_idx on public.interview_sessions (cv_version_id);

-- Which version of interviewQuestionsPrompt produced this session's
-- question set — same traceability convention as interview_scores'
-- prompt_version for interviewFeedbackPrompt.
alter table public.interview_questions
  add column prompt_version text check (char_length(prompt_version) <= 20);
