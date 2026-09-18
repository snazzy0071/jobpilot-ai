-- Real billing schema: plans (a catalog with configurable entitlements),
-- one current subscription per user, per-period metered usage, and an
-- audit log of billing lifecycle events. Extends migration 0009's minimal
-- `profiles.plan` (free/paid) rather than replacing it — exactly what
-- that migration's own comment said would happen once a real Billing
-- module existed. No Stripe integration yet, so `stripe_*` columns and
-- payment-related event types are here but unused until that's wired up.

create type public.subscription_status as enum (
  'trialing',
  'active',
  'past_due',
  'canceled',
  'incomplete'
);

create type public.billing_cycle as enum ('monthly', 'annual');

create type public.billing_event_type as enum (
  'subscription_created',
  'subscription_upgraded',
  'subscription_downgraded',
  'subscription_canceled',
  'subscription_reactivated',
  'payment_succeeded',
  'payment_failed',
  'trial_started',
  'trial_ended'
);

-- Catalog of purchasable plans. `entitlements` is the configurable part —
-- what a plan unlocks, as jsonb, editable with a plain UPDATE instead of
-- a migration. Shape matches what /pricing already displays (see
-- src/config/plans.ts and the comparison table), kept in sync by hand
-- until the app is wired to read entitlements from here directly.
create table public.plans (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  tier_order smallint not null unique,
  monthly_price_pence integer not null check (monthly_price_pence >= 0),
  annual_price_pence integer not null check (annual_price_pence >= 0),
  entitlements jsonb not null default '{}',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.plans enable row level security;

create policy "Anyone can view plans"
  on public.plans for select
  using (true);

create trigger set_plans_updated_at
  before update on public.plans
  for each row execute procedure public.set_updated_at();

-- One current subscription per user. Upgrades/downgrades update this row
-- in place; billing_events below is the historical record of how it got
-- there. No insert/update/delete policy for anon/authenticated — every
-- mutation goes through a security-definer function or, once it exists,
-- the service-role client handling Stripe webhooks. Not self-service.
create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users (id) on delete cascade,
  plan_id uuid not null references public.plans (id),
  status public.subscription_status not null default 'active',
  billing_cycle public.billing_cycle,
  current_period_start timestamptz not null default now(),
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  stripe_customer_id text,
  stripe_subscription_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.subscriptions enable row level security;

create policy "Users can view their own subscription"
  on public.subscriptions for select
  using (auth.uid() = user_id);

create index subscriptions_plan_id_idx on public.subscriptions (plan_id);

create trigger set_subscriptions_updated_at
  before update on public.subscriptions
  for each row execute procedure public.set_updated_at();

-- Metered usage against a plan's entitlements, one row per user per
-- metric per billing period — e.g. how many CVs a Free-plan user has
-- created this period, to enforce the "1 CV" limit in `plans.entitlements`.
-- Same access model as subscriptions: read-only for the owning user,
-- written only by trusted server-side logic.
create table public.subscription_usage (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  metric text not null check (char_length(metric) <= 100),
  period_start timestamptz not null,
  period_end timestamptz not null,
  used_count integer not null default 0 check (used_count >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, metric, period_start)
);

alter table public.subscription_usage enable row level security;

create policy "Users can view their own usage"
  on public.subscription_usage for select
  using (auth.uid() = user_id);

create index subscription_usage_user_id_idx on public.subscription_usage (user_id);

create trigger set_subscription_usage_updated_at
  before update on public.subscription_usage
  for each row execute procedure public.set_updated_at();

-- Append-only audit log of billing lifecycle events. Read-only for the
-- owning user (so a future billing-history UI has something real to
-- show), written only by trusted server-side logic — never updated or
-- deleted, so no update/delete policy exists even for the service role's
-- future use to bypass by design, not by omission.
create table public.billing_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  subscription_id uuid references public.subscriptions (id) on delete set null,
  event_type public.billing_event_type not null,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now()
);

alter table public.billing_events enable row level security;

create policy "Users can view their own billing events"
  on public.billing_events for select
  using (auth.uid() = user_id);

create index billing_events_user_id_idx on public.billing_events (user_id);

