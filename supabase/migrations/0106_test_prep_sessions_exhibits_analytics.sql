-- Test Prep: what the practice flow needed from the database to be honest and complete.
--
--   1. Exhibits. Numerical questions need a table or chart and diagrammatic questions need shapes; a plain-text
--      prompt can't carry either. `stimulus` (the passage a Watson-Glaser / verbal question is about — previously
--      "Same passage as above", which broke as soon as questions were shuffled or drawn for the daily set),
--      `exhibit` (a validated table / bar chart / shape figure) and `option_figures` (one small figure per option, for
--      diagrammatic answers) are public columns like the prompt. correct_answer / explanation stay behind the
--      column-level grant from 0067.
--   2. Sessions serve a fixed set. Until now a session recorded only a count: the daily five were never stored, so any
--      active question could be "answered" into a session (and the answer came straight back), and a pack session was
--      whatever the pack held at the time. test_session_questions pins exactly what was served, in order. Users can read
--      it but not write it — only the server, when it starts a session, does.
--   3. Timed vs practice mode, one daily session per local day (so a half-finished daily can be resumed instead of
--      re-rolled), and focused practice on one weak subtype.
--   4. History that survives editing. test_answers now keeps the question's test type, subtype and difficulty as they
--      were when it was answered, so accuracy-by-subtype doesn't change (or vanish) when an admin edits or deletes the
--      question later.
--   5. test_prep_accuracy(): the per-(test type, subtype, difficulty) accuracy for the signed-in user, in SQL. The old
--      analytics fetched every answer and joined in application code, which silently truncates at PostgREST's 1,000
--      rows for anyone who practises regularly.
--   6. A multiple-choice question's correct answer must be one of its options (the admin form checked; the database
--      didn't).

-- ---------------------------------------------------------------------
-- exhibits
-- ---------------------------------------------------------------------

alter table public.questions
  add column stimulus text check (stimulus is null or char_length(stimulus) <= 4000),
  add column exhibit jsonb check (exhibit is null or jsonb_typeof(exhibit) = 'object'),
  add column option_figures jsonb check (option_figures is null or jsonb_typeof(option_figures) = 'array');

grant select (stimulus, exhibit, option_figures) on public.questions to anon, authenticated;

alter table public.questions
  add constraint questions_option_figures_match_options
    check (option_figures is null or jsonb_array_length(option_figures) = jsonb_array_length(options)),
  add constraint questions_correct_answer_is_an_option
    check (question_type <> 'multiple_choice' or correct_answer is null or options ? correct_answer);

-- ---------------------------------------------------------------------
-- sessions
-- ---------------------------------------------------------------------

alter table public.test_sessions
  add column mode text not null default 'practice' check (mode in ('practice', 'timed')),
  add column daily_local_date date,
  add column focus_subtype text check (focus_subtype is null or char_length(focus_subtype) <= 100),
  add column focus_test_type_id uuid references public.test_types (id) on delete set null,
  add constraint test_sessions_daily_has_date check (not is_daily or daily_local_date is not null),
  add constraint test_sessions_timed_has_deadline check (mode <> 'timed' or expires_at is not null);

-- One daily session per person per local day: starting again the same day resumes it.
create unique index test_sessions_one_daily_per_day
  on public.test_sessions (user_id, daily_local_date)
  where is_daily;

create table public.test_session_questions (
  id uuid primary key default gen_random_uuid(),
  test_session_id uuid not null references public.test_sessions (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  question_id uuid references public.questions (id) on delete set null,
  position integer not null check (position >= 0),
  unique (test_session_id, position),
  unique (test_session_id, question_id)
);

alter table public.test_session_questions enable row level security;

-- Read-only for the owner: the set a session serves is decided by the server when it starts, never by the client.
create policy "Users view the question sets of their own sessions"
  on public.test_session_questions for select
  using (auth.uid() = user_id);

create index test_session_questions_session_idx on public.test_session_questions (test_session_id, position);
create index test_session_questions_question_idx on public.test_session_questions (question_id);

alter table public.test_answers
  add column test_type_id uuid references public.test_types (id) on delete set null,
  add column subtype text check (subtype is null or char_length(subtype) <= 100),
  add column difficulty public.question_difficulty;

create index test_answers_user_type_subtype_idx on public.test_answers (user_id, test_type_id, subtype);

-- ---------------------------------------------------------------------
-- accuracy by subtype (the signed-in user's own, through RLS)
-- ---------------------------------------------------------------------

-- One row per (test type, subtype, difficulty) the user has answered in a COMPLETED session: how many, how many right,
-- and the same over the last p_recent_days, plus when they last practised it. Security invoker, so test_answers' own
-- policy scopes it to the caller; nothing here reads correct_answer.
create or replace function public.test_prep_accuracy(p_recent_days integer default 14)
returns table (
  test_type_id uuid,
  subtype text,
  difficulty public.question_difficulty,
  total bigint,
  correct bigint,
  recent_total bigint,
  recent_correct bigint,
  last_answered_at timestamptz
)
language sql
stable
as $$
  select
    a.test_type_id,
    coalesce(a.subtype, 'General') as subtype,
    a.difficulty,
    count(*) as total,
    count(*) filter (where a.is_correct) as correct,
    count(*) filter (where a.answered_at >= now() - make_interval(days => greatest(p_recent_days, 1))) as recent_total,
    count(*) filter (where a.is_correct and a.answered_at >= now() - make_interval(days => greatest(p_recent_days, 1))) as recent_correct,
    max(a.answered_at) as last_answered_at
  from public.test_answers a
  join public.test_sessions s on s.id = a.test_session_id
  where s.completed_at is not null
    and a.is_correct is not null
  group by a.test_type_id, coalesce(a.subtype, 'General'), a.difficulty;
$$;

grant execute on function public.test_prep_accuracy(integer) to authenticated;
