-- Applications to the Campus Crew (student ambassador) programme, from the public /campus-crew form. Same pattern as the other public
-- lead tables after migration 0124: RLS is on with NO policy for anon or authenticated, so nothing can read or write it through the
-- API; the form's Server Action inserts with the service role after its rate limit and validation, and admins read it in /admin/leads.

create table public.campus_crew_applications (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 200),
  email text not null check (char_length(email) <= 254 and email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  university text not null check (char_length(university) between 1 and 200),
  course text check (course is null or char_length(course) between 1 and 200),
  study_year text check (study_year is null or char_length(study_year) between 1 and 50),
  motivation text not null check (char_length(motivation) between 10 and 3000),
  reach text check (reach is null or char_length(reach) between 1 and 1000),
  created_at timestamptz not null default now()
);

alter table public.campus_crew_applications enable row level security;

create index campus_crew_applications_created_at_idx on public.campus_crew_applications (created_at desc);
create index campus_crew_applications_email_idx on public.campus_crew_applications (email);

comment on table public.campus_crew_applications is
  'Public Campus Crew applications. No RLS policies on purpose: written by the form Server Action (service role), read only by admin tooling. Personal data keyed by email: included in the account export and erased with the account.';
