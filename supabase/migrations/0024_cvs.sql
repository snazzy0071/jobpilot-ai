-- CV builder schema: `cvs` (one container per CV a user creates),
-- `cv_versions` (revisions of a cv — "duplicate & tailor for this job",
-- or a new version produced by an AI rewrite, without losing the
-- original), and normalized section tables holding the actual structured
-- content of a version. Sections belong to a *version*, not the cv
-- directly, so every version is a real, independent, fully structured
-- snapshot — comparing two versions or reverting to an older one never
-- needs to reconstruct anything from a diff or a jsonb blob.
--
-- Every table denormalizes `user_id` (rather than requiring a join
-- through cv_versions -> cvs to find the owner) — same reasoning as
-- `subscription_usage` in migration 0015: simpler, faster RLS policies,
-- and the value can never drift from the parent's owner since every
-- insert path in this app sets it from the authenticated user directly.
--
-- Unlike the billing tables (service-role-only writes), a CV is
-- self-service content the owning user creates, edits, and deletes
-- directly — so every table here grants full CRUD to its owner via a
-- single `for all` policy, not just `select`.

-- ---------------------------------------------------------------------
-- cvs
-- ---------------------------------------------------------------------

create table public.cvs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null default 'Untitled CV' check (char_length(title) <= 200),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.cvs enable row level security;

create policy "Users manage their own CVs"
  on public.cvs for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index cvs_user_id_idx on public.cvs (user_id);

create trigger set_cvs_updated_at
  before update on public.cvs
  for each row execute procedure public.set_updated_at();

-- ---------------------------------------------------------------------
-- cv_versions
-- ---------------------------------------------------------------------

