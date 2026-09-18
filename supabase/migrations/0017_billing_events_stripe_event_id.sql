-- Backs idempotent Stripe webhook processing: the webhook handler inserts
-- a billing_events row carrying the Stripe event id *before* applying any
-- side effect. If Stripe redelivers the same event (which it does — at
-- least once delivery is the documented guarantee), the insert hits this
-- unique constraint and the handler skips reprocessing instead of double-
-- applying a subscription change. Nullable because not every billing
-- event originates from a Stripe webhook (e.g. the signup-time
-- 'subscription_created' events already seeded) — Postgres unique
-- constraints allow multiple nulls, only non-null duplicates conflict.

alter table public.billing_events
  add column stripe_event_id text unique;
