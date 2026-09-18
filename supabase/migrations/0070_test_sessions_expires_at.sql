-- Timed practice/test mode: a server-safe end time for a session.
--
-- `started_at` (migration 0067) was already server-safe — it's a DB
-- default, never client-supplied. What was missing is the *end* of the
-- window: the practice engine's countdown (src/components/test-prep/
-- practice-engine.tsx) was purely a client-side timer seeded from the
-- pack's `time_limit_seconds` prop, with nothing on the server actually
-- enforcing it — a client could ignore or outlast its own countdown and
-- `submitAnswer` would keep accepting answers regardless.
--
-- `expires_at` is computed once, server-side, at session start
-- (`started_at + question_packs.time_limit_seconds`) and stored as a
-- real snapshot — never recomputed from a live join afterwards, same
-- "freeze it at the meaningful moment" reasoning already applied to
-- `total_questions` on this same table and to applications'
-- sponsor/match/CV-version freeze (migration 0065). A pack's time limit
-- changing later must never retroactively change how long an
-- already-started attempt was allowed to run. Null means untimed,
-- matching `question_packs.time_limit_seconds` itself being nullable.
alter table public.test_sessions
  add column expires_at timestamptz;

comment on column public.test_sessions.expires_at is
  'Server-computed deadline snapshot (started_at + the pack''s time_limit_seconds at the moment this session began); null for untimed packs. Never updated after insert.';
