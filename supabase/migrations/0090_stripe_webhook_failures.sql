-- A record of Stripe webhook deliveries that failed to process, so the
-- admin overview can show "failed webhooks" as a real number instead of
-- it living only in server logs (src/app/api/stripe/webhook/route.ts
-- used to just console.error and return 500).
--
-- One row per failed *attempt*: Stripe retries a 500 automatically, and
-- each retry that also fails adds a row. When a later attempt succeeds,
-- the handler stamps `resolved_at` on every row for that event id, so
-- "unresolved" (resolved_at is null) means "still failing / never
-- recovered" and the retry noise doesn't inflate the headline count.
--
-- `error_message` is truncated by the writer and never holds the
-- request body — only the processing error's own message.
--
-- Written only by the webhook route through the service-role client, so
-- there is deliberately no insert/update/delete policy for anyone else.
-- Readable by admins holding `view_system_health`, the same permission
-- that gates the health page this data belongs next to.

create table public.stripe_webhook_failures (
  id uuid primary key default gen_random_uuid(),
  stripe_event_id text not null check (char_length(stripe_event_id) between 1 and 100),
  event_type text not null check (char_length(event_type) between 1 and 100),
  error_message text check (error_message is null or char_length(error_message) <= 500),
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

alter table public.stripe_webhook_failures enable row level security;

create policy "Admins with view_system_health can view webhook failures"
  on public.stripe_webhook_failures for select
  using (public.has_admin_permission(auth.uid(), 'view_system_health'));

create index stripe_webhook_failures_created_at_idx
  on public.stripe_webhook_failures (created_at desc);

create index stripe_webhook_failures_unresolved_idx
  on public.stripe_webhook_failures (stripe_event_id)
  where resolved_at is null;
