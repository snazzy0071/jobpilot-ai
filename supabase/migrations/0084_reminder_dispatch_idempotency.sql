-- Closes an idempotency gap in the reminder dispatch cron
-- (src/app/api/cron/dispatch-reminders, src/lib/applications/reminders/
-- dispatch.ts): it read every 'pending' row, sent the email, *then*
-- flipped email_status to 'sent' — nothing stopped two overlapping
-- invocations (a slow run overlapping the next 15-minute cron tick, a
-- manual re-trigger racing the scheduled one) from both reading the same
-- pending row and sending the same reminder email twice.
--
-- Adds an in-flight claim state to the delivery status enum (migration
-- 0066) plus a claim timestamp, so the dispatcher can atomically claim a
-- row (UPDATE ... WHERE email_status = 'pending', SET email_status =
-- 'sending') *before* sending — an UPDATE's WHERE clause is evaluated
-- atomically, so only one concurrent invocation can ever win that claim
-- for a given row. Same "claim before you act" shape
-- src/lib/billing/sync.ts's withIdempotency() already uses for Stripe
-- webhooks, adapted here since there's no separate ledger table to
-- insert a claim row into — the reminder row's own status column is it.
--
-- email_claimed_at lets a genuinely crashed run (the process dies after
-- claiming but before the email send resolves either way) be reclaimed
-- and retried after a stale-claim timeout, rather than leaving that
-- reminder stuck in 'sending' forever and never delivered.

alter type public.reminder_delivery_status add value 'sending';

alter table public.application_reminders
  add column email_claimed_at timestamptz;