-- Seed the four plans. Prices in pence (never float for money); figures
-- match src/config/plans.ts's PLAN_PRICING exactly. Entitlements match
-- the /pricing comparison table row-for-row.
insert into public.plans (slug, name, tier_order, monthly_price_pence, annual_price_pence, entitlements) values
  ('free', 'Free', 0, 0, 0, '{
    "cv_limit": 1,
    "ats_scanner": true,
    "cover_letter_generator": false,
    "linkedin_optimiser": false,
    "interview_coach_text": false,
    "interview_coach_voice": false,
    "job_match": false,
    "grad_scheme_prep": false,
    "job_tracker": true,
    "visa_sponsor_register": true,
    "support_tier": "email"
  }'::jsonb),
  ('pro', 'Pro', 1, 600, 6000, '{
    "cv_limit": null,
    "ats_scanner": true,
    "cover_letter_generator": true,
    "linkedin_optimiser": true,
    "interview_coach_text": false,
    "interview_coach_voice": false,
    "job_match": false,
    "grad_scheme_prep": false,
    "job_tracker": true,
    "visa_sponsor_register": true,
    "support_tier": "email"
  }'::jsonb),
  ('premium', 'Premium', 2, 1500, 15000, '{
    "cv_limit": null,
    "ats_scanner": true,
    "cover_letter_generator": true,
    "linkedin_optimiser": true,
    "interview_coach_text": true,
    "interview_coach_voice": false,
    "job_match": true,
    "grad_scheme_prep": true,
    "job_tracker": true,
    "visa_sponsor_register": true,
    "support_tier": "email"
  }'::jsonb),
  ('elite', 'Elite', 3, 2500, 25000, '{
    "cv_limit": null,
    "ats_scanner": true,
    "cover_letter_generator": true,
    "linkedin_optimiser": true,
    "interview_coach_text": true,
    "interview_coach_voice": true,
    "job_match": true,
    "grad_scheme_prep": true,
    "job_tracker": true,
    "visa_sponsor_register": true,
    "support_tier": "priority"
  }'::jsonb);

-- Give every existing user (signed up before this migration) a Free
-- subscription, so `subscriptions` is never empty for a real account.
insert into public.subscriptions (user_id, plan_id, status, current_period_start)
select p.id, (select id from public.plans where slug = 'free'), 'active', now()
from public.profiles p
where not exists (select 1 from public.subscriptions s where s.user_id = p.id);

insert into public.billing_events (user_id, subscription_id, event_type, metadata)
select s.user_id, s.id, 'subscription_created', '{"reason": "backfill"}'::jsonb
from public.subscriptions s
where not exists (
  select 1 from public.billing_events e
  where e.subscription_id = s.id and e.event_type = 'subscription_created'
);

-- Keeps `profiles.plan` (the simple free/paid flag existing app code
-- already reads) in sync automatically whenever a subscription's plan
-- changes, so dashboard code doesn't need to be rewritten to join
-- subscriptions just to know "is this user on a paid plan".
create function public.sync_profile_plan_from_subscription()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  update public.profiles
  set plan = case
    when (select tier_order from public.plans where id = new.plan_id) = 0 then 'free'
    else 'paid'
  end
  where id = new.user_id;

  return new;
end;
$$;

create trigger sync_profile_plan_after_subscription_change
  after insert or update of plan_id on public.subscriptions
  for each row execute procedure public.sync_profile_plan_from_subscription();

-- Extend the new-user trigger to seed a Free subscription (and its
-- creation event) for every new signup, same pattern as 0003/0004/0006
-- extending it for user_preferences/date_of_birth/newsletter fields.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
declare
  v_newsletter_opt_in boolean := coalesce((new.raw_user_meta_data ->> 'newsletter_opt_in')::boolean, false);
  v_free_plan_id uuid;
  v_subscription_id uuid;
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

  select id into v_free_plan_id from public.plans where slug = 'free';

  insert into public.subscriptions (user_id, plan_id, status, current_period_start)
  values (new.id, v_free_plan_id, 'active', now())
  returning id into v_subscription_id;

  insert into public.billing_events (user_id, subscription_id, event_type)
  values (new.id, v_subscription_id, 'subscription_created');

  return new;
end;
$$;
