-- A row that hangs off a CV version (a CV section, an ATS scan, a rewrite, a cover letter) carried its own `user_id` and RLS checked
-- only that column, never that the CV version it points at belongs to the same person. Anyone who learned another user's (random)
-- version id could therefore attach rows of their own to that CV's version. The trigger below makes the database refuse it: on every
-- insert or update the referenced CV version must belong to the row's user. The same rule for `cv_versions.cv_id` -> `cvs.user_id`.
-- Applied only to tables that really have both columns, so it is safe to re-run and to extend.

create or replace function public.enforce_cv_version_owner()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.cv_version_id is not null
     and not exists (select 1 from public.cv_versions v where v.id = new.cv_version_id and v.user_id = new.user_id) then
    raise exception 'That CV version does not belong to this user.' using errcode = '42501';
  end if;
  return new;
end;
$$;

create or replace function public.enforce_cv_owner()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.cv_id is not null
     and not exists (select 1 from public.cvs c where c.id = new.cv_id and c.user_id = new.user_id) then
    raise exception 'That CV does not belong to this user.' using errcode = '42501';
  end if;
  return new;
end;
$$;

revoke execute on function public.enforce_cv_version_owner() from public, anon, authenticated;
revoke execute on function public.enforce_cv_owner() from public, anon, authenticated;

do $$
declare
  t text;
begin
  foreach t in array array[
    'cv_personal', 'cv_summary', 'cv_experience', 'cv_education', 'cv_skills', 'cv_projects', 'cv_certifications',
    'cv_languages', 'cv_custom_sections', 'cv_ats_scans', 'ats_scans', 'ats_rewrites', 'cover_letters', 'cover_letter_versions'
  ] loop
    if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = t and column_name = 'cv_version_id')
       and exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = t and column_name = 'user_id') then
      execute format('drop trigger if exists enforce_cv_version_owner on public.%I', t);
      execute format('create trigger enforce_cv_version_owner before insert or update of cv_version_id, user_id on public.%I for each row execute function public.enforce_cv_version_owner()', t);
    end if;
  end loop;

  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'cv_versions' and column_name = 'cv_id')
     and exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'cv_versions' and column_name = 'user_id') then
    drop trigger if exists enforce_cv_owner on public.cv_versions;
    create trigger enforce_cv_owner before insert or update of cv_id, user_id on public.cv_versions for each row execute function public.enforce_cv_owner();
  end if;
end;
$$;
