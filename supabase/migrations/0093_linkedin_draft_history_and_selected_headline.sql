-- LinkedIn Optimiser: recoverable history and a chosen headline.
--
-- Until now a draft's optimised text could only ever be replaced wholesale
-- (regenerate everything — the previous output was simply gone) or one
-- rewrite at a time via accept/reject. There was no way to edit the About
-- text or a bullet by hand, no way to say which of the 3 headline variants
-- you're actually going with, and no way back from a regenerate you didn't
-- like.
--
-- selected_headline: the headline the user chose (a variant, or one they
-- then edited). Null until they choose one. The "after" keyword score is
-- computed against this — not against all three variants at once, which
-- credited a keyword that only appears in a variant nobody is using.
--
-- linkedin_draft_versions: point-in-time snapshots of a draft's whole
-- editable state (input text, optimised text, bullets, keyword list),
-- taken before anything overwrites it (regenerate, restore) and as a
-- throttled checkpoint before autosaved edits, the same recoverable-
-- history model as cv_versions / cover_letter_versions. A draft has no
-- "current version" row — the draft itself is the current state — so a
-- version here is always a past state.

alter table public.linkedin_profile_drafts
  add column selected_headline text check (char_length(selected_headline) <= 220),
  add column last_snapshotted_at timestamptz;

create table public.linkedin_draft_versions (
  id uuid primary key default gen_random_uuid(),
  draft_id uuid not null references public.linkedin_profile_drafts (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  label text not null check (char_length(label) between 1 and 200),
  snapshot jsonb not null,
  created_at timestamptz not null default now()
);

alter table public.linkedin_draft_versions enable row level security;

create policy "Users manage their own LinkedIn draft versions"
  on public.linkedin_draft_versions for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index linkedin_draft_versions_draft_idx on public.linkedin_draft_versions (draft_id, created_at desc);
