-- Rounds out `questions` with the two remaining fields the admin CRUD
-- needs beyond what 0067/0068 already have (options/correct_answer/
-- explanation, is_active): `difficulty` and `subtype`.
--
-- `difficulty` is a real, bounded concept (easy/medium/hard) — a
-- Postgres enum, same choice sponsor_rating/application_status made
-- for a similarly small, stable vocabulary. Nullable: not every
-- question needs one tagged, including the fifteen 0068 already
-- seeded, which this migration deliberately doesn't retroactively
-- guess a difficulty for.
--
-- `subtype` is the opposite: a free-text, admin-defined topic tag
-- within a question_type (e.g. "Percentages" under Numerical
-- Reasoning, "Inference" under Critical Thinking) — plain text, not an
-- enum, same reasoning `question_packs.sector_style`/
-- `graduate_schemes.alias_type` already established for a small,
-- evolving, app-defined category that shouldn't need a migration every
-- time an admin wants a new tag.

create type public.question_difficulty as enum ('easy', 'medium', 'hard');

alter table public.questions
  add column difficulty public.question_difficulty,
  add column subtype text check (subtype is null or char_length(subtype) <= 100);

create index questions_difficulty_idx on public.questions (difficulty);
create index questions_subtype_idx on public.questions (subtype);

-- Both new columns are plain content, not the sensitive answer-key
-- pair — included in the same public column grant 0067 already set up
-- (safe for a practice-taker to see: knowing a question is "hard" or
-- tagged "Percentages" doesn't give away the answer).
grant select (difficulty, subtype) on public.questions to anon, authenticated;
