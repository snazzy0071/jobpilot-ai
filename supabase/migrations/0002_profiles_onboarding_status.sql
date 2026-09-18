-- Adds onboarding tracking to profiles, plus a reusable trigger that
-- keeps `updated_at` columns honest on every UPDATE (profiles' own
-- `updated_at` has been a dead column until now — it was never bumped).

create type public.onboarding_status as enum ('not_started', 'in_progress', 'completed');

alter table public.profiles
  add column onboarding_status public.onboarding_status not null default 'not_started';

create function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger set_profiles_updated_at
  before update on public.profiles
  for each row execute procedure public.set_updated_at();
