-- Turns `cover_letters` (migration 0037: one immutable row per
-- generation) into a *document container* — same restructuring
-- `cvs`/`cv_versions` already model (migration 0024): the container
-- holds identity (which job this letter is for), a new
-- `cover_letter_versions` table holds every substantive, editable
-- attribute (tone, length, content's source CV) as independent
-- snapshots, and a new `cover_letter_paragraphs` table holds the actual
-- paragraph rows — many per version, individually editable, exactly the
-- `cv_experience` shape. Safe to restructure outright — no live project
-- connected yet this session, so there is no real data to migrate (same
-- justification migration 0031 used for its own schema rebuild).
--
-- What this enables: autosave-with-history editing of a generated
-- letter (ensureHistorySnapshot, ported to this table), per-paragraph
-- AI regenerate with Accept/Reject (cover_letter_paragraph_rewrites,
-- the same suggested/accepted/rejected shape as ats_rewrites), and
-- tone/length controls that apply to future regenerations without
-- discarding the paragraphs a user already wrote by hand.

-- ---------------------------------------------------------------------
-- cover_letters — now a container only; content moves to
-- cover_letter_versions/cover_letter_paragraphs below.
-- ---------------------------------------------------------------------

alter table public.cover_letters
  drop column cv_version_id,
  drop column cv_text_snapshot,
  drop column tone,
  drop column length,
  drop column content,
  drop column prompt_version,
  add column updated_at timestamptz not null default now();

create trigger set_cover_letters_updated_at
  before update on public.cover_letters
  for each row execute procedure public.set_updated_at();

-- ---------------------------------------------------------------------
-- cover_letter_versions
-- ---------------------------------------------------------------------

create table public.cover_letter_versions (
  id uuid primary key default gen_random_uuid(),
  cover_letter_id uuid not null references public.cover_letters (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  version_number integer not null check (version_number > 0),
  label text check (char_length(label) <= 200),
  is_current boolean not null default true,

  tone public.cover_letter_tone not null default 'formal',
  length public.cover_letter_length not null default 'standard',

  -- Input provenance, same reasoning as migration 0037's original
  -- columns: the CV keeps changing after a version is generated, so
  -- without an immutable snapshot a version's own paragraphs become
  -- unexplainable later. Nullable + on delete cascade, matching
  -- ats_scans.cv_version_id and the original cover_letters column
  -- exactly.
  cv_version_id uuid references public.cv_versions (id) on delete cascade,
  cv_text_snapshot text not null check (char_length(cv_text_snapshot) <= 12000),
  -- Which version of coverLetterPrompt produced this version's initial
  -- paragraphs — null for a version whose paragraphs came entirely from
  -- hand-editing rather than a fresh generation.
  prompt_version text check (char_length(prompt_version) <= 20),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_snapshotted_at timestamptz,
  unique (cover_letter_id, version_number)
);

alter table public.cover_letter_versions enable row level security;

create policy "Users manage their own cover letter versions"
  on public.cover_letter_versions for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index cover_letter_versions_cover_letter_id_idx on public.cover_letter_versions (cover_letter_id);
create index cover_letter_versions_user_id_idx on public.cover_letter_versions (user_id);
create index cover_letter_versions_cv_version_id_idx on public.cover_letter_versions (cv_version_id);

-- Exactly one current version per letter — identical invariant to
-- cv_versions_one_current_idx.
create unique index cover_letter_versions_one_current_idx
  on public.cover_letter_versions (cover_letter_id)
  where (is_current);

create trigger set_cover_letter_versions_updated_at
  before update on public.cover_letter_versions
  for each row execute procedure public.set_updated_at();

create function public.set_cover_letter_version_number()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.version_number is null then
    select coalesce(max(version_number), 0) + 1
    into new.version_number
    from public.cover_letter_versions
    where cover_letter_id = new.cover_letter_id;
  end if;
  return new;
end;
$$;

create trigger set_cover_letter_versions_version_number
  before insert on public.cover_letter_versions
  for each row execute procedure public.set_cover_letter_version_number();

-- Same "demote before insert/update, not after" reasoning as
-- demote_other_cv_versions — an AFTER trigger would collide with the
-- partial unique index on the incoming row itself.
create function public.demote_other_cover_letter_versions()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.is_current then
    update public.cover_letter_versions
    set is_current = false
    where cover_letter_id = new.cover_letter_id
      and id <> new.id
      and is_current;
  end if;
  return new;
end;
$$;

create trigger demote_other_cover_letter_versions_before_insert
  before insert on public.cover_letter_versions
  for each row execute procedure public.demote_other_cover_letter_versions();

create trigger demote_other_cover_letter_versions_before_update
  before update of is_current on public.cover_letter_versions
  for each row when (new.is_current) execute procedure public.demote_other_cover_letter_versions();

-- ---------------------------------------------------------------------
-- cover_letter_paragraphs — many rows per version, the editable body
-- ---------------------------------------------------------------------

create table public.cover_letter_paragraphs (
  id uuid primary key default gen_random_uuid(),
  version_id uuid not null references public.cover_letter_versions (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  content text not null check (char_length(content) <= 4000),
  display_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.cover_letter_paragraphs enable row level security;

create policy "Users manage their own cover letter paragraphs"
  on public.cover_letter_paragraphs for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index cover_letter_paragraphs_version_id_idx on public.cover_letter_paragraphs (version_id);
create index cover_letter_paragraphs_user_id_idx on public.cover_letter_paragraphs (user_id);

create trigger set_cover_letter_paragraphs_updated_at
  before update on public.cover_letter_paragraphs
  for each row execute procedure public.set_updated_at();

-- ---------------------------------------------------------------------
-- cover_letter_paragraph_rewrites — the "Regenerate" -> Accept/Reject
-- history for one paragraph, same suggested/accepted/rejected shape as
-- ats_rewrites (migration 0031).
-- ---------------------------------------------------------------------

create type public.cover_letter_rewrite_status as enum ('suggested', 'accepted', 'rejected');

create table public.cover_letter_paragraph_rewrites (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  paragraph_id uuid not null references public.cover_letter_paragraphs (id) on delete cascade,
  original_text text not null check (char_length(original_text) <= 4000),
  suggested_text text not null check (char_length(suggested_text) <= 4000),
  explanation text not null check (char_length(explanation) <= 300),
  status public.cover_letter_rewrite_status not null default 'suggested',
  prompt_version text not null check (char_length(prompt_version) <= 20),
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  check (status = 'suggested' or resolved_at is not null)
);

alter table public.cover_letter_paragraph_rewrites enable row level security;

create policy "Users manage their own cover letter paragraph rewrites"
  on public.cover_letter_paragraph_rewrites for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index cover_letter_paragraph_rewrites_paragraph_id_idx on public.cover_letter_paragraph_rewrites (paragraph_id);
create index cover_letter_paragraph_rewrites_user_id_idx on public.cover_letter_paragraph_rewrites (user_id);
