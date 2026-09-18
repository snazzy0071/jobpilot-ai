-- The session-level results a completed interview needs: a holistic
-- overall score (the model's own judgment, deliberately not an average
-- of the per-answer overall_scores — same reasoning atsScanPrompt's
-- `overall` and interviewAnswerScorePrompt's `overallScore` already
-- document), plus session-wide strengths, weaknesses, and recommended
-- practice — real synthesis across every answer, not a concatenation
-- of each answer's own strengths/improvements. Lives on the container
-- (interview_sessions), not a separate child table: it's generated
-- once, at the point the session concludes, and never evolves after
-- that the way per-answer scores or the transcript do.

alter table public.interview_sessions
  add column overall_score smallint check (overall_score between 0 and 100),
  add column strengths jsonb not null default '[]'::jsonb,
  add column weaknesses jsonb not null default '[]'::jsonb,
  add column recommended_practice jsonb not null default '[]'::jsonb,
  add column summary_prompt_version text check (char_length(summary_prompt_version) <= 20);
