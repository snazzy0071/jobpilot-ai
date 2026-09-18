-- Test prep (docs/BUILD_CHECKLIST.md's "Test prep" section — "original
-- practice questions only, never copyrighted test items", per this
-- project's own rule against reproducing proprietary assessment
-- content such as Watson Glaser or SHL). Six tables:
--
--   test_types — a practice category ("Numerical Reasoning",
--     "Critical Thinking Practice", …). Curated content: public read,
--     admin-only write, same shape graduate_schemes established
--     (migrations 0056/0058).
--   question_packs — a named, gradeable set of questions under one
--     test_type — the thing a test_session is actually an attempt at.
--   questions — one row per question in a pack. Deliberately generic
--     (multiple_choice/true_false/free_text), not modelled on any one
--     commercial test's own question taxonomy — this app's own
--     original format, not a structural copy of a proprietary one.
--   test_sessions — one row per user's attempt at a pack.
--   test_answers — one row per question answered within a session.
--   practice_progress — one row per (user, test_type): attempts,
--     best score, last practiced — the aggregate a learner actually
--     wants to see ("how am I doing at Numerical Reasoning overall"),
--     rolled up above the level of one pack/attempt.
--
-- "Admin ownership fields": test_types/question_packs/questions each
-- carry `created_by` — which admin authored this content, nullable
-- with `on delete set null` so the content survives even if that
-- admin account is later removed (the same "losing the link is fine,
-- losing the record isn't" reasoning already applied to
-- applications.cv_id / saved_jobs.job_id elsewhere this session).
-- Write access to all three is real RLS, gated on `profiles.role =
-- 'admin'`, the exact pattern migration 0058 already established for
-- graduate_schemes — not just an app-level convention.
--
-- test_sessions/test_answers/practice_progress are the opposite shape
-- — genuinely user-owned, one `for all using (auth.uid() = user_id)`
-- policy each, same as every CV/ATS/tracker table already uses.
--
-- The one genuinely new security concern here, beyond anything a
-- prior sponsor/jobs/tracker table needed: a plain public-read RLS
-- policy on `questions` would let anyone fetch a question's own
-- `correct_answer`/`explanation` before answering it, defeating the
-- point of a practice test — RLS is a *row* filter, it can't hide a
-- *column* within a row a policy already allows. The real fix is a
-- Postgres column-level privilege, applied below: `anon`/
-- `authenticated` are only ever granted SELECT on the columns needed
-- to *display and attempt* a question, never `correct_answer`/
-- `explanation`. Grading (or a future admin question-editor needing to
-- read those two columns back) has to go through the service-role
-- client (src/lib/supabase/admin.ts) — which bypasses ordinary grants
-- the same way it bypasses RLS — never the regular request-scoped
-- client. `service_role` itself needs no explicit grant here for the
-- same reason it needs none for RLS: it already has full table access.

create type public.question_type as enum ('multiple_choice', 'true_false', 'free_text');

-- ---------------------------------------------------------------------
-- test_types
-- ---------------------------------------------------------------------

create table public.test_types (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (char_length(slug) <= 100),
  name text not null check (char_length(name) between 1 and 200),
  description text check (char_length(description) <= 2000),
  created_by uuid references auth.users (id) on delete set null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.test_types enable row level security;

create policy "Anyone can view test types"
  on public.test_types for select
  using (true);

create policy "Admins can insert test types"
  on public.test_types for insert
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));

create policy "Admins can update test types"
  on public.test_types for update
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));

create policy "Admins can delete test types"
  on public.test_types for delete
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));

create trigger set_test_types_updated_at
  before update on public.test_types
  for each row execute procedure public.set_updated_at();

-- ---------------------------------------------------------------------
-- question_packs
-- ---------------------------------------------------------------------

create table public.question_packs (
  id uuid primary key default gen_random_uuid(),
  test_type_id uuid not null references public.test_types (id) on delete cascade,
  slug text not null check (char_length(slug) <= 100),
  name text not null check (char_length(name) between 1 and 200),
  description text check (char_length(description) <= 2000),
  -- Null means untimed — not every practice pack needs a clock.
  time_limit_seconds integer check (time_limit_seconds is null or time_limit_seconds > 0),
  created_by uuid references auth.users (id) on delete set null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (test_type_id, slug)
);

alter table public.question_packs enable row level security;

create policy "Anyone can view question packs"
  on public.question_packs for select
  using (true);

create policy "Admins can insert question packs"
  on public.question_packs for insert
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));

create policy "Admins can update question packs"
  on public.question_packs for update
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));

create policy "Admins can delete question packs"
  on public.question_packs for delete
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));

create index question_packs_test_type_id_idx on public.question_packs (test_type_id);

create trigger set_question_packs_updated_at
  before update on public.question_packs
  for each row execute procedure public.set_updated_at();

