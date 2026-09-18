-- Records newsletter opt-in given at signup, with a timestamp for GDPR
-- consent evidence (when consent was given, not just that it was).

alter table public.profiles
  add column newsletter_opt_in boolean not null default false,
  add column newsletter_opt_in_at timestamptz;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
declare
  v_newsletter_opt_in boolean := coalesce((new.raw_user_meta_data ->> 'newsletter_opt_in')::boolean, false);
begin
  insert into public.profiles (id, full_name, date_of_birth, newsletter_opt_in, newsletter_opt_in_at)
  values (
    new.id,
    new.raw_user_meta_data ->> 'full_name',
    (new.raw_user_meta_data ->> 'date_of_birth')::date,
    v_newsletter_opt_in,
    case when v_newsletter_opt_in then now() else null end
  );

  insert into public.user_preferences (id)
  values (new.id);

  return new;
end;
$$;
