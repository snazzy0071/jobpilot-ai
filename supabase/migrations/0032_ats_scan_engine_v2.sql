-- Upgrades the ATS scan engine's AI output (src/lib/ai/prompts/ats-scan.ts,
-- bumped 1.0.0 -> 2.0.0) from one holistic score to a full five-part
-- rubric (overall/keyword/structure/format/sections) plus prioritized,
-- ranked fixes instead of a flat improvements list.
--
-- `keyword_coverage_score` is renamed to `keyword_score`: its value now
-- comes directly from the AI's own holistic keyword-coverage judgment,
-- not the matched/(matched+missing) ratio computed in application code
-- as of migration 0031 — "keyword" is the exact name the new schema
-- returns, so the column now matches it. `format_score` keeps its name
-- and NOT NULL/check shape (still "how ATS-parseable is this content"),
-- only its source changes, from a deterministic issue-count penalty to
-- the AI's own judgment — the deterministic format/content ISSUE LIST
-- itself (ats_issues where source = 'format', and the always-live, free
-- equivalent shown mid-edit in the CV editor) is untouched by this
-- migration; only the single derived number ats_scans stored is now
-- sourced differently. `structure_score`/`sections_score` are genuinely
-- new dimensions the AI didn't score before.
--
-- Safe to alter outright, not layer a compatibility shim over — same
-- reasoning as every schema change this session: this is a pre-launch
-- build with no live Supabase project ever connected, so there is no
-- real data these columns could be dropping or renaming out from under.

alter table public.ats_scans
  rename column keyword_coverage_score to keyword_score;

alter table public.ats_scans
  add column structure_score smallint not null check (structure_score between 0 and 100),
  add column sections_score smallint not null check (sections_score between 0 and 100);

-- Ranked priority for an ats_issues row — only ever set on `source =
-- 'ai'` rows (the new prioritizedFixes list); `source = 'format'` rows
-- keep using `severity` for their own warning/info distinction, so this
-- stays nullable rather than forcing every deterministic issue to also
-- carry a priority it was never asked to have.
create type public.ats_issue_priority as enum ('high', 'medium', 'low');

alter table public.ats_issues
  add column priority public.ats_issue_priority;
