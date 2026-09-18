-- Daily 5-question practice — a short, mixed-format quiz drawn from
-- across every active pack/type (not scoped to one question_pack_id,
-- unlike the regular practice flow), used to build a practice streak.
--
-- `test_sessions.is_daily` marks which sessions are the real daily
-- quiz — needed because a daily session's own `question_pack_id` is
-- null (it isn't one pack), which already makes submitAnswer's normal
-- pack-membership check meaningless for it; the flag is what lets
-- server code tell "this is a mixed daily session, skip that check"
-- apart from "this session is missing its pack for an unrelated
-- reason" (an admin deleting a pack later, the existing on-delete-
-- set-null case). It also lets `recordDailyCompletion` verify a
-- completion is actually being claimed for a real daily attempt
-- (total_questions = 5, is_daily = true), not any arbitrary completed
-- session the caller happens to own.
alter table public.test_sessions
  add column is_daily boolean not null default false;

-- One row per calendar day a user actually completed their daily
-- practice — this is the table streak/last-14-day display logic reads,
-- not test_sessions directly, because "which day" a session counts
-- toward is a *local calendar date*, not the UTC timestamp
-- test_sessions already stores. `local_date` is computed once
-- server-side at completion time from the session's own completed_at
-- plus the caller-supplied IANA timezone (there's no stored per-user
-- timezone preference in this app, so it's detected in the browser and
-- passed on every daily-practice call) — a real snapshot, the same
-- "freeze it at the meaningful moment" reasoning already used
-- elsewhere (test_sessions.total_questions, applications' snapshot
-- freeze, test_sessions.expires_at): a streak day must never silently
-- shift to a different date just because the user's current timezone
-- changed later (e.g. after travelling).
--
-- `unique (user_id, local_date)` is what makes "completed today" a
-- simple existence check and makes recording a second completion on
-- the same local day a no-op conflict rather than a duplicate row.
create table public.daily_practice_completions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  -- Nullable + on delete set null, same reasoning as every other
  -- session/question back-reference in this schema — losing the
  -- session detail must never erase the streak day itself.
  test_session_id uuid references public.test_sessions (id) on delete set null,
  local_date date not null,
  correct_count smallint not null check (correct_count >= 0),
  total_questions smallint not null check (total_questions > 0),
  completed_at timestamptz not null default now(),
  unique (user_id, local_date)
);

alter table public.daily_practice_completions enable row level security;

create policy "Users manage their own daily practice completions"
  on public.daily_practice_completions for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index daily_practice_completions_user_id_local_date_idx
  on public.daily_practice_completions (user_id, local_date desc);
