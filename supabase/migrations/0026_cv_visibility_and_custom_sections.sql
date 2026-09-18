-- Per-entry visibility for the CV's optional, "curate what shows on this
-- version" sections — skills/projects/certifications/languages, plus a
-- brand-new `cv_custom_sections` table for anything not covered by a
-- built-in section (Volunteering, Publications, Awards, References,
-- ...). `is_visible` lets a user keep an entry on record (for their own
-- reference, or to bring back later) without it appearing wherever this
-- version's CV is actually rendered — deleting stays a separate, real
-- action from hiding.
--
-- Deliberately per-row, not a single "hide this whole section" flag:
-- there's no separate row representing "the skills section" as an
-- entity to attach that flag to, and a section with every row hidden
-- already reads as hidden wherever it's rendered — a second toggle
-- layer on top would just be two ways to reach the same state.
--
-- Personal/Summary/Experience/Education are not touched here — this
-- task named exactly Skills/Projects/Certifications/Languages/custom
-- sections, and those four are generally-expected CV content, not
-- optional-to-curate the way these are.

alter table public.cv_skills add column is_visible boolean not null default true;
alter table public.cv_projects add column is_visible boolean not null default true;
alter table public.cv_certifications add column is_visible boolean not null default true;
alter table public.cv_languages add column is_visible boolean not null default true;

-- ---------------------------------------------------------------------
-- cv_custom_sections — many rows per version, each a user-titled block
-- ---------------------------------------------------------------------

create table public.cv_custom_sections (
  id uuid primary key default gen_random_uuid(),
  cv_version_id uuid not null references public.cv_versions (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null check (char_length(title) <= 200),
  content text check (char_length(content) <= 4000),
  display_order integer not null default 0,
  is_visible boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.cv_custom_sections enable row level security;

create policy "Users manage their own CV custom sections"
  on public.cv_custom_sections for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index cv_custom_sections_cv_version_id_idx on public.cv_custom_sections (cv_version_id);
create index cv_custom_sections_user_id_idx on public.cv_custom_sections (user_id);

create trigger set_cv_custom_sections_updated_at
  before update on public.cv_custom_sections
  for each row execute procedure public.set_updated_at();
