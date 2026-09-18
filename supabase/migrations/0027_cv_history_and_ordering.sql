-- Backs three new editor capabilities: drag-reorder of the section
-- *blocks* themselves (not just the rows inside one section — migration
-- 0024's `display_order` already covers that), and throttled automatic
-- history snapshots so autosaved edits are recoverable.

-- Ordering of the section blocks (Personal, Summary, Experience, ...)
-- as they should be rendered in the editor/preview for this version.
-- An array of section keys rather than a join table — there are exactly
-- 9 known sections, this is display order only (nothing references a
-- row by position), and every version needs exactly one ordering, so a
-- single column is the honest shape for this, not a relational table.
alter table public.cv_versions
  add column section_order text[] not null default array[
    'personal', 'summary', 'experience', 'education',
    'skills', 'projects', 'certifications', 'languages', 'customSections'
  ]::text[];

-- When a version's content was last copied into a history snapshot.
-- Null means never. Read by the application before applying an
-- autosaved change: if this is null or old enough, a snapshot (a full
-- copy of the version's current content into a new, non-current
-- version — reusing the exact same copy routine `duplicateCv` already
-- uses) is taken first, then the edit proceeds on this version as
-- normal. Throttled this way instead of one snapshot per keystroke —
-- otherwise every autosave would flood cv_versions with near-duplicate
-- rows instead of producing meaningful, restorable checkpoints.
alter table public.cv_versions
  add column last_snapshotted_at timestamptz;
