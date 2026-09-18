-- LinkedIn Optimiser (src/lib/linkedin/, `linkedin_optimiser` FeatureKey)
-- — no LinkedIn API/OAuth integration at all (this app never asks for or
-- stores LinkedIn credentials, matching the task's own "without LinkedIn
-- credentials" scope): the user pastes their current headline, About,
-- and Experience text directly, picks a target role and seniority, and
-- gets back an AI rewrite to copy back into LinkedIn by hand.
--
-- One row per draft, mutable in place — unlike ats_scans/the original
-- cover_letters (both deliberately append-only history), this is
-- explicitly a *draft* the user keeps revising for one target role, not
-- a one-shot generation log. "Persist drafts securely" means real RLS,
-- not a version history feature nobody asked for.

create type public.linkedin_target_seniority as enum (
  'entry', 'associate', 'mid', 'senior', 'lead', 'director', 'executive'
);

create table public.linkedin_profile_drafts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,

  -- The user's own label for this draft (e.g. "Product Manager switch") —
  -- useful once someone has more than one, one per target role.
  title text not null check (char_length(title) between 1 and 200),
  target_role text not null check (char_length(target_role) between 1 and 200),
  target_seniority public.linkedin_target_seniority not null,

  -- What the user pasted in, verbatim — both the AI's real, non-fabricated
  -- grounding (linkedinOptimizerPrompt's ANTI_FABRICATION_INSTRUCTION) and
  -- the user's own data, worth persisting on its own terms. Headline/About
  -- are optional on LinkedIn itself, so empty string (not null) is a valid
  -- "nothing there yet" state; Experience is required input to generate
  -- anything useful from.
  current_headline text not null default '' check (char_length(current_headline) <= 220),
  current_about text not null default '' check (char_length(current_about) <= 2600),
  current_experience text not null check (char_length(current_experience) between 1 and 8000),

  -- Null until the first successful generation — a freshly created draft
  -- has input but no output yet.
  optimized_headline text check (char_length(optimized_headline) <= 220),
  optimized_about text check (char_length(optimized_about) <= 2600),
  optimized_experience_bullets jsonb not null default '[]'::jsonb,
  suggested_skills jsonb not null default '[]'::jsonb,
  notes jsonb not null default '[]'::jsonb,
  -- Which version of linkedinOptimizerPrompt produced the current output —
  -- same traceability convention as ats_scans.prompt_version. Null until
  -- generated once.
  prompt_version text check (char_length(prompt_version) <= 20),
  generated_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.linkedin_profile_drafts enable row level security;

create policy "Users manage their own LinkedIn drafts"
  on public.linkedin_profile_drafts for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index linkedin_profile_drafts_user_id_idx on public.linkedin_profile_drafts (user_id, updated_at desc);

create trigger set_linkedin_profile_drafts_updated_at
  before update on public.linkedin_profile_drafts
  for each row execute procedure public.set_updated_at();
