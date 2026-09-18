-- Weighted keyword analysis — src/lib/ai/prompts/ats-scan.ts v2.1.0
-- returns matchedKeywords/missingKeywords as objects (term + importance,
-- missing ones also a suggestedSection) instead of plain strings, and
-- src/lib/cvs/ats-actions.ts adds a deterministic occurrence_count on
-- top (counted in application code from the job description text — see
-- src/lib/cvs/ats-keyword-occurrences.ts — never asked of the model,
-- which is a poor fit for exact counting).
--
-- `importance` mirrors ats_issues.priority (migration 0032): same
-- three-level high/medium/low vocabulary, a distinct enum type because
-- it's a conceptually different rating (how central a term is to the
-- job) even though the values read the same.
--
-- `suggested_section` is plain text, not a DB enum — same choice as
-- every other section-key column in this schema (ats_issues.section_key,
-- cv_versions.section_order): validated at the Zod/app layer, not
-- duplicated here. Only ever set on a missing keyword; a matched one is
-- already somewhere in the CV, so there's nothing to suggest.

create type public.ats_keyword_importance as enum ('high', 'medium', 'low');

alter table public.ats_keywords
  add column importance public.ats_keyword_importance not null,
  add column occurrence_count integer not null check (occurrence_count >= 0),
  add column suggested_section text;
