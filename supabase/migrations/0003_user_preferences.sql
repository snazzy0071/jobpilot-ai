-- Career-search preferences collected during onboarding, kept separate
-- from `profiles` (identity/account) since these are edited repeatedly
-- and unrelated to auth/role concerns.

create type public.visa_sponsorship_preference as enum ('required', 'not_required', 'unsure');

create table public.user_preferences (
  id uuid primary key references auth.users (id) on delete cascade,
  target_role text check (char_length(target_role) <= 200),
  location text check (char_length(location) <= 200),
  graduation_year smallint check (graduation_year between 1950 and 2100),
  visa_sponsorship_preference public.visa_sponsorship_preference,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.user_preferences enable row level security;

create policy "Users can view their own preferences"
  on public.user_preferences for select
  using (auth.uid() = id);

create policy "Users can update their own preferences"
  on public.user_preferences for update
  using (auth.uid() = id);

create trigger set_user_preferences_updated_at
  before update on public.user_preferences
  for each row execute procedure public.set_updated_at();

-- Extend the new-user trigger to also seed an empty preferences row,
-- so every user has exactly one of each — no client-side insert policy
-- needed on either table.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, new.raw_user_meta_data ->> 'full_name');

  insert into public.user_preferences (id)
  values (new.id);

  return new;
end;
$$;
