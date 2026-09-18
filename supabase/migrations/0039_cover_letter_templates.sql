-- Adds visual template choice to a cover letter — same shape as
-- cvs.template (migration 0028/0029): a plain text column, no DB-level
-- enum/FK, validated against the real catalog at the Zod layer
-- (src/config/cover-letter-templates.ts) rather than duplicated here.
-- Lives on the container (cover_letters), not per-version, matching
-- cvs.template exactly — template is a presentation choice for the
-- whole letter, independent of which version's content is current.

alter table public.cover_letters
  add column template text not null default 'classic-serif';