create table public.cv_versions (
  id uuid primary key default gen_random_uuid(),
  cv_id uuid not null references public.cvs (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  version_number integer not null check (version_number > 0),
  label text check (char_length(label) <= 200),
  is_current boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (cv_id, version_number)
);

alter table public.cv_versions enable row level security;

create policy "Users manage their own CV versions"
  on public.cv_versions for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index cv_versions_cv_id_idx on public.cv_versions (cv_id);
create index cv_versions_user_id_idx on public.cv_versions (user_id);

-- Exactly one current version per cv — the "revert to this version" /
-- "this is the one shown in the builder" flag.
create unique index cv_versions_one_current_idx
  on public.cv_versions (cv_id)
  where (is_current);

create trigger set_cv_versions_updated_at
  before update on public.cv_versions
  for each row execute procedure public.set_updated_at();

-- Auto-assigns the next version_number for a cv when the caller doesn't
-- supply one, instead of every insert site having to compute
-- max(version_number)+1 itself and risk getting it wrong.
create function public.set_cv_version_number()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.version_number is null then
    select coalesce(max(version_number), 0) + 1
    into new.version_number
    from public.cv_versions
    where cv_id = new.cv_id;
  end if;
  return new;
end;
$$;

create trigger set_cv_versions_version_number
  before insert on public.cv_versions
  for each row execute procedure public.set_cv_version_number();

-- Demotes any other current version for the same cv *before* the new row
-- is written, so the partial unique index above never sees two current
-- rows at once (a naive AFTER trigger would collide with that index on
-- the incoming INSERT/UPDATE itself, since demotion would happen too
-- late) — same "enforce the invariant in the database, not just in app
-- code" reasoning as 0020's atomic usage consumption.
create function public.demote_other_cv_versions()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.is_current then
    update public.cv_versions
    set is_current = false
    where cv_id = new.cv_id
      and id <> new.id
      and is_current;
  end if;
  return new;
end;
$$;

create trigger demote_other_cv_versions_before_insert
  before insert on public.cv_versions
  for each row execute procedure public.demote_other_cv_versions();

create trigger demote_other_cv_versions_before_update
  before update of is_current on public.cv_versions
  for each row when (new.is_current) execute procedure public.demote_other_cv_versions();

-- ---------------------------------------------------------------------
-- cv_personal — one row per version (name, contact details, links)
-- ---------------------------------------------------------------------

create table public.cv_personal (
  id uuid primary key default gen_random_uuid(),
  cv_version_id uuid not null references public.cv_versions (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  full_name text not null check (char_length(full_name) <= 200),
  headline text check (char_length(headline) <= 200),
  email text check (email is null or email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  phone text check (char_length(phone) <= 40),
  location text check (char_length(location) <= 200),
  website_url text check (website_url is null or (char_length(website_url) <= 500 and website_url ~* '^https?://')),
  linkedin_url text check (linkedin_url is null or (char_length(linkedin_url) <= 500 and linkedin_url ~* '^https?://')),
  portfolio_url text check (portfolio_url is null or (char_length(portfolio_url) <= 500 and portfolio_url ~* '^https?://')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (cv_version_id)
);

alter table public.cv_personal enable row level security;

create policy "Users manage their own CV personal details"
  on public.cv_personal for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index cv_personal_cv_version_id_idx on public.cv_personal (cv_version_id);
create index cv_personal_user_id_idx on public.cv_personal (user_id);

create trigger set_cv_personal_updated_at
  before update on public.cv_personal
  for each row execute procedure public.set_updated_at();

-- ---------------------------------------------------------------------
-- cv_summary — one row per version (professional summary / objective)
-- ---------------------------------------------------------------------

create table public.cv_summary (
  id uuid primary key default gen_random_uuid(),
  cv_version_id uuid not null references public.cv_versions (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  content text not null default '' check (char_length(content) <= 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (cv_version_id)
);

alter table public.cv_summary enable row level security;

create policy "Users manage their own CV summary"
  on public.cv_summary for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index cv_summary_cv_version_id_idx on public.cv_summary (cv_version_id);
create index cv_summary_user_id_idx on public.cv_summary (user_id);

create trigger set_cv_summary_updated_at
  before update on public.cv_summary
  for each row execute procedure public.set_updated_at();

-- ---------------------------------------------------------------------
-- cv_experience — many rows per version
-- ---------------------------------------------------------------------

create table public.cv_experience (
  id uuid primary key default gen_random_uuid(),
  cv_version_id uuid not null references public.cv_versions (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  job_title text not null check (char_length(job_title) <= 200),
  employer text not null check (char_length(employer) <= 200),
  location text check (char_length(location) <= 200),
  start_date date not null,
  end_date date,
  is_current boolean not null default false,
  description text check (char_length(description) <= 4000),
  display_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (is_current = false or end_date is null),
  check (end_date is null or end_date >= start_date)
);

alter table public.cv_experience enable row level security;

create policy "Users manage their own CV experience entries"
  on public.cv_experience for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index cv_experience_cv_version_id_idx on public.cv_experience (cv_version_id);
create index cv_experience_user_id_idx on public.cv_experience (user_id);

create trigger set_cv_experience_updated_at
  before update on public.cv_experience
  for each row execute procedure public.set_updated_at();

-- ---------------------------------------------------------------------
-- cv_education — many rows per version
-- ---------------------------------------------------------------------

create table public.cv_education (
  id uuid primary key default gen_random_uuid(),
  cv_version_id uuid not null references public.cv_versions (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  institution text not null check (char_length(institution) <= 200),
  qualification text not null check (char_length(qualification) <= 200),
  field_of_study text check (char_length(field_of_study) <= 200),
  location text check (char_length(location) <= 200),
  start_date date,
  end_date date,
  is_current boolean not null default false,
  grade text check (char_length(grade) <= 100),
  description text check (char_length(description) <= 2000),
  display_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (is_current = false or end_date is null),
  check (start_date is null or end_date is null or end_date >= start_date)
);

alter table public.cv_education enable row level security;

create policy "Users manage their own CV education entries"
  on public.cv_education for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index cv_education_cv_version_id_idx on public.cv_education (cv_version_id);
create index cv_education_user_id_idx on public.cv_education (user_id);

create trigger set_cv_education_updated_at
  before update on public.cv_education
  for each row execute procedure public.set_updated_at();

-- ---------------------------------------------------------------------
-- cv_skills — many rows per version
-- ---------------------------------------------------------------------

create table public.cv_skills (
  id uuid primary key default gen_random_uuid(),
  cv_version_id uuid not null references public.cv_versions (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null check (char_length(name) <= 100),
  -- Free-text grouping (e.g. "Programming Languages", "Tools") rather than
  -- a fixed enum — how people group skills varies too much by discipline
  -- to usefully constrain.
  category text check (char_length(category) <= 100),
  display_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (cv_version_id, name)
);

alter table public.cv_skills enable row level security;

create policy "Users manage their own CV skills"
  on public.cv_skills for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index cv_skills_cv_version_id_idx on public.cv_skills (cv_version_id);
create index cv_skills_user_id_idx on public.cv_skills (user_id);

create trigger set_cv_skills_updated_at
  before update on public.cv_skills
  for each row execute procedure public.set_updated_at();

-- ---------------------------------------------------------------------
-- cv_projects — many rows per version
-- ---------------------------------------------------------------------

create table public.cv_projects (
  id uuid primary key default gen_random_uuid(),
  cv_version_id uuid not null references public.cv_versions (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null check (char_length(name) <= 200),
  description text check (char_length(description) <= 2000),
  url text check (url is null or (char_length(url) <= 500 and url ~* '^https?://')),
  technologies text[] not null default '{}',
  start_date date,
  end_date date,
  is_ongoing boolean not null default false,
  display_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (cardinality(technologies) <= 30),
  check (is_ongoing = false or end_date is null),
  check (start_date is null or end_date is null or end_date >= start_date)
);

alter table public.cv_projects enable row level security;

create policy "Users manage their own CV projects"
  on public.cv_projects for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index cv_projects_cv_version_id_idx on public.cv_projects (cv_version_id);
create index cv_projects_user_id_idx on public.cv_projects (user_id);

create trigger set_cv_projects_updated_at
  before update on public.cv_projects
  for each row execute procedure public.set_updated_at();

-- ---------------------------------------------------------------------
-- cv_certifications — many rows per version
-- ---------------------------------------------------------------------

create table public.cv_certifications (
  id uuid primary key default gen_random_uuid(),
  cv_version_id uuid not null references public.cv_versions (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null check (char_length(name) <= 200),
  issuing_organization text not null check (char_length(issuing_organization) <= 200),
  issue_date date,
  expiry_date date,
  credential_id text check (char_length(credential_id) <= 200),
  credential_url text check (credential_url is null or (char_length(credential_url) <= 500 and credential_url ~* '^https?://')),
  display_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (issue_date is null or expiry_date is null or expiry_date >= issue_date)
);

alter table public.cv_certifications enable row level security;

create policy "Users manage their own CV certifications"
  on public.cv_certifications for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index cv_certifications_cv_version_id_idx on public.cv_certifications (cv_version_id);
create index cv_certifications_user_id_idx on public.cv_certifications (user_id);

create trigger set_cv_certifications_updated_at
  before update on public.cv_certifications
  for each row execute procedure public.set_updated_at();

-- ---------------------------------------------------------------------
-- cv_languages — many rows per version
-- ---------------------------------------------------------------------

create type public.cv_language_proficiency as enum (
  'basic',
  'conversational',
  'professional',
  'fluent',
  'native'
);

create table public.cv_languages (
  id uuid primary key default gen_random_uuid(),
  cv_version_id uuid not null references public.cv_versions (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null check (char_length(name) <= 100),
  proficiency public.cv_language_proficiency not null default 'conversational',
  display_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (cv_version_id, name)
);

alter table public.cv_languages enable row level security;

create policy "Users manage their own CV languages"
  on public.cv_languages for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index cv_languages_cv_version_id_idx on public.cv_languages (cv_version_id);
create index cv_languages_user_id_idx on public.cv_languages (user_id);

create trigger set_cv_languages_updated_at
  before update on public.cv_languages
  for each row execute procedure public.set_updated_at();
