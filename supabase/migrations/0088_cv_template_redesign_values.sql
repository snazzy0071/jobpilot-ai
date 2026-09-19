-- Rebuilds the 24-template CV library as 24 genuinely distinct designs
-- (typography, header, section headings, entry layout, skills, sidebar)
-- rather than 4 layouts x 6 colour themes. The slugs are new, so the
-- enum needs 24 new values; the design of each lives in code
-- (`src/config/cv-templates.ts` + `src/components/cvs/templates/
-- designs.ts`), same reasoning as migration 0028.
--
-- `ALTER TYPE ... ADD VALUE` only grows an enum — Postgres has no safe
-- way to drop a value from one already in use, so the previous
-- `<layout>-<theme>` values stay valid forever as unused legacy members
-- (consistent with this project's additive/forward-only migration rule).
-- The default and the remap of existing rows live in 0089: a newly added
-- enum value can't be *used* in the transaction that adds it.

alter type public.cv_template add value if not exists 'meridian';
alter type public.cv_template add value if not exists 'northlight';
alter type public.cv_template add value if not exists 'atlas';
alter type public.cv_template add value if not exists 'halo';
alter type public.cv_template add value if not exists 'oxford';
alter type public.cv_template add value if not exists 'cambridge';
alter type public.cv_template add value if not exists 'whitehall';
alter type public.cv_template add value if not exists 'lakeland';
alter type public.cv_template add value if not exists 'paper';
alter type public.cv_template add value if not exists 'quiet';
alter type public.cv_template add value if not exists 'index';
alter type public.cv_template add value if not exists 'sovereign';
alter type public.cv_template add value if not exists 'boardroom';
alter type public.cv_template add value if not exists 'chairman';
alter type public.cv_template add value if not exists 'campus';
alter type public.cv_template add value if not exists 'fresher';
alter type public.cv_template add value if not exists 'springboard';
alter type public.cv_template add value if not exists 'syntax';
alter type public.cv_template add value if not exists 'kernel';
alter type public.cv_template add value if not exists 'terminal';
alter type public.cv_template add value if not exists 'vector';
alter type public.cv_template add value if not exists 'studio';
alter type public.cv_template add value if not exists 'canvas';
alter type public.cv_template add value if not exists 'editorial';
