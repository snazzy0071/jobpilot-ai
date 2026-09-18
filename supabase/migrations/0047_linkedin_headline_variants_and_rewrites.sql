-- Expands the LinkedIn Optimiser (migration 0046) with three real
-- pieces this task adds: (1) three headline variants instead of one,
-- (2) Experience bullets promoted from a jsonb blob to real rows so each
-- can be individually regenerated/accepted/rejected, and (3) the
-- Regenerate -> Accept/Reject review flow for About and Experience,
-- reusing the exact suggested/accepted/rejected shape
-- ats_rewrites/cover_letter_paragraph_rewrites already established —
-- same component (AiRewritePanel) drives all three.

-- ---------------------------------------------------------------------
-- Headline: one column per variant, not a jsonb blob — each has its own
-- 220-char LinkedIn limit to enforce, which a single jsonb column can't
-- express as a check constraint the way three real columns can.
-- ---------------------------------------------------------------------

alter table public.linkedin_profile_drafts
  drop column optimized_headline,
  drop column optimized_experience_bullets,
  add column optimized_headline_concise text check (char_length(optimized_headline_concise) <= 220),
  add column optimized_headline_narrative text check (char_length(optimized_headline_narrative) <= 220),
  add column optimized_headline_keyword_dense text check (char_length(optimized_headline_keyword_dense) <= 220);

-- ---------------------------------------------------------------------
-- linkedin_experience_bullets — one row per rewritten bullet, mirroring
-- cover_letter_paragraphs' shape: a real, individually-addressable row
-- rather than an array entry, which is what lets each bullet be
-- regenerated/accepted/rejected on its own instead of all-or-nothing.
-- ---------------------------------------------------------------------

create table public.linkedin_experience_bullets (
  id uuid primary key default gen_random_uuid(),
  draft_id uuid not null references public.linkedin_profile_drafts (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  content text not null check (char_length(content) <= 300),
  display_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.linkedin_experience_bullets enable row level security;

create policy "Users manage their own LinkedIn experience bullets"
  on public.linkedin_experience_bullets for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index linkedin_experience_bullets_draft_id_idx on public.linkedin_experience_bullets (draft_id);
create index linkedin_experience_bullets_user_id_idx on public.linkedin_experience_bullets (user_id);

create trigger set_linkedin_experience_bullets_updated_at
  before update on public.linkedin_experience_bullets
  for each row execute procedure public.set_updated_at();

-- ---------------------------------------------------------------------
-- Rewrite history — identical suggested/accepted/rejected shape to
-- ats_rewrites/cover_letter_paragraph_rewrites, one status enum shared
-- by both new tables below since the shape (and the review UI it
-- drives, AiRewritePanel) is identical.
-- ---------------------------------------------------------------------

create type public.linkedin_rewrite_status as enum ('suggested', 'accepted', 'rejected');

create table public.linkedin_about_rewrites (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  draft_id uuid not null references public.linkedin_profile_drafts (id) on delete cascade,
  original_text text not null check (char_length(original_text) <= 2600),
  suggested_text text not null check (char_length(suggested_text) <= 2600),
  explanation text not null check (char_length(explanation) <= 300),
  status public.linkedin_rewrite_status not null default 'suggested',
  prompt_version text not null check (char_length(prompt_version) <= 20),
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  check (status = 'suggested' or resolved_at is not null)
);

alter table public.linkedin_about_rewrites enable row level security;

create policy "Users manage their own LinkedIn About rewrites"
  on public.linkedin_about_rewrites for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index linkedin_about_rewrites_draft_id_idx on public.linkedin_about_rewrites (draft_id);
create index linkedin_about_rewrites_user_id_idx on public.linkedin_about_rewrites (user_id);

create table public.linkedin_experience_bullet_rewrites (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  bullet_id uuid not null references public.linkedin_experience_bullets (id) on delete cascade,
  original_text text not null check (char_length(original_text) <= 300),
  suggested_text text not null check (char_length(suggested_text) <= 300),
  explanation text not null check (char_length(explanation) <= 300),
  status public.linkedin_rewrite_status not null default 'suggested',
  prompt_version text not null check (char_length(prompt_version) <= 20),
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  check (status = 'suggested' or resolved_at is not null)
);

alter table public.linkedin_experience_bullet_rewrites enable row level security;

create policy "Users manage their own LinkedIn experience bullet rewrites"
  on public.linkedin_experience_bullet_rewrites for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index linkedin_experience_bullet_rewrites_bullet_id_idx on public.linkedin_experience_bullet_rewrites (bullet_id);
create index linkedin_experience_bullet_rewrites_user_id_idx on public.linkedin_experience_bullet_rewrites (user_id);
