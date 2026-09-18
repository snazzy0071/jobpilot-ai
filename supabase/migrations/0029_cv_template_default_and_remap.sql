-- Separate from 0028 on purpose: Postgres refuses to let a newly added
-- enum value (`ALTER TYPE ... ADD VALUE`) be *used* — including in a
-- column default or an UPDATE — within the same transaction it was
-- added in. Each migration file runs in its own transaction, so this
-- has to be its own file, applied after 0028 has committed.

-- New CVs now default into the real catalog instead of a retired
-- placeholder.
alter table public.cvs alter column template set default 'single-ink';

-- Remap any existing CVs off the three retired placeholder values onto
-- a real equivalent from the new catalog, so no CV is left pointing at
-- a template the app no longer offers as a choice.
update public.cvs set template = 'single-ink' where template = 'classic';
update public.cvs set template = 'sidebar-slate' where template = 'modern';
update public.cvs set template = 'single-mono' where template = 'minimal';
