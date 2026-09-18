-- Safe, append-only log of GDPR data-export requests
-- (GET /dashboard/settings/export) — records that an export happened,
-- by whom, and in what format, never the exported content itself. Same
-- "safe metadata only" discipline as admin_audit_logs (migration 0079)
-- and email_send_logs (migration 0081): what's logged here can never
-- itself leak the personal data it's a log *of*.

create table public.data_export_logs (
  id uuid primary key default gen_random_uuid(),
  -- Nullable + on delete set null: a later account deletion must never
  -- erase the record that an export happened — same "losing the link is
  -- fine, losing the record isn't" reasoning admin_audit_logs.actor_id
  -- already applies.
  user_id uuid references auth.users (id) on delete set null,
  format text not null check (format in ('json', 'zip')),
  requested_at timestamptz not null default now()
);

alter table public.data_export_logs enable row level security;

-- Insert-only, and only for a user logging *themselves* as the exporter
-- — `user_id` must equal the caller's own auth.uid(), same "can't forge
-- someone else's name onto an action they didn't take" shape
-- admin_audit_logs already uses. No update/delete policy at all is what
-- makes this append-only — RLS defaults to deny for any operation with
-- no matching policy, for every role but service_role/postgres.
create policy "Users can log their own export requests"
  on public.data_export_logs for insert
  with check (auth.uid() = user_id);

-- Users can see their own export history — GDPR transparency (knowing
-- when you last exported your own data), not a general audit surface.
create policy "Users can view their own export requests"
  on public.data_export_logs for select
  using (auth.uid() = user_id);

create index data_export_logs_user_id_idx on public.data_export_logs (user_id, requested_at desc);
