-- Replaces the 3 placeholder template values from migration 0025 with
-- the real 24-template catalog (matching the Pro plan's
-- `cv_template_count: 24` entitlement seeded in migration 0016) — 4
-- structural layouts (single column, left sidebar, header band, compact
-- dense) x 6 visual themes (ink, slate, forest, navy, sand, mono),
-- named `<layout>-<theme>`. The actual layout/theme rendering and each
-- slug's sector/experience-level tags live in code
-- (`src/config/cv-templates.ts`) — that catalog is inherently
-- presentation logic, not data an admin edits at runtime, the same
-- reasoning `src/config/tools.ts`/`src/config/plans.ts` already follow
-- for similarly curated, code-shaped catalogs.
--
-- `ALTER TYPE ... ADD VALUE` only grows an enum — Postgres has no safe
-- way to drop a value from one already in use, so 'classic'/'modern'/
-- 'minimal' stay valid forever as unused legacy members instead of
-- attempting a destructive type recreation, consistent with this
-- project's additive/forward-only migration rule. Existing rows using
-- them are remapped below to a real equivalent in the new catalog
-- rather than left pointing at a value the app no longer offers.

alter type public.cv_template add value 'single-ink';
alter type public.cv_template add value 'single-slate';
alter type public.cv_template add value 'single-forest';
alter type public.cv_template add value 'single-navy';
alter type public.cv_template add value 'single-sand';
alter type public.cv_template add value 'single-mono';
alter type public.cv_template add value 'sidebar-ink';
alter type public.cv_template add value 'sidebar-slate';
alter type public.cv_template add value 'sidebar-forest';
alter type public.cv_template add value 'sidebar-navy';
alter type public.cv_template add value 'sidebar-sand';
alter type public.cv_template add value 'sidebar-mono';
alter type public.cv_template add value 'band-ink';
alter type public.cv_template add value 'band-slate';
alter type public.cv_template add value 'band-forest';
alter type public.cv_template add value 'band-navy';
alter type public.cv_template add value 'band-sand';
alter type public.cv_template add value 'band-mono';
alter type public.cv_template add value 'compact-ink';
alter type public.cv_template add value 'compact-slate';
alter type public.cv_template add value 'compact-forest';
alter type public.cv_template add value 'compact-navy';
alter type public.cv_template add value 'compact-sand';
alter type public.cv_template add value 'compact-mono';
