-- Rounds out application_reminders (migration 0063) with real,
-- per-channel delivery tracking — until now the table only recorded
-- *what* to remind about and *when*, with no way to say how (email,
-- in-app, or both) or whether that delivery actually happened.
--
-- Two fixed, named channels rather than a child table (same "a small,
-- fixed set that never varies doesn't need normalizing into rows"
-- reasoning migration 0061's job_match_components columns already
-- used) — a reminder either wants email, in-app, or both, never an
-- open-ended list of channels.
--
-- Each channel gets its own enable flag + status + sent-at + (email
-- only) error — `email_status`/`in_app_status` are null exactly when
-- that channel isn't requested at all (enforced by the check
-- constraint below), and 'pending'/'sent'/'failed' once it is, set by
-- application code at creation time and updated by the dispatch job
-- (src/app/api/cron/dispatch-reminders — sends real email via
-- src/lib/email/resend.ts, and marks in-app "sent" the moment
-- remind_at is reached, which is what surfaces it in the UI).

create type public.reminder_delivery_status as enum ('pending', 'sent', 'failed');

alter table public.application_reminders
  add column send_email boolean not null default false,
  add column send_in_app boolean not null default true,
  add column email_status public.reminder_delivery_status,
  add column email_sent_at timestamptz,
  add column email_error text check (char_length(email_error) <= 500),
  add column in_app_status public.reminder_delivery_status,
  add column in_app_sent_at timestamptz,
  add constraint application_reminders_at_least_one_channel check (send_email or send_in_app),
  add constraint application_reminders_channel_status_consistency check (
    (send_email or email_status is null) and (send_in_app or in_app_status is null)
  );

-- Supports the dispatch job's own query: "reminders whose time has
-- come, that still have at least one channel outstanding" — partial on
-- both the time bound's own column and the not-yet-fully-delivered
-- condition, same shape as this table's existing
-- application_reminders_user_id_remind_at_idx.
create index application_reminders_dispatch_idx
  on public.application_reminders (remind_at)
  where (completed_at is null and (email_status = 'pending' or in_app_status = 'pending'));
