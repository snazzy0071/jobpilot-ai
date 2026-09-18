-- Interview Coach schema — mock competency-based interview practice
-- (chat or voice), matching the entitlements already seeded for it
-- (chat_interviews_per_month/voice_interviews_per_month, migration
-- 0016) and the existing interviewFeedbackPrompt
-- (src/lib/ai/prompts/interview-feedback.ts) this feature will use once
-- wired up — interview_scores mirrors that prompt's real output shape
-- exactly (score/strengths/improvements/structureNote/
-- suggestedRephrase), the same "schema mirrors the real AI output, not
-- an invented one" discipline ats_scans/ats_rewrites/cover_letters all
-- follow. Schema/RLS only in this task, same scope as the earlier
-- "cover_letters schema/RLS" task that came before its own create flow.
--
-- Four tables, one container + three children, same shape as every
-- other feature this session: interview_sessions (one row per practice
-- session) -> interview_questions (many per session) ->
-- interview_answers (one per question) -> interview_scores (one per
-- answer). interview_transcripts is a fifth, independent child of the
-- session — the raw turn-by-turn conversational log (interviewer and
-- candidate turns alike), distinct from interview_answers' cleaned,
-- structured "this is the answer to this question" record: a transcript
-- turn is the raw material an answer is extracted from, not the same
-- thing as the answer itself.

-- ---------------------------------------------------------------------
-- interview_sessions
-- ---------------------------------------------------------------------

create type public.interview_mode as enum ('chat', 'voice');
create type public.interview_session_status as enum ('in_progress', 'completed', 'abandoned');

create table public.interview_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,

  role text not null check (char_length(role) between 1 and 200),
  company text check (char_length(company) <= 200),
  mode public.interview_mode not null default 'chat',
  status public.interview_session_status not null default 'in_progress',

  duration_seconds integer check (duration_seconds >= 0),

  started_at timestamptz not null default now(),
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  check (status <> 'completed' or completed_at is not null)
);

alter table public.interview_sessions enable row level security;

create policy "Users manage their own interview sessions"
  on public.interview_sessions for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index interview_sessions_user_id_idx on public.interview_sessions (user_id, created_at desc);

create trigger set_interview_sessions_updated_at
  before update on public.interview_sessions
  for each row execute procedure public.set_updated_at();

-- ---------------------------------------------------------------------
-- interview_questions — many rows per session
-- ---------------------------------------------------------------------

-- A standard, generic competency-based interview framework (not tied to
-- any one employer's branded framework) — the real dimension each
-- question is written to probe, matching this feature's own marketing
-- copy: "UK-style competency questions... Tell me about a time...".
create type public.interview_competency as enum (
  'leadership',
  'teamwork',
  'communication',
  'problem_solving',
  'decision_making',
  'adaptability',
  'resilience',
  'initiative',
  'customer_focus',
  'time_management'
);

create table public.interview_questions (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.interview_sessions (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,

  competency public.interview_competency not null,
  question text not null check (char_length(question) between 1 and 500),
  display_order integer not null default 0,

  created_at timestamptz not null default now()
);

alter table public.interview_questions enable row level security;

create policy "Users manage their own interview questions"
  on public.interview_questions for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index interview_questions_session_id_idx on public.interview_questions (session_id, display_order);
create index interview_questions_user_id_idx on public.interview_questions (user_id);

-- ---------------------------------------------------------------------
-- interview_answers — one row per question
-- ---------------------------------------------------------------------

create table public.interview_answers (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null references public.interview_questions (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,

  -- The cleaned, final answer text actually scored — for voice mode
  -- this is the transcribed-and-finalized answer, not a raw stream; see
  -- interview_transcripts below for the turn-by-turn raw log it was
  -- drawn from.
  answer_text text not null check (char_length(answer_text) between 1 and 8000),
  duration_seconds integer check (duration_seconds >= 0),

  created_at timestamptz not null default now(),
  unique (question_id)
);

alter table public.interview_answers enable row level security;

create policy "Users manage their own interview answers"
  on public.interview_answers for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index interview_answers_question_id_idx on public.interview_answers (question_id);
create index interview_answers_user_id_idx on public.interview_answers (user_id);

-- ---------------------------------------------------------------------
-- interview_scores — one row per answer, mirroring
-- interviewFeedbackSchema's real output shape exactly
-- ---------------------------------------------------------------------

create table public.interview_scores (
  id uuid primary key default gen_random_uuid(),
  answer_id uuid not null references public.interview_answers (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,

  score smallint not null check (score between 1 and 5),
  strengths jsonb not null default '[]'::jsonb,
  improvements jsonb not null default '[]'::jsonb,
  structure_note text not null check (char_length(structure_note) <= 400),
  suggested_rephrase text check (char_length(suggested_rephrase) <= 600),

  -- Which version of interviewFeedbackPrompt produced this — same
  -- traceability convention as every other AI-scored table this session
  -- (ats_scans.prompt_version, cover_letter_versions.prompt_version).
  prompt_version text not null check (char_length(prompt_version) <= 20),

  created_at timestamptz not null default now(),
  unique (answer_id)
);

alter table public.interview_scores enable row level security;

create policy "Users manage their own interview scores"
  on public.interview_scores for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index interview_scores_answer_id_idx on public.interview_scores (answer_id);
create index interview_scores_user_id_idx on public.interview_scores (user_id);

-- ---------------------------------------------------------------------
-- interview_transcripts — many rows per session, the raw conversational
-- log (both speakers), independent of interview_answers
-- ---------------------------------------------------------------------

create type public.interview_speaker as enum ('interviewer', 'candidate');

create table public.interview_transcripts (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.interview_sessions (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  -- Which question (if any) this turn belongs to — null for a turn that
  -- isn't tied to one specific question (an opening greeting, a
  -- clarifying aside). Set null rather than cascading the turn away if
  -- the question itself is ever deleted, so the raw log stays complete
  -- even if the structured question/answer record above it doesn't.
  question_id uuid references public.interview_questions (id) on delete set null,

  speaker public.interview_speaker not null,
  content text not null check (char_length(content) between 1 and 8000),
  sequence_index integer not null default 0,

  created_at timestamptz not null default now(),
  unique (session_id, sequence_index)
);

alter table public.interview_transcripts enable row level security;

create policy "Users manage their own interview transcripts"
  on public.interview_transcripts for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index interview_transcripts_session_id_idx on public.interview_transcripts (session_id, sequence_index);
create index interview_transcripts_question_id_idx on public.interview_transcripts (question_id);
create index interview_transcripts_user_id_idx on public.interview_transcripts (user_id);
