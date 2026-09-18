-- First-login onboarding wizard fields. Replaces the placeholder
-- singular `target_role` (added in 0003, never read/written by any app
-- code) with a proper multi-value array, and adds career stage, target
-- industries, and primary goal.

create type public.career_stage as enum (
  'student',
  'recent_graduate',
  'early_career',
  'career_switcher',
  'experienced_professional'
);

create type public.primary_goal as enum (
  'first_role',
  'career_change',
  'career_growth',
  'exploring',
  'other'
);

-- Used by the CHECK constraints below — a plain boolean expression can't
-- inspect each array element (Postgres disallows subqueries inside CHECK),
-- so the per-element length check lives in this small immutable function.
create function public.all_items_within_length(items text[], max_len int)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select coalesce(bool_and(char_length(item) <= max_len), true) from unnest(items) as item;
$$;

alter table public.user_preferences
  drop column target_role,
  add column career_stage public.career_stage,
  add column target_roles text[] not null default '{}',
  add column industries text[] not null default '{}',
  add column primary_goal public.primary_goal;

alter table public.user_preferences
  add constraint target_roles_valid check (
    cardinality(target_roles) <= 10 and public.all_items_within_length(target_roles, 100)
  ),
  add constraint industries_valid check (
    cardinality(industries) <= 10 and public.all_items_within_length(industries, 100)
  );
