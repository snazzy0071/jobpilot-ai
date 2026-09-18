-- Signup collects date of birth for the under-13 age gate. Nullable like
-- `full_name`: enforced by the signup form, not a DB constraint, so
-- existing rows created before this column aren't broken.

alter table public.profiles
  add column date_of_birth date;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name, date_of_birth)
  values (
    new.id,
    new.raw_user_meta_data ->> 'full_name',
    (new.raw_user_meta_data ->> 'date_of_birth')::date
  );

  insert into public.user_preferences (id)
  values (new.id);

  return new;
end;
$$;
