-- Separate from 0088 on purpose: Postgres refuses to let a newly added
-- enum value be *used* — including in a column default or an UPDATE —
-- within the transaction that added it, and each migration file runs in
-- its own transaction. Same split as 0028 / 0029.

-- New CVs default to the most broadly suitable, single-column design.
alter table public.cvs alter column template set default 'northlight';

-- Remap every existing CV off the previous `<layout>-<theme>` values onto
-- the closest new design (same structure and tone where one exists), so no
-- CV is left pointing at a template the app no longer offers. The
-- retired 3-value placeholders ('classic'/'modern'/'minimal') were already
-- remapped by 0029; they're included again defensively for any row
-- written since.
update public.cvs set template = case template::text
  -- single column
  when 'single-ink' then 'oxford'
  when 'single-slate' then 'northlight'
  when 'single-forest' then 'lakeland'
  when 'single-navy' then 'cambridge'
  when 'single-sand' then 'springboard'
  when 'single-mono' then 'paper'
  -- left sidebar
  when 'sidebar-ink' then 'chairman'
  when 'sidebar-slate' then 'meridian'
  when 'sidebar-forest' then 'campus'
  when 'sidebar-navy' then 'kernel'
  when 'sidebar-sand' then 'atlas'
  when 'sidebar-mono' then 'index'
  -- header band
  when 'band-ink' then 'sovereign'
  when 'band-slate' then 'halo'
  when 'band-forest' then 'fresher'
  when 'band-navy' then 'boardroom'
  when 'band-sand' then 'studio'
  when 'band-mono' then 'terminal'
  -- compact
  when 'compact-ink' then 'whitehall'
  when 'compact-slate' then 'syntax'
  when 'compact-forest' then 'quiet'
  when 'compact-navy' then 'boardroom'
  when 'compact-sand' then 'quiet'
  when 'compact-mono' then 'vector'
  -- retired placeholders
  when 'classic' then 'oxford'
  when 'modern' then 'meridian'
  when 'minimal' then 'paper'
end::public.cv_template
where template::text in (
  'single-ink', 'single-slate', 'single-forest', 'single-navy', 'single-sand', 'single-mono',
  'sidebar-ink', 'sidebar-slate', 'sidebar-forest', 'sidebar-navy', 'sidebar-sand', 'sidebar-mono',
  'band-ink', 'band-slate', 'band-forest', 'band-navy', 'band-sand', 'band-mono',
  'compact-ink', 'compact-slate', 'compact-forest', 'compact-navy', 'compact-sand', 'compact-mono',
  'classic', 'modern', 'minimal'
);
