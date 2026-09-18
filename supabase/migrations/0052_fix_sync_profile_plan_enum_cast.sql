-- Fixes a real bug in sync_profile_plan_from_subscription() (0015_billing.sql)
-- that has been breaking every new signup: its `case when ... then
-- 'free' else 'paid' end` expression is untyped string literals, which
-- Postgres resolves to `text` — and `profiles.plan` is the custom enum
-- `public.plan`, which Postgres will not implicitly cast a `text` value
-- into. This trigger fires on every insert into `subscriptions`,
-- including the one handle_new_user() itself does for every brand-new
-- signup, so the failure aborts the *entire* new-user transaction
-- (profile, preferences, subscription, billing event — none of it),
-- surfacing to the client as Supabase Auth's generic "Database error
-- creating new user".
--
-- Confirmed directly, not guessed: reproducing a plain
-- `insert into auth.users (...)` in the SQL editor throws exactly
--   ERROR: 42804: column "plan" is of type public.plan but expression is of type text
--   CONTEXT: PL/pgSQL function public.sync_profile_plan_from_subscription() line 3
-- i.e. the same call chain (handle_new_user -> insert into subscriptions
-- -> this trigger) this migration targets.
--
-- Fix: cast each branch to public.plan explicitly. CREATE OR REPLACE —
-- same name, same signature, same trigger already pointing at it — so
-- nothing else about this function or its trigger needs touching.

create or replace function public.sync_profile_plan_from_subscription()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  update public.profiles
  set plan = case
    when (select tier_order from public.plans where id = new.plan_id) = 0 then 'free'::public.plan
    else 'paid'::public.plan
  end
  where id = new.user_id;

  return new;
end;
$$;
