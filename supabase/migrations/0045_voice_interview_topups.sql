-- Real purchase record for "voice top-ups" — migration 0016 seeded
-- `voice_topups_allowed` as a plan feature flag, but nothing ever wrote
-- a row anywhere when someone actually bought one; this is that missing
-- ledger, plus the billing_event_type value the Stripe webhook records
-- the purchase under (src/lib/billing/sync.ts's withIdempotency, same
-- append-only audit trail every other billing event already uses).
--
-- One row per completed top-up purchase, scoped to the calendar month it
-- was bought for (period_start, matching src/lib/entitlements/
-- service.ts's getCurrentCalendarPeriod — top-ups top up *this month's*
-- allowance, they don't bank indefinitely). `credits` is the number of
-- extra voice interviews it grants; src/lib/entitlements/service.ts's
-- getLimit sums every row for the user's current period on top of the
-- plan's own voice_interviews_per_month limit. `stripe_checkout_session_id`
-- is unique so a retried/duplicate webhook delivery can never double-credit
-- the same purchase — belt-and-braces alongside billing_events' own
-- stripe_event_id idempotency guard.
--
-- Same access model as subscription_usage/billing_events: read-only for
-- the owning user, no insert/update/delete policy for anon/authenticated
-- at all — every row is written by the Stripe webhook's service-role
-- client, never a direct client write.

alter type public.billing_event_type add value 'voice_topup_purchased';

create table public.voice_interview_topups (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  period_start timestamptz not null,
  credits integer not null check (credits > 0),
  stripe_checkout_session_id text not null unique,
  created_at timestamptz not null default now()
);

alter table public.voice_interview_topups enable row level security;

create policy "Users can view their own voice top-ups"
  on public.voice_interview_topups for select
  using (auth.uid() = user_id);

create index voice_interview_topups_user_period_idx
  on public.voice_interview_topups (user_id, period_start);
