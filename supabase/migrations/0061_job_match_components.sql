-- Adds the transparent score breakdown to job_matches (migration
-- 0059) — src/lib/ai/prompts/job-match.ts's jobMatchSchema was bumped
-- (1.0.0 -> 2.0.0) to output four independently-scored components
-- (coreSkills, techFunctionalSkills, domainFit, seniority) alongside
-- its existing holistic `matchScore`, same "score components, not one
-- flat number" reasoning ats_scans (migration 0031) already applies —
-- a candidate looking at a match result should be able to see *why*
-- matchScore is what it is, not just trust a single number.
--
-- Four fixed, named columns rather than a child table (unlike
-- ats_keywords/ats_issues, which are child tables because they're
-- variable-length lists) — this is exactly four known dimensions every
-- match always has, so a normalized row-per-component table would be
-- over-engineering for a shape that never varies.
--
-- All eight new columns are `not null` with no default, which is only
-- safe on an existing table when it has zero rows — true here: nothing
-- has ever written to job_matches (it shipped schema-only in migration
-- 0059, and this is the first migration to actually wire a writer to
-- it, in src/lib/jobs/matching/actions.ts). A row is only ever inserted
-- once every component has actually been scored, matching ats_scans'
-- own "no partial row" pattern — there's no state where a match exists
-- without its full breakdown.

alter table public.job_matches
  add column core_skills_score smallint not null check (core_skills_score between 0 and 100),
  add column core_skills_summary text not null check (char_length(core_skills_summary) <= 240),
  add column tech_functional_skills_score smallint not null check (tech_functional_skills_score between 0 and 100),
  add column tech_functional_skills_summary text not null check (char_length(tech_functional_skills_summary) <= 240),
  add column domain_fit_score smallint not null check (domain_fit_score between 0 and 100),
  add column domain_fit_summary text not null check (char_length(domain_fit_summary) <= 240),
  add column seniority_score smallint not null check (seniority_score between 0 and 100),
  add column seniority_summary text not null check (char_length(seniority_summary) <= 240);
