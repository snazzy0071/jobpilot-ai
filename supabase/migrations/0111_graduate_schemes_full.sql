-- Graduate schemes, full: public listing + detail pages need a stable slug, the application timeline (opening date,
-- deadline, rolling), who it is for (study stage), the selection process (assessments), a description and an apply link.
-- All additive. Nothing here invents data: every new column is nullable/optional and the table still holds only what an
-- admin has entered with a source (source_url / source_date / verified_at from 0056 stay required).

-- More sectors than the original five (values can only be added, never removed, so keep the set honest and general).
alter type public.graduate_scheme_sector add value if not exists 'accounting_and_audit';
alter type public.graduate_scheme_sector add value if not exists 'engineering_and_manufacturing';
alter type public.graduate_scheme_sector add value if not exists 'retail_and_consumer';
alter type public.graduate_scheme_sector add value if not exists 'healthcare_and_life_sciences';
alter type public.graduate_scheme_sector add value if not exists 'energy_and_utilities';
alter type public.graduate_scheme_sector add value if not exists 'property_and_construction';
alter type public.graduate_scheme_sector add value if not exists 'media_and_marketing';
alter type public.graduate_scheme_sector add value if not exists 'charity_and_education';
alter type public.graduate_scheme_sector add value if not exists 'other';

alter table public.graduate_schemes
  add column slug text,
  add column description text check (char_length(description) <= 4000),
  -- Who the scheme is open to. Controlled vocabulary (mirrored in src/lib/graduate-schemes/types.ts).
  add column study_stages text[] not null default '{}'
    check (study_stages <@ array['penultimate_year', 'final_year', 'graduate', 'postgraduate']::text[]),
  add column opens_on date,
  add column deadline_on date,
  -- Applications are reviewed as they arrive (a deadline may still exist as a final cut-off).
  add column is_rolling boolean not null default false,
  -- The selection stages the employer publishes. Controlled vocabulary, so filters and the test-prep tie-in are reliable.
  add column assessments text[] not null default '{}'
    check (assessments <@ array[
      'online_application', 'cv_screening', 'numerical_test', 'verbal_test', 'logical_test', 'situational_judgement',
      'personality_questionnaire', 'video_interview', 'phone_interview', 'case_study', 'group_exercise', 'presentation',
      'assessment_centre', 'final_interview', 'other'
    ]::text[]),
  add column assessment_notes text check (char_length(assessment_notes) <= 2000),
  add column application_url text check (application_url is null or (char_length(application_url) <= 2000 and application_url ~* '^https?://')),
  -- Annual GBP figures, only when the employer publishes numbers (the free-text `salary` stays the display value).
  add column salary_min integer check (salary_min is null or salary_min > 0),
  add column salary_max integer check (salary_max is null or salary_max > 0),
  -- Drafts are visible to admins only.
  add column is_published boolean not null default true,
  add constraint graduate_schemes_deadline_after_opening check (opens_on is null or deadline_on is null or deadline_on >= opens_on),
  add constraint graduate_schemes_salary_range check (salary_min is null or salary_max is null or salary_max >= salary_min),
  add constraint graduate_schemes_source_url_http check (source_url ~* '^https?://');

-- Slugs for any rows that already exist (there may be none): employer + scheme, lower-cased, non-alphanumerics to hyphens;
-- a numeric suffix keeps them unique. New rows get theirs from the app (src/lib/graduate-schemes/slug.ts).
with base as (
  select id,
         trim(both '-' from regexp_replace(lower(employer || ' ' || scheme_name), '[^a-z0-9]+', '-', 'g')) as s,
         row_number() over (
           partition by trim(both '-' from regexp_replace(lower(employer || ' ' || scheme_name), '[^a-z0-9]+', '-', 'g'))
           order by created_at, id
         ) as n
  from public.graduate_schemes
)
update public.graduate_schemes g
set slug = case when base.n = 1 then left(base.s, 200) else left(base.s, 190) || '-' || base.n end
from base
where g.id = base.id;

alter table public.graduate_schemes
  alter column slug set not null,
  add constraint graduate_schemes_slug_format check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) <= 200),
  add constraint graduate_schemes_slug_key unique (slug);

create index graduate_schemes_deadline_on_idx on public.graduate_schemes (deadline_on);
create index graduate_schemes_published_idx on public.graduate_schemes (is_published);

-- Public reads see published schemes only; admins (the same check the write policies use) also see drafts.
drop policy "Anyone can view graduate schemes" on public.graduate_schemes;
create policy "Anyone can view published graduate schemes"
  on public.graduate_schemes for select
  using (
    is_published
    or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
  );
