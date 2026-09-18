-- Replaces interview_scores' original single 1-5 score + free-text
-- structure_note (migration 0040) with the real rubric this feature
-- actually scores against: Situation, Task, Action, Result (the STAR
-- components, each scored independently rather than folded into one
-- note) plus relevance, clarity, and evidence — seven 0-100 dimensions,
-- the same "AI's own holistic overall judgment, not just an average of
-- the parts" pattern ats_scans already established for its five score
-- components. Safe to restructure outright — interviewFeedbackPrompt
-- (the prompt this table was originally built to mirror) never had a
-- caller, so there's no real output shape to preserve.

alter table public.interview_scores
  drop column score,
  drop column structure_note,
  add column situation_score smallint not null check (situation_score between 0 and 100),
  add column task_score smallint not null check (task_score between 0 and 100),
  add column action_score smallint not null check (action_score between 0 and 100),
  add column result_score smallint not null check (result_score between 0 and 100),
  add column relevance_score smallint not null check (relevance_score between 0 and 100),
  add column clarity_score smallint not null check (clarity_score between 0 and 100),
  add column evidence_score smallint not null check (evidence_score between 0 and 100),
  -- The model's own holistic read, deliberately not computed as an
  -- average of the seven dimensions above — a high score on one
  -- shouldn't automatically prop up the overall, same reasoning
  -- atsScanPrompt's `overall` score documents.
  add column overall_score smallint not null check (overall_score between 0 and 100);
