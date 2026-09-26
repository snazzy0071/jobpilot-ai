-- Employer/scheme assessment mapping. A scheme can have several assessments of nine kinds (situational judgement, numerical,
-- verbal, Watson-Glaser-style critical thinking, HireVue-style video interview, HackerRank-style coding test, case interview,
-- assessment centre, other). Each mapping row carries ITS OWN source evidence (url, source date, verified date), because "this
-- scheme uses a numerical test" is a factual claim that must be traceable — and re-checkable — on its own.
--
-- This replaces the coarse `graduate_schemes.assessments` text[] from 0111 as the source of truth (that column is left in place,
-- unused, because migrations are forward-only; its values are copied below using the scheme's own source as evidence).

create table public.graduate_scheme_assessments (
  id uuid primary key default gen_random_uuid(),
  scheme_id uuid not null references public.graduate_schemes (id) on delete cascade,

  assessment_type text not null
    check (assessment_type in ('sjt', 'numerical', 'verbal', 'watson_glaser', 'hirevue', 'hackerrank', 'case_interview', 'assessment_centre', 'other')),
  -- What an "other" assessment is called (required for it, optional detail for the rest).
  label text check (char_length(label) between 1 and 100),
  -- The test provider/platform, ONLY when the source names it (e.g. the employer's page says which platform it uses).
  provider text check (char_length(provider) between 1 and 100),
  notes text check (char_length(notes) <= 1000),
  -- Required for every applicant, or only "may include"/"for some routes".
  is_required boolean not null default true,
  display_order integer not null default 0 check (display_order >= 0),

  source_url text not null check (char_length(source_url) <= 2000 and source_url ~* '^https?://'),
  source_date date not null,
  verified_at date not null,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  check (verified_at >= source_date),
  check (assessment_type <> 'other' or label is not null)
);

-- One row per (scheme, kind, label): a scheme may have two distinct "other" assessments, but not the same one twice.
create unique index graduate_scheme_assessments_unique
  on public.graduate_scheme_assessments (scheme_id, assessment_type, coalesce(label, ''));
create index graduate_scheme_assessments_type_idx on public.graduate_scheme_assessments (assessment_type);

create trigger set_graduate_scheme_assessments_updated_at
  before update on public.graduate_scheme_assessments
  for each row execute procedure public.set_updated_at();

alter table public.graduate_scheme_assessments enable row level security;

-- Public reads follow the parent scheme: published schemes' mappings only (admins see everything, drafts included).
create policy "Anyone can view assessments of published schemes"
  on public.graduate_scheme_assessments for select
  using (
    exists (select 1 from public.graduate_schemes s where s.id = scheme_id and s.is_published)
    or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
  );

create policy "Admins can insert graduate scheme assessments"
  on public.graduate_scheme_assessments for insert
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));

create policy "Admins can update graduate scheme assessments"
  on public.graduate_scheme_assessments for update
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));

create policy "Admins can delete graduate scheme assessments"
  on public.graduate_scheme_assessments for delete
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));

-- Carry over anything already recorded in the old column, with the scheme's own source as its evidence. Kinds that don't have
-- a category of their own become "other" with a readable label (no provider is ever assumed).
insert into public.graduate_scheme_assessments (scheme_id, assessment_type, label, is_required, source_url, source_date, verified_at, display_order)
select s.id,
       case a.value
         when 'numerical_test' then 'numerical'
         when 'verbal_test' then 'verbal'
         when 'situational_judgement' then 'sjt'
         when 'case_study' then 'case_interview'
         when 'assessment_centre' then 'assessment_centre'
         else 'other'
       end,
       case a.value
         when 'numerical_test' then null
         when 'verbal_test' then null
         when 'situational_judgement' then null
         when 'case_study' then null
         when 'assessment_centre' then null
         when 'online_application' then 'Online application'
         when 'cv_screening' then 'CV screening'
         when 'logical_test' then 'Logical / diagrammatic test'
         when 'personality_questionnaire' then 'Personality questionnaire'
         when 'video_interview' then 'Video interview'
         when 'phone_interview' then 'Phone interview'
         when 'group_exercise' then 'Group exercise'
         when 'presentation' then 'Presentation'
         when 'final_interview' then 'Final interview'
         else 'Other stage'
       end,
       true, s.source_url, s.source_date, s.verified_at, a.ordinality::integer
from public.graduate_schemes s
cross join lateral unnest(s.assessments) with ordinality as a(value, ordinality)
on conflict do nothing;

comment on column public.graduate_schemes.assessments is 'Deprecated by 0112: use graduate_scheme_assessments (per-assessment evidence).';
