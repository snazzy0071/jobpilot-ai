-- Cover Letter Generator (src/lib/cover-letters/, cover_letter_generator
-- FeatureKey) — one row per generated letter, append-only, same
-- philosophy as ats_scans (migration 0031): "history" isn't a separate
-- table, it's just never overwriting a prior row. Generating again with
-- a different tone/length/job is a new row, not an edit.

create type public.cover_letter_tone as enum ('formal', 'conversational');
create type public.cover_letter_length as enum ('concise', 'standard', 'detailed');

create table public.cover_letters (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,

  -- Input provenance, same reasoning as ats_scans.cv_version_id/
  -- cv_text_snapshot: the CV keeps changing after a letter is generated,
  -- so without an immutable snapshot the letter's own content becomes
  -- unexplainable later. Nullable + on delete cascade, matching that
  -- table exactly, even though every row this app writes always
  -- populates it (the create flow always requires choosing a CV).
  cv_version_id uuid references public.cv_versions (id) on delete cascade,
  cv_text_snapshot text not null check (char_length(cv_text_snapshot) <= 12000),

  company_name text not null check (char_length(company_name) between 1 and 200),
  job_title text not null check (char_length(job_title) between 1 and 200),
  job_description text not null check (char_length(job_description) between 1 and 20000),

  tone public.cover_letter_tone not null default 'formal',
  length public.cover_letter_length not null default 'standard',

  -- Plain prose, not jsonb — src/lib/ai/prompts/cover-letter.ts's own
  -- doc comment explains why this prompt has no structured schema: a
  -- cover letter is body text a person reads and edits further, not
  -- data a UI renders field-by-field.
  content text not null check (char_length(content) <= 8000),

  -- Which version of coverLetterPrompt produced this — same
  -- traceability convention as ats_scans.prompt_version.
  prompt_version text not null check (char_length(prompt_version) <= 20),

  created_at timestamptz not null default now()
);

alter table public.cover_letters enable row level security;

create policy "Users manage their own cover letters"
  on public.cover_letters for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index cover_letters_user_id_idx on public.cover_letters (user_id, created_at desc);
create index cover_letters_cv_version_id_idx on public.cover_letters (cv_version_id);