-- ---------------------------------------------------------------------
-- questions
-- ---------------------------------------------------------------------

create table public.questions (
  id uuid primary key default gen_random_uuid(),
  question_pack_id uuid not null references public.question_packs (id) on delete cascade,
  question_type public.question_type not null,
  prompt text not null check (char_length(prompt) between 1 and 4000),
  -- Only meaningful for 'multiple_choice' — a jsonb array of option
  -- strings (this app's own simple format, not a copy of any specific
  -- commercial test's answer-scale structure, e.g. Watson Glaser's
  -- five-way inference scale). Empty for 'true_false'/'free_text'.
  options jsonb not null default '[]'::jsonb,
  -- The two sensitive columns this migration's own header comment
  -- covers — never granted to anon/authenticated at the column level,
  -- below.
  correct_answer text check (char_length(correct_answer) <= 500),
  explanation text check (char_length(explanation) <= 2000),
  display_order integer not null default 0,
  created_by uuid references auth.users (id) on delete set null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (question_type <> 'multiple_choice' or jsonb_array_length(options) >= 2),
  check (question_type = 'free_text' or correct_answer is not null)
);

alter table public.questions enable row level security;

create policy "Anyone can view questions"
  on public.questions for select
  using (true);

create policy "Admins can insert questions"
  on public.questions for insert
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));

create policy "Admins can update questions"
  on public.questions for update
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));

create policy "Admins can delete questions"
  on public.questions for delete
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));

create index questions_question_pack_id_idx on public.questions (question_pack_id, display_order);

create trigger set_questions_updated_at
  before update on public.questions
  for each row execute procedure public.set_updated_at();

-- The actual column-level protection: revoke the blanket table grant
-- PostgREST's `anon`/`authenticated` roles otherwise have, then
-- re-grant only the columns a practice-taker is allowed to see before
-- (and while) answering — never `correct_answer`/`explanation`.
revoke select on public.questions from anon, authenticated;
grant select (id, question_pack_id, question_type, prompt, options, display_order, is_active, created_at, updated_at)
  on public.questions to anon, authenticated;

-- ---------------------------------------------------------------------
-- test_sessions
-- ---------------------------------------------------------------------

create table public.test_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  -- Nullable + on delete set null: an admin removing a pack later must
  -- never erase a user's own record of having attempted it.
  question_pack_id uuid references public.question_packs (id) on delete set null,
  -- A snapshot of the pack's size when the attempt started — the pack
  -- itself can gain/lose questions later without rewriting what this
  -- specific attempt was actually scored out of.
  total_questions integer not null check (total_questions >= 0),
  correct_count integer check (correct_count is null or correct_count >= 0),
  score smallint check (score is null or score between 0 and 100),
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  check (completed_at is null or (correct_count is not null and score is not null))
);

alter table public.test_sessions enable row level security;

create policy "Users manage their own test sessions"
  on public.test_sessions for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index test_sessions_user_id_idx on public.test_sessions (user_id, started_at desc);
create index test_sessions_question_pack_id_idx on public.test_sessions (question_pack_id);

-- ---------------------------------------------------------------------
-- test_answers
-- ---------------------------------------------------------------------

create table public.test_answers (
  id uuid primary key default gen_random_uuid(),
  test_session_id uuid not null references public.test_sessions (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  -- Nullable + on delete set null, same reasoning as
  -- test_sessions.question_pack_id — a later-deleted question must
  -- never erase the user's own answer history.
  question_id uuid references public.questions (id) on delete set null,
  selected_answer text check (char_length(selected_answer) <= 500),
  is_correct boolean,
  answered_at timestamptz not null default now(),
  unique (test_session_id, question_id)
);

alter table public.test_answers enable row level security;

create policy "Users manage their own test answers"
  on public.test_answers for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index test_answers_test_session_id_idx on public.test_answers (test_session_id);
create index test_answers_question_id_idx on public.test_answers (question_id);
create index test_answers_user_id_idx on public.test_answers (user_id);

-- ---------------------------------------------------------------------
-- practice_progress
-- ---------------------------------------------------------------------

create table public.practice_progress (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  test_type_id uuid not null references public.test_types (id) on delete cascade,
  attempts_count integer not null default 0 check (attempts_count >= 0),
  best_score smallint check (best_score is null or best_score between 0 and 100),
  last_practiced_at timestamptz,
  updated_at timestamptz not null default now(),
  unique (user_id, test_type_id)
);

alter table public.practice_progress enable row level security;

create policy "Users manage their own practice progress"
  on public.practice_progress for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index practice_progress_user_id_idx on public.practice_progress (user_id);
create index practice_progress_test_type_id_idx on public.practice_progress (test_type_id);

create trigger set_practice_progress_updated_at
  before update on public.practice_progress
  for each row execute procedure public.set_updated_at();
